import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

loadEnv(path.join(projectRoot, '.env'));

const apiPort = Number(process.env.STUDIO_API_PORT ?? process.env.PORT ?? 8787);
const host = process.env.STUDIO_HOST ?? '127.0.0.1';
const apiBasePath = normalizePath(process.env.STUDIO_API_BASE ?? '/api/curator-studio');
const studioPath = normalizePath(process.env.STUDIO_PATH ?? '/curator-studio');
const sessionCookieName = process.env.STUDIO_SESSION_COOKIE ?? 'yiming_studio_session';
const sessionHours = Number(process.env.STUDIO_SESSION_HOURS ?? 8);
const isLocalDev = process.env.STUDIO_LOCAL_DEV === '1' || process.env.NODE_ENV !== 'production';
const autoBuild =
  process.env.STUDIO_AUTO_BUILD === '1' || process.env.STUDIO_PUBLISH_MODE === 'release';
const publishMode = process.env.STUDIO_PUBLISH_MODE ?? 'none';
const releasesDir = process.env.STUDIO_RELEASES_DIR
  ? path.resolve(process.env.STUDIO_RELEASES_DIR)
  : path.resolve(projectRoot, '..', 'releases');
const currentLink = process.env.STUDIO_CURRENT_LINK
  ? path.resolve(process.env.STUDIO_CURRENT_LINK)
  : path.resolve(projectRoot, '..', 'current');
const buildCommand = process.env.STUDIO_BUILD_COMMAND ?? 'pnpm';
const buildArgs = (process.env.STUDIO_BUILD_ARGS ?? 'build').split(/\s+/).filter(Boolean);

const paths = {
  site: 'src/data/site.json',
  navigation: 'src/data/navigation.json',
  hallsDir: 'src/content/halls',
  exhibitionsDir: 'src/content/exhibitions',
};

const foundationalHalls = ['city', 'travel', 'campus', 'still-life', 'daily-notes', 'experiments'];
const allowedHallStatuses = new Set(['active', 'hidden']);
const allowedExhibitionStatuses = new Set(['draft', 'published', 'hidden']);
const allowedOrientations = new Set(['landscape', 'portrait', 'square', 'unknown']);
const allowedTones = new Set(['warm', 'blue-gray', 'brown-gray', 'daily', 'monochrome']);

let buildChain = Promise.resolve();

function normalizePath(value) {
  const withSlash = String(value || '').startsWith('/') ? String(value) : `/${value}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

function loadEnv(envPath) {
  if (!fsSync.existsSync(envPath)) return;

  const raw = fsSync.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (process.env[key]) continue;
    let value = rest.join('=').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key.trim()] = value;
  }
}

function toAbsolute(relativePath) {
  const absolute = path.resolve(projectRoot, relativePath);
  if (!absolute.startsWith(projectRoot)) {
    throw new Error(`Unsafe project path: ${relativePath}`);
  }
  return absolute;
}

async function readJson(relativePath) {
  const raw = await fs.readFile(toAbsolute(relativePath), 'utf8');
  return JSON.parse(raw);
}

async function readJsonDirectory(relativeDir) {
  const absoluteDir = toAbsolute(relativeDir);
  const files = (await fs.readdir(absoluteDir))
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
  const entries = [];

  for (const file of files) {
    const relativePath = path.join(relativeDir, file).replaceAll(path.sep, '/');
    const data = await readJson(relativePath);
    const stat = await fs.stat(toAbsolute(relativePath));
    entries.push({ ...data, __file: relativePath, __updatedAt: stat.mtime.toISOString() });
  }

  return entries;
}

function stripInternalFields(value) {
  if (Array.isArray(value)) return value.map(stripInternalFields);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith('__'))
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripInternalFields(item)]),
  );
}

function assertSlug(slug, label) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw httpError(400, `${label} slug must use lowercase letters, numbers, and hyphens.`);
  }
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(req, res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    ...corsHeaders(req),
    ...extraHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > 2 * 1024 * 1024) throw httpError(413, 'Request body too large.');
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function fileExists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function backupFile(relativePath, stamp = timestamp()) {
  const absolutePath = toAbsolute(relativePath);
  if (!(await fileExists(absolutePath))) return null;

  const backupRelative = path.join('.studio-backups', stamp, `${relativePath}.bak`);
  const backupAbsolute = toAbsolute(backupRelative);
  await fs.mkdir(path.dirname(backupAbsolute), { recursive: true });
  await fs.copyFile(absolutePath, backupAbsolute);
  return backupRelative.replaceAll(path.sep, '/');
}

async function writeJson(relativePath, payload, stamp = timestamp()) {
  await backupFile(relativePath, stamp);
  const absolutePath = toAbsolute(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(
    absolutePath,
    `${JSON.stringify(stripInternalFields(payload), null, 2)}\n`,
    'utf8',
  );
}

function passwordHash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function timingSafeTextEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function configuredPasswordAvailable() {
  return Boolean(
    process.env.STUDIO_PASSWORD ||
    process.env.STUDIO_PASSWORD_HASH ||
    process.env.ADMIN_PASSWORD ||
    isLocalDev,
  );
}

function passwordMatches(password) {
  if (process.env.STUDIO_PASSWORD_HASH) {
    const configured = process.env.STUDIO_PASSWORD_HASH.replace(/^sha256:/, '');
    return timingSafeTextEqual(passwordHash(password), configured);
  }

  const configured =
    process.env.STUDIO_PASSWORD || process.env.ADMIN_PASSWORD || (isLocalDev ? 'local-studio' : '');
  return configured ? timingSafeTextEqual(password, configured) : false;
}

function sessionSecret() {
  return (
    process.env.STUDIO_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.STUDIO_PASSWORD_HASH ||
    passwordHash(process.env.STUDIO_PASSWORD || process.env.ADMIN_PASSWORD || 'local-studio')
  );
}

function sign(value) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function createSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + sessionHours * 60 * 60 }),
  ).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  return `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    sessionHours * 60 * 60
  }`;
}

function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split('=');
        return [key, rest.join('=')];
      }),
  );
}

function isAuthenticated(req) {
  const token = parseCookies(req)[sessionCookieName];
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!timingSafeTextEqual(sign(payload), signature)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} cannot be empty.`);
}

function requireNumber(value, label, errors) {
  if (typeof value !== 'number' || Number.isNaN(value)) errors.push(`${label} must be a number.`);
}

function validateSite(site) {
  const errors = [];
  requireString(site?.brand?.englishTitle, 'Site english title', errors);
  requireString(site?.brand?.chineseSubtitle, 'Site chinese subtitle', errors);
  requireString(site?.home?.intro, 'Home intro', errors);
  requireString(site?.seo?.title, 'SEO title', errors);
  requireString(site?.seo?.description, 'SEO description', errors);
  if (!Array.isArray(site?.about?.body)) errors.push('About body must be an array of paragraphs.');
  return errors;
}

function validateNavigation(navigation) {
  const errors = [];

  if (!Array.isArray(navigation?.publicNav)) {
    errors.push('publicNav must be an array.');
  } else {
    for (const item of navigation.publicNav) {
      requireString(item.label, 'Navigation label', errors);
      requireString(item.href, 'Navigation href', errors);
      requireNumber(item.order, 'Navigation order', errors);

      if (String(item.href).startsWith('/studio') || String(item.href).startsWith(studioPath)) {
        errors.push(`${studioPath} is protected and cannot be added to public navigation.`);
      }
    }
  }

  if (!Array.isArray(navigation?.home?.hallSlugs)) {
    errors.push('home.hallSlugs must be an array.');
  }

  return errors;
}

function validateHall(hall) {
  const errors = [];
  assertSlug(hall?.slug, 'Hall');
  requireString(hall.name, 'Hall name', errors);
  requireString(hall.englishName, 'Hall englishName', errors);
  requireString(hall.description, 'Hall description', errors);
  requireNumber(hall.order, 'Hall order', errors);
  if (!Array.isArray(hall.mood)) errors.push('Hall mood must be an array.');
  if (!allowedHallStatuses.has(hall.status)) errors.push('Hall status must be active or hidden.');
  if (hall.tone && !allowedTones.has(hall.tone)) errors.push('Hall tone is not recognized.');
  return errors;
}

function validateExhibition(exhibition, halls) {
  const errors = [];
  const hallSlugs = new Set(halls.map((hall) => hall.slug));

  assertSlug(exhibition?.slug, 'Exhibition');
  requireString(exhibition.title, 'Exhibition title', errors);
  requireString(exhibition.hallSlug, 'Exhibition hallSlug', errors);

  if (!allowedExhibitionStatuses.has(exhibition.status)) {
    errors.push('Exhibition status must be draft, published, or hidden.');
  }

  if (exhibition.hallSlug && !hallSlugs.has(exhibition.hallSlug)) {
    errors.push(`Exhibition hallSlug does not exist: ${exhibition.hallSlug}`);
  }

  if (!Array.isArray(exhibition.photos)) errors.push('Exhibition photos must be an array.');

  if (exhibition.status === 'published') {
    requireString(exhibition.title, 'Published exhibition title', errors);
    requireString(exhibition.hallSlug, 'Published exhibition hallSlug', errors);
    requireString(exhibition.intro, 'Published exhibition intro', errors);
    requireString(exhibition.cover, 'Published exhibition cover', errors);

    if (!Array.isArray(exhibition.photos) || exhibition.photos.length === 0) {
      errors.push('Published exhibition must include at least one photo.');
    }
  }

  for (const [index, photo] of (exhibition.photos ?? []).entries()) {
    if (photo.orientation && !allowedOrientations.has(photo.orientation)) {
      errors.push(`Photo ${index + 1} orientation is not recognized.`);
    }
  }

  return errors;
}

function issue(severity, code, title, detail, source, href) {
  return { severity, code, title, detail, source, href };
}

async function imageExists(src) {
  if (!src || typeof src !== 'string') return false;
  if (/^https?:\/\//i.test(src)) return true;

  const relativePath = src.startsWith('/') ? src.slice(1) : src;
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!absolutePath.startsWith(projectRoot)) return false;
  return fileExists(absolutePath);
}

async function buildHealth({ site, navigation, halls, exhibitions }) {
  const results = [];
  const hallSlugs = new Set(halls.map((hall) => hall.slug));
  const hallOrder = new Map();
  const exhibitionSlugs = new Set();
  const exhibitionOrders = new Map();
  const featured = exhibitions.filter((exhibition) => exhibition.featured);

  for (const requiredSlug of foundationalHalls) {
    if (!hallSlugs.has(requiredSlug)) {
      results.push(
        issue(
          'error',
          'base-hall-missing',
          '六大基础展厅缺失',
          `缺少基础展厅：${requiredSlug}`,
          `hall:${requiredSlug}`,
          `${studioPath}#halls`,
        ),
      );
    }
  }

  for (const hall of halls) {
    if (!hall.name?.trim())
      results.push(issue('error', 'hall-empty-name', '展厅中文名为空', hall.slug));
    if (!hall.englishName?.trim()) {
      results.push(issue('error', 'hall-empty-english', '展厅英文名为空', hall.slug));
    }
    if (!hall.description?.trim()) {
      results.push(issue('error', 'hall-empty-description', '展厅介绍为空', hall.slug));
    }

    if (typeof hall.order !== 'number' || Number.isNaN(hall.order)) {
      results.push(issue('error', 'hall-order-invalid', '展厅 order 不是数字', hall.slug));
    } else {
      const existing = hallOrder.get(hall.order);
      if (existing) {
        results.push(
          issue(
            'warning',
            'hall-order-duplicate',
            '展厅 order 重复',
            `${existing} 与 ${hall.slug} 都使用 order ${hall.order}`,
          ),
        );
      }
      hallOrder.set(hall.order, hall.slug);
    }

    if (hall.cover && !(await imageExists(hall.cover))) {
      results.push(issue('warning', 'hall-cover-missing', '展厅封面文件不存在', hall.cover));
    }
  }

  for (const exhibition of exhibitions) {
    if (exhibitionSlugs.has(exhibition.slug)) {
      results.push(issue('error', 'exhibition-slug-duplicate', '展览 slug 重复', exhibition.slug));
    }
    exhibitionSlugs.add(exhibition.slug);

    if (!exhibition.title?.trim()) {
      results.push(
        issue(
          exhibition.status === 'draft' ? 'warning' : 'error',
          'exhibition-empty-title',
          '展览标题为空',
          exhibition.slug,
        ),
      );
    }

    if (!exhibition.intro?.trim()) {
      results.push(
        issue(
          exhibition.status === 'draft' ? 'warning' : 'error',
          'exhibition-empty-intro',
          '展览 intro 为空',
          exhibition.slug,
        ),
      );
    }

    if (!hallSlugs.has(exhibition.hallSlug)) {
      results.push(
        issue(
          'error',
          'exhibition-hall-missing',
          '展览引用了不存在的展厅',
          `${exhibition.title || exhibition.slug} -> ${exhibition.hallSlug}`,
        ),
      );
    }

    if (exhibition.status === 'published') {
      if (!exhibition.cover?.trim()) {
        results.push(
          issue('error', 'published-cover-empty', '已发布展览缺少封面', exhibition.slug),
        );
      } else if (!(await imageExists(exhibition.cover))) {
        results.push(
          issue(
            'warning',
            'published-cover-missing-file',
            '已发布展览封面文件不存在',
            exhibition.cover,
          ),
        );
      }

      if (!Array.isArray(exhibition.photos) || exhibition.photos.length === 0) {
        results.push(issue('error', 'published-no-photos', '已发布展览没有照片', exhibition.slug));
      }
    }

    if (exhibition.status !== 'published' && exhibition.featured) {
      results.push(
        issue(
          'warning',
          'non-public-featured',
          '非 published 展览被设为 featured',
          exhibition.slug,
        ),
      );
    }

    if (typeof exhibition.displayOrder === 'number') {
      const existing = exhibitionOrders.get(exhibition.displayOrder);
      if (existing) {
        results.push(
          issue(
            'info',
            'exhibition-order-duplicate',
            '展览 displayOrder 重复',
            `${existing} 与 ${exhibition.slug} 都使用 ${exhibition.displayOrder}`,
          ),
        );
      }
      exhibitionOrders.set(exhibition.displayOrder, exhibition.slug);
    }

    for (const [index, photo] of (exhibition.photos ?? []).entries()) {
      const label = `${exhibition.slug} photo ${index + 1}`;
      if (!photo.src?.trim()) {
        results.push(issue('error', 'photo-src-empty', '照片路径为空', label));
      } else if (!(await imageExists(photo.src))) {
        results.push(issue('warning', 'photo-file-missing', '照片文件不存在', photo.src));
      }
      if (!photo.alt?.trim())
        results.push(issue('error', 'photo-alt-empty', '照片 alt 为空', label));
      if (!photo.caption?.trim()) {
        results.push(issue('warning', 'photo-caption-empty', '照片 caption 为空', label));
      }
    }
  }

  if (featured.length === 0) {
    results.push(
      issue('info', 'featured-none', '当前没有 featured 展览', '首页不会显示突出展览区块。'),
    );
  }
  if (featured.length > 3) {
    results.push(
      issue(
        'warning',
        'featured-many',
        'featured 展览数量偏多',
        `当前共有 ${featured.length} 个。`,
      ),
    );
  }

  for (const navIssue of validateNavigation(navigation)) {
    results.push(issue('error', 'navigation-invalid', '导航配置存在问题', navIssue, 'navigation'));
  }
  for (const siteIssue of validateSite(site)) {
    results.push(issue('error', 'site-copy-invalid', '全站文案存在问题', siteIssue, 'site'));
  }
  for (const slug of navigation.home?.hallSlugs ?? []) {
    const hall = halls.find((item) => item.slug === slug);
    if (hall?.status === 'hidden') {
      results.push(issue('warning', 'hidden-hall-on-home', 'hidden 展厅仍在首页配置中', slug));
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    counts: {
      error: results.filter((item) => item.severity === 'error').length,
      warning: results.filter((item) => item.severity === 'warning').length,
      info: results.filter((item) => item.severity === 'info').length,
    },
    results,
  };
}

async function loadContent() {
  const site = await readJson(paths.site);
  const navigation = await readJson(paths.navigation);
  const halls = await readJsonDirectory(paths.hallsDir);
  const exhibitions = await readJsonDirectory(paths.exhibitionsDir);
  const health = await buildHealth({ site, navigation, halls, exhibitions });

  return {
    site,
    navigation,
    halls: halls.sort((a, b) => a.order - b.order),
    exhibitions: exhibitions.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    health,
    meta: {
      projectRoot,
      apiPort,
      studioPath,
      apiBasePath,
      autoBuild,
      publishMode,
      foundationalHalls,
    },
  };
}

async function publishStaticSite() {
  if (!autoBuild) {
    return { built: false, published: false, reason: 'auto build disabled' };
  }

  return (buildChain = buildChain.then(async () => {
    await runCommand(buildCommand, buildArgs, { cwd: projectRoot });

    if (publishMode !== 'release') {
      return { built: true, published: false, reason: 'release publish disabled' };
    }

    const stamp = timestamp();
    const releaseDir = path.join(releasesDir, stamp);
    await fs.mkdir(releaseDir, { recursive: true });
    await fs.cp(path.join(projectRoot, 'dist'), releaseDir, { recursive: true });
    await swapCurrent(releaseDir, currentLink);
    return { built: true, published: true, releaseDir };
  }));
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: process.platform === 'win32',
      env: process.env,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) resolve(output);
      else reject(httpError(500, output || `${command} exited with ${code}`));
    });
  });
}

async function swapCurrent(target, linkPath) {
  const tmpLink = `${linkPath}.next-${timestamp()}-${randomBytes(3).toString('hex')}`;
  await fs.symlink(target, tmpLink);
  await fs.rename(tmpLink, linkPath);
}

async function saveSite(payload) {
  const errors = validateSite(payload);
  if (errors.length) throw httpError(400, errors.join('\n'));

  const stamp = timestamp();
  await writeJson(paths.site, payload, stamp);
  return { saved: true, backupGroup: stamp, publish: await publishStaticSite() };
}

async function saveNavigation(payload) {
  const errors = validateNavigation(payload);
  if (errors.length) throw httpError(400, errors.join('\n'));

  const stamp = timestamp();
  await writeJson(paths.navigation, payload, stamp);
  return { saved: true, backupGroup: stamp, publish: await publishStaticSite() };
}

async function saveHomeControl(payload) {
  const site = payload?.site;
  const navigation = payload?.navigation;
  const featuredSlug = String(payload?.featuredSlug ?? '');
  const content = await loadContent();
  const errors = [...validateSite(site), ...validateNavigation(navigation)];

  if (featuredSlug) {
    const selected = content.exhibitions.find((exhibition) => exhibition.slug === featuredSlug);
    if (!selected) {
      errors.push(`Featured exhibition does not exist: ${featuredSlug}`);
    } else if (selected.status !== 'published') {
      errors.push('Featured exhibition must be published.');
    }
  }

  if (errors.length) throw httpError(400, errors.join('\n'));

  const stamp = timestamp();
  await writeJson(paths.site, site, stamp);
  await writeJson(paths.navigation, navigation, stamp);

  const changedExhibitions = [];
  for (const exhibition of content.exhibitions) {
    const shouldFeature = featuredSlug ? exhibition.slug === featuredSlug : false;
    if (Boolean(exhibition.featured) === shouldFeature) continue;

    await writeJson(
      `${paths.exhibitionsDir}/${exhibition.slug}.json`,
      {
        ...exhibition,
        featured: shouldFeature,
      },
      stamp,
    );
    changedExhibitions.push(exhibition.slug);
  }

  return {
    saved: true,
    backupGroup: stamp,
    featuredSlug,
    changedExhibitions,
    publish: await publishStaticSite(),
  };
}

async function saveHall(oldSlug, payload) {
  const errors = validateHall(payload);
  if (errors.length) throw httpError(400, errors.join('\n'));

  assertSlug(oldSlug, 'Current hall');
  const stamp = timestamp();
  const oldRelative = `${paths.hallsDir}/${oldSlug}.json`;
  const newRelative = `${paths.hallsDir}/${payload.slug}.json`;

  if (oldSlug !== payload.slug && (await fileExists(toAbsolute(newRelative)))) {
    throw httpError(409, `Hall slug already exists: ${payload.slug}`);
  }

  await backupFile(oldRelative, stamp);
  await writeJson(newRelative, payload, stamp);

  if (oldSlug !== payload.slug && (await fileExists(toAbsolute(oldRelative)))) {
    await fs.unlink(toAbsolute(oldRelative));
  }

  return {
    saved: true,
    backupGroup: stamp,
    oldSlug,
    slug: payload.slug,
    publish: await publishStaticSite(),
  };
}

async function saveExhibition(oldSlug, payload) {
  const content = await loadContent();
  const errors = validateExhibition(payload, content.halls);
  if (errors.length) throw httpError(400, errors.join('\n'));

  const creating = oldSlug === '_new';
  if (!creating) assertSlug(oldSlug, 'Current exhibition');

  const stamp = timestamp();
  const oldRelative = `${paths.exhibitionsDir}/${oldSlug}.json`;
  const newRelative = `${paths.exhibitionsDir}/${payload.slug}.json`;

  if ((creating || oldSlug !== payload.slug) && (await fileExists(toAbsolute(newRelative)))) {
    throw httpError(409, `Exhibition slug already exists: ${payload.slug}`);
  }

  if (!creating) await backupFile(oldRelative, stamp);
  await writeJson(newRelative, payload, stamp);

  if (!creating && oldSlug !== payload.slug && (await fileExists(toAbsolute(oldRelative)))) {
    await fs.unlink(toAbsolute(oldRelative));
  }

  return {
    saved: true,
    backupGroup: stamp,
    oldSlug,
    slug: payload.slug,
    publish: await publishStaticSite(),
  };
}

function ensureAuthed(req, res) {
  if (isAuthenticated(req)) return true;
  jsonResponse(req, res, 401, { authenticated: false, error: 'Authentication required.' });
  return false;
}

async function route(req, res) {
  if (req.method === 'OPTIONS') {
    jsonResponse(req, res, 200, { ok: true });
    return;
  }

  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const pathname = normalizePath(requestUrl.pathname);

  if (!pathname.startsWith(apiBasePath)) {
    jsonResponse(req, res, 404, { error: 'Curator Studio API route not found.' });
    return;
  }

  const rest = pathname.slice(apiBasePath.length).split('/').filter(Boolean);

  if (req.method === 'GET' && rest[0] === 'session') {
    jsonResponse(req, res, 200, {
      authenticated: isAuthenticated(req),
      passwordConfigured: configuredPasswordAvailable(),
      studioPath,
    });
    return;
  }

  if (req.method === 'POST' && rest[0] === 'login') {
    const body = await readBody(req);
    if (!configuredPasswordAvailable()) throw httpError(500, 'Studio password is not configured.');
    if (!passwordMatches(String(body.password ?? ''))) {
      jsonResponse(req, res, 401, { authenticated: false, error: 'Password is incorrect.' });
      return;
    }

    jsonResponse(req, res, 200, { authenticated: true }, { 'Set-Cookie': createSessionCookie() });
    return;
  }

  if (req.method === 'POST' && rest[0] === 'logout') {
    jsonResponse(req, res, 200, { authenticated: false }, { 'Set-Cookie': clearSessionCookie() });
    return;
  }

  if (!ensureAuthed(req, res)) return;

  if (req.method === 'GET' && rest[0] === 'content') {
    jsonResponse(req, res, 200, await loadContent());
    return;
  }

  if (req.method === 'GET' && rest[0] === 'health') {
    const content = await loadContent();
    jsonResponse(req, res, 200, content.health);
    return;
  }

  if (req.method === 'POST' && rest[0] === 'site') {
    jsonResponse(req, res, 200, await saveSite(await readBody(req)));
    return;
  }

  if (req.method === 'POST' && rest[0] === 'navigation') {
    jsonResponse(req, res, 200, await saveNavigation(await readBody(req)));
    return;
  }

  if (req.method === 'POST' && rest[0] === 'home') {
    jsonResponse(req, res, 200, await saveHomeControl(await readBody(req)));
    return;
  }

  if (req.method === 'POST' && rest[0] === 'halls' && rest[1]) {
    jsonResponse(req, res, 200, await saveHall(rest[1], await readBody(req)));
    return;
  }

  if (req.method === 'POST' && rest[0] === 'exhibitions' && rest[1]) {
    jsonResponse(req, res, 200, await saveExhibition(rest[1], await readBody(req)));
    return;
  }

  jsonResponse(req, res, 404, { error: 'Curator Studio API route not found.' });
}

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    jsonResponse(req, res, error?.status ?? 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(apiPort, host, () => {
  console.log(`Curator Studio API listening on http://${host}:${apiPort}${apiBasePath}`);
  console.log(`Studio route: ${studioPath}`);
});
