const API_BASE =
  window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8787/api/curator-studio'
    : '/api/curator-studio';

const modules = {
  overview: {
    title: 'Overview',
    kicker: '控制台首页',
    description: '查看展馆内容概况、最近修改和快速入口。',
  },
  'home-control': {
    title: 'Home Control',
    kicker: '首页与导航',
    description: '集中管理首页文案、公开导航、首页展厅入口、Archive 开关和突出显示的展览。',
  },
  halls: {
    title: 'Halls',
    kicker: '六大展厅管理',
    description: '编辑展厅名称、说明、关键词、状态、排序和未来视觉字段。',
  },
  exhibitions: {
    title: 'Exhibitions',
    kicker: '展览管理',
    description: '筛选、创建和编辑展览 metadata 与基础展示逻辑。',
  },
  photos: {
    title: 'Photos',
    kicker: '照片与封面',
    description: '管理已有图片的 alt、caption、排序、封面和所属展览信息。',
  },
  'site-text': {
    title: 'Site Text',
    kicker: '站点文案',
    description: '编辑品牌、SEO、About、Footer 等站点级文字。',
  },
  health: {
    title: 'Health & Publish',
    kicker: '健康与发布',
    description: '发现内容问题，并确认保存后自动构建发布的状态。',
  },
  docs: {
    title: 'Project Docs',
    kicker: '项目文档入口',
    description: '查看当前项目的维护文档、内容规则和部署边界。',
  },
};

const moduleAliases = {
  navigation: 'home-control',
  'site-copy': 'site-text',
};

function normalizeModule(module) {
  const normalized = moduleAliases[module] || module;
  return modules[normalized] ? normalized : 'overview';
}

const state = {
  authenticated: false,
  content: null,
  module: normalizeModule(window.location.hash?.slice(1) || 'overview'),
  dirty: false,
  draft: null,
  draftKind: null,
  selectedHall: null,
  selectedExhibition: null,
  selectedPhotoExhibition: null,
  editingNewHall: false,
  editingNewExhibition: false,
  filters: {
    hall: 'all',
    status: 'all',
    featured: 'all',
    sort: 'date-desc',
    query: '',
  },
  status: {
    tone: '',
    message: 'Checking session',
  },
};

const root = document.querySelector('#studio-root');
const titleEl = document.querySelector('#studio-module-title');
const kickerEl = document.querySelector('#studio-module-kicker');
const descriptionEl = document.querySelector('#studio-module-description');
const statusEl = document.querySelector('#studio-save-status');
const navButtons = Array.from(document.querySelectorAll('[data-module]'));

function clone(value) {
  return structuredClone(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function asDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function setStatus(message, tone = '') {
  state.status = { message, tone };
  statusEl.textContent = message;
  statusEl.className = `studio-status ${tone}`.trim();
}

function markDirty() {
  state.dirty = true;
  setStatus('Unsaved changes', 'dirty');
}

function markClean(message = 'Saved') {
  state.dirty = false;
  setStatus(message, 'saved');
}

function guardDirty() {
  if (!state.dirty) {
    return true;
  }

  return window.confirm('当前有未保存修改。确定要离开当前编辑内容吗？');
}

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) {
    return;
  }

  event.preventDefault();
});

function getByPath(object, path) {
  return path.split('.').reduce((current, key) => current?.[key], object);
}

function setByPath(object, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let current = object;

  for (const part of parts) {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[last] = value;
}

function textField(label, path, value, options = {}) {
  const inputType = options.type || 'text';
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label for="${path}">${label}</label>
      <input id="${path}" data-bind="${path}" type="${inputType}" value="${escapeAttr(value ?? '')}" ${
        options.readonly ? 'readonly' : ''
      } />
      ${options.help ? `<p class="studio-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function numberField(label, path, value, options = {}) {
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label for="${path}">${label}</label>
      <input id="${path}" data-bind="${path}" data-value-type="number" type="number" value="${escapeAttr(
        value ?? '',
      )}" />
      ${options.help ? `<p class="studio-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function textareaField(label, path, value, options = {}) {
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label for="${path}">${label}</label>
      <textarea id="${path}" data-bind="${path}" rows="${options.rows || 5}">${escapeHtml(
        value ?? '',
      )}</textarea>
      ${options.help ? `<p class="studio-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function selectField(label, path, value, choices, options = {}) {
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label for="${path}">${label}</label>
      <select id="${path}" data-bind="${path}">
        ${choices
          .map(
            (choice) => `
              <option value="${escapeAttr(choice.value)}" ${choice.value === value ? 'selected' : ''}>
                ${escapeHtml(choice.label)}
              </option>
            `,
          )
          .join('')}
      </select>
      ${options.help ? `<p class="studio-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function checkboxField(label, path, value, options = {}) {
  return `
    <label class="studio-checkbox ${options.full ? 'full' : ''}">
      <input data-bind="${path}" data-value-type="boolean" type="checkbox" ${value ? 'checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function commaField(label, path, value, options = {}) {
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label for="${path}">${label}</label>
      <input id="${path}" data-bind="${path}" data-value-type="comma-array" type="text" value="${escapeAttr(
        (value ?? []).join(' / '),
      )}" />
      ${options.help ? `<p class="studio-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function paragraphField(label, path, value, options = {}) {
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label for="${path}">${label}</label>
      <textarea id="${path}" data-bind="${path}" data-value-type="paragraph-array" rows="${
        options.rows || 9
      }">${escapeHtml((value ?? []).join('\n\n'))}</textarea>
      ${options.help ? `<p class="studio-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function panel(title, description, body, actions = '') {
  return `
    <section class="studio-panel">
      <div class="studio-panel-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
        ${actions ? `<div class="studio-actions">${actions}</div>` : ''}
      </div>
      <div class="studio-panel-body">${body}</div>
    </section>
  `;
}

function workflowBanner(title, surfaces, note = '保存后会自动构建并发布到公开站点。') {
  return `
    <section class="studio-guide">
      <div>
        <span class="studio-label">Workflow</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(note)}</p>
      </div>
      <div class="studio-surface-list" aria-label="影响公开页面">
        ${surfaces.map((surface) => `<code>${escapeHtml(surface)}</code>`).join('')}
      </div>
    </section>
  `;
}

function saveActions(kind, previewHref = '') {
  return `
    <button class="studio-button" type="button" data-action="save-${kind}">保存修改</button>
    <button class="studio-button secondary" type="button" data-action="reset-draft">重置</button>
    ${
      previewHref
        ? `<a class="studio-link-button subtle" href="${previewHref}" target="_blank" rel="noreferrer">打开公开预览</a>`
        : ''
    }
    <span class="studio-publish-note">保存后自动发布</span>
  `;
}

function statusPill(status) {
  const tone =
    status === 'published' || status === 'active' ? 'ok' : status === 'hidden' ? 'warn' : '';
  return `<span class="studio-pill ${tone}">${escapeHtml(status)}</span>`;
}

function healthPill(severity) {
  return `<span class="studio-pill ${severity}">${escapeHtml(severity)}</span>`;
}

function publicHrefForHall(slug) {
  return `/halls/${slug}`;
}

function publicHrefForExhibition(slug) {
  return `/exhibitions/${slug}`;
}

function getActiveHalls() {
  return state.content.halls.filter((hall) => hall.status === 'active');
}

function getNavigationDraft() {
  return state.draft?.navigation ?? state.draft;
}

function getFeaturedSlug() {
  return state.content.exhibitions.find((item) => item.featured)?.slug || '';
}

function getFoundationalHalls() {
  return (
    state.content.meta?.foundationalHalls || [
      'city',
      'travel',
      'campus',
      'still-life',
      'daily-notes',
      'experiments',
    ]
  );
}

function isFoundationalHall(slug) {
  return getFoundationalHalls().includes(slug);
}

function getHallExhibitionCount(slug) {
  return state.content.exhibitions.filter((exhibition) => exhibition.hallSlug === slug).length;
}

function getHallName(slug) {
  const hall = state.content.halls.find((item) => item.slug === slug);
  return hall ? `${hall.name} / ${hall.englishName}` : slug;
}

function ensureDraft(kind, source, force = false) {
  if (!force && state.draftKind === kind && state.draft) {
    return state.draft;
  }

  state.draftKind = kind;
  state.draft = clone(source);
  state.dirty = false;
  setStatus('Loaded', '');
  return state.draft;
}

async function loadContent() {
  setStatus('Loading content', '');

  try {
    const response = await fetch(`${API_BASE}/content`, {
      cache: 'no-store',
      credentials: 'include',
    });

    if (response.status === 401) {
      state.authenticated = false;
      renderLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    state.content = await response.json();
    state.selectedHall = state.selectedHall || state.content.halls[0]?.slug;
    state.selectedExhibition = state.selectedExhibition || state.content.exhibitions[0]?.slug;
    state.selectedPhotoExhibition =
      state.selectedPhotoExhibition || state.content.exhibitions[0]?.slug;
    markClean('Ready');
    render();
  } catch (error) {
    setStatus('API offline', 'error');
    root.innerHTML = panel(
      '无法连接本地 Studio API',
      'Curator Studio 需要受保护的写文件 API。云端请检查 PM2，开发时请使用 pnpm studio。',
      `
        <p class="studio-help">当前页面已加载，但无法保存或读取内容数据。</p>
        <code class="studio-code">pnpm studio</code>
        <p class="studio-help" style="margin-top: 1rem;">API 地址：${API_BASE}</p>
        <p class="studio-help">错误：${escapeHtml(error.message || String(error))}</p>
      `,
    );
  }
}

async function checkSession() {
  try {
    const response = await fetch(`${API_BASE}/session`, {
      cache: 'no-store',
      credentials: 'include',
    });
    const session = await response.json();

    if (session.authenticated) {
      state.authenticated = true;
      await loadContent();
      return;
    }

    state.authenticated = false;
    renderLogin();
  } catch (error) {
    setStatus('API offline', 'error');
    root.innerHTML = panel(
      '无法连接 Curator Studio API',
      '云端需要 PM2 API 服务；本地开发请使用 pnpm studio。',
      `
        <code class="studio-code">pnpm studio</code>
        <p class="studio-help" style="margin-top: 1rem;">API 地址：${API_BASE}</p>
        <p class="studio-help">错误：${escapeHtml(error.message || String(error))}</p>
      `,
    );
  }
}

function renderLogin(message = '') {
  titleEl.textContent = 'Login';
  kickerEl.textContent = 'Private Curator Workspace';
  descriptionEl.textContent = '请输入策展台密码。';
  setStatus('Auth required', 'dirty');
  navButtons.forEach((button) => button.setAttribute('aria-current', 'false'));

  root.innerHTML = panel(
    '登录 Curator Studio',
    '这是云端受保护的私人策展台。登录后才能读取、保存并发布展馆内容。',
    `
      <form class="studio-form" data-login-form>
        <div class="studio-field">
          <label for="studio-password">Password</label>
          <input id="studio-password" name="password" type="password" autocomplete="current-password" autofocus />
        </div>
        ${
          message
            ? `<p class="studio-help" style="color: var(--studio-red);">${escapeHtml(message)}</p>`
            : ''
        }
        <div class="studio-toolbar">
          <button class="studio-button" type="submit">登录</button>
          <a class="studio-link-button secondary" href="/" target="_blank" rel="noreferrer">返回公开网站</a>
        </div>
      </form>
    `,
  );

  root.querySelector('[data-login-form]')?.addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const password = form.password.value;
  setStatus('Logging in', 'dirty');

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      renderLogin(payload.error || '登录失败。');
      return;
    }

    state.authenticated = true;
    await loadContent();
  } catch (error) {
    renderLogin(error.message || String(error));
  }
}

function updateChrome() {
  const meta = modules[state.module] || modules.overview;
  titleEl.textContent = meta.title;
  kickerEl.textContent = meta.kicker;
  descriptionEl.textContent = meta.description;

  for (const button of navButtons) {
    button.setAttribute('aria-current', button.dataset.module === state.module ? 'page' : 'false');
  }
}

function render() {
  if (!state.authenticated || !state.content) {
    return;
  }

  updateChrome();
  window.history.replaceState(null, '', `#${state.module}`);

  const renderers = {
    overview: renderOverview,
    'home-control': renderHomeControl,
    halls: renderHalls,
    exhibitions: renderExhibitions,
    photos: renderPhotos,
    'site-text': renderSiteText,
    health: renderHealth,
    docs: renderDocs,
  };

  root.innerHTML = (renderers[state.module] || renderers.overview)();
  bindRenderedControls();
}

function renderOverview() {
  const { halls, exhibitions, health } = state.content;
  const published = exhibitions.filter((item) => item.status === 'published');
  const draft = exhibitions.filter((item) => item.status === 'draft');
  const hidden = exhibitions.filter((item) => item.status === 'hidden');
  const featured = exhibitions.filter((item) => item.featured);
  const recent = [...halls, ...exhibitions]
    .filter((item) => item.__updatedAt)
    .sort((a, b) => String(b.__updatedAt).localeCompare(String(a.__updatedAt)))
    .slice(0, 6);

  return `
    <div class="studio-grid">
      ${workflowBanner('今天从这里判断站点状态，再进入具体工作流。', [
        '/',
        '/halls',
        '/exhibitions/[slug]',
      ])}

      <div class="studio-grid cols-3">
        ${statCard('展厅总数', halls.length, '六大基础展厅当前由本地 JSON 管理。')}
        ${statCard('展览总数', exhibitions.length, '包含 published / draft / hidden。')}
        ${statCard('已发布展览', published.length, '公开展馆只展示 published 内容。')}
        ${statCard('草稿展览', draft.length, '草稿不会进入公开页面。')}
        ${statCard('隐藏展览', hidden.length, 'hidden 内容不应公开展示。')}
        ${statCard('Featured', featured.length, featured.map((item) => item.title).join(' / ') || '暂无')}
      </div>

      ${panel(
        '内容健康概况',
        `当前检测到 ${health.counts.error} 个 error、${health.counts.warning} 个 warning、${health.counts.info} 个 info。`,
        `
          <div class="studio-toolbar">
            <button class="studio-button" type="button" data-module-jump="health">打开健康检查</button>
            <a class="studio-link-button secondary" href="/" target="_blank" rel="noreferrer">查看公开首页</a>
            <button class="studio-button subtle" type="button" data-action="logout">退出登录</button>
          </div>
        `,
      )}

      ${panel(
        '快速操作',
        '从这里进入最常用的内容管理任务。',
        `
          <div class="studio-toolbar">
            <button class="studio-button secondary" type="button" data-module-jump="home-control">编辑首页与导航</button>
            <button class="studio-button secondary" type="button" data-module-jump="halls">管理六大展厅</button>
            <button class="studio-button secondary" type="button" data-action="new-exhibition">新建展览</button>
            <button class="studio-button secondary" type="button" data-module-jump="photos">管理照片信息</button>
            <button class="studio-button secondary" type="button" data-module-jump="site-text">编辑站点文案</button>
            <a class="studio-link-button subtle" href="/" target="_blank" rel="noreferrer">查看公开预览</a>
          </div>
        `,
      )}

      ${panel(
        '最近修改',
        '',
        recent.length
          ? `<div class="studio-table-wrap">
              <table class="studio-table">
                <thead><tr><th>内容</th><th>类型</th><th>Slug</th><th>修改时间</th></tr></thead>
                <tbody>
                  ${recent
                    .map(
                      (item) => `
                        <tr>
                          <td>${escapeHtml(item.title || item.name)}</td>
                          <td>${item.title ? 'exhibition' : 'hall'}</td>
                          <td>${escapeHtml(item.slug)}</td>
                          <td>${escapeHtml(new Date(item.__updatedAt).toLocaleString())}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : '<div class="studio-empty">暂无可读取的修改时间。</div>',
      )}
    </div>
  `;
}

function statCard(label, value, note) {
  return `
    <div class="studio-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </div>
  `;
}

function renderSiteText() {
  const draft = ensureDraft('site', state.content.site);

  return `
    <div class="studio-grid">
      ${workflowBanner('这里管理站点级文字，不负责首页展示顺序。', ['/about', 'SEO', 'Footer'])}
      ${panel(
        '站点文案',
        '品牌、SEO、About 和 Footer 存储在 src/data/site.json。首页大厅相关文字请去 Home Control，避免同一件事藏在两个地方。',
        `
          <form class="studio-form" data-form-kind="site">
            <div class="studio-form-grid">
              ${textField('网站英文标题', 'brand.englishTitle', draft.brand.englishTitle)}
              ${textField('中文副标题', 'brand.chineseSubtitle', draft.brand.chineseSubtitle)}
              ${textField('馆藏标签', 'brand.museumLabel', draft.brand.museumLabel)}
              ${textField('SEO title', 'seo.title', draft.seo.title)}
              ${textareaField('SEO description', 'seo.description', draft.seo.description, {
                full: true,
                rows: 3,
              })}
              ${textField('About SEO title', 'about.seoTitle', draft.about.seoTitle || '')}
              ${textareaField(
                'About SEO description',
                'about.seoDescription',
                draft.about.seoDescription || '',
                {
                  full: true,
                  rows: 3,
                },
              )}
              ${textField('About 区块标签', 'about.sectionLabel', draft.about.sectionLabel || '')}
              ${textField('About 页面标题', 'about.sectionTitle', draft.about.sectionTitle || '')}
              ${paragraphField('About 页面正文', 'about.body', draft.about.body, {
                full: true,
                help: '段落之间空一行。',
              })}
              ${textField('拍摄者标题', 'about.photographerTitle', draft.about.photographerTitle)}
              ${textField('器材标题', 'about.gearTitle', draft.about.gearTitle)}
              ${textareaField('拍摄者说明', 'about.photographer', draft.about.photographer, {
                full: true,
                rows: 3,
              })}
              ${textareaField('器材信息', 'about.gear', draft.about.gear, { full: true, rows: 3 })}
              ${textareaField('Footer 文案', 'footer.note', draft.footer.note, { full: true, rows: 3 })}
              ${textField('Footer 署名', 'footer.copyright', draft.footer.copyright || '')}
            </div>
          </form>
        `,
        saveActions('site', '/about'),
      )}
    </div>
  `;
}

function renderHomeControl() {
  const draft = ensureDraft('home-control', {
    site: clone(state.content.site),
    navigation: clone(state.content.navigation),
    featuredSlug: getFeaturedSlug(),
  });
  const halls = state.content.halls;
  const publishedExhibitions = state.content.exhibitions.filter(
    (exhibition) => exhibition.status === 'published',
  );

  return `
    <div class="studio-grid">
      ${workflowBanner('这里控制观众进入展馆大厅时先看到什么。', ['/', '/halls', '/archive'])}

      ${panel(
        '首页大厅文案',
        '这些文字只影响公开首页，不影响 About 页面。大厅里应保持清楚、克制，避免变成说明书。',
        `
          <form class="studio-form" data-form-kind="home-control-site">
            <div class="studio-form-grid">
              ${textareaField('首页主导语', 'site.home.intro', draft.site.home.intro, {
                full: true,
                rows: 4,
              })}
              ${textareaField('首页补充说明', 'site.home.supplement', draft.site.home.supplement, {
                full: true,
                rows: 4,
              })}
              ${textField('首页主按钮文案', 'site.home.primaryActionLabel', draft.site.home.primaryActionLabel)}
              ${textField('首页次按钮文案', 'site.home.secondaryActionLabel', draft.site.home.secondaryActionLabel)}
              ${textField('展厅入口区块标签', 'site.home.hallsSectionLabel', draft.site.home.hallsSectionLabel)}
              ${textField('展厅入口区块标题', 'site.home.hallsSectionTitle', draft.site.home.hallsSectionTitle)}
              ${textareaField(
                '展厅入口说明',
                'site.home.hallsSectionDescription',
                draft.site.home.hallsSectionDescription,
                {
                  full: true,
                  rows: 3,
                },
              )}
              ${textField('突出展览区块标签', 'site.home.currentSectionLabel', draft.site.home.currentSectionLabel)}
              ${textField('突出展览区块标题', 'site.home.currentSectionTitle', draft.site.home.currentSectionTitle)}
              ${textareaField(
                '突出展览说明',
                'site.home.currentSectionDescription',
                draft.site.home.currentSectionDescription,
                {
                  full: true,
                  rows: 3,
                },
              )}
              ${textField('突出展览卡片标签', 'site.home.featuredLabel', draft.site.home.featuredLabel)}
              ${textField('Archive 区块标签', 'site.home.archiveLabel', draft.site.home.archiveLabel)}
              ${textField('Archive 入口标题', 'site.home.archiveTitle', draft.site.home.archiveTitle)}
              ${textField('Archive 链接文案', 'site.home.archiveLinkLabel', draft.site.home.archiveLinkLabel)}
            </div>
          </form>
        `,
      )}

      ${panel(
        '公开导航',
        '公开导航永远不允许加入 /studio 或 /curator-studio。保存时 API 会再次阻止这些路径。',
        `
          <div class="studio-table-wrap">
            <table class="studio-table">
              <thead><tr><th>显示</th><th>Label</th><th>Href</th><th>Order</th></tr></thead>
              <tbody>
                ${draft.navigation.publicNav
                  .map(
                    (item, index) => `
                      <tr>
                        <td>
                          <label class="studio-checkbox">
                            <input data-nav-index="${index}" data-nav-field="enabled" type="checkbox" ${
                              item.enabled ? 'checked' : ''
                            } />
                            <span>enabled</span>
                          </label>
                        </td>
                        <td><input data-nav-index="${index}" data-nav-field="label" value="${escapeAttr(
                          item.label,
                        )}" /></td>
                        <td><input data-nav-index="${index}" data-nav-field="href" value="${escapeAttr(
                          item.href,
                        )}" /></td>
                        <td><input data-nav-index="${index}" data-nav-field="order" data-value-type="number" type="number" value="${escapeAttr(
                          item.order,
                        )}" /></td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}

      ${panel(
        '首页展示',
        '控制首页是否显示突出展览、展厅入口、Archive 入口，以及哪些展厅出现在首页。',
        `
          <form class="studio-form" data-form-kind="home-control-navigation">
            <div class="studio-form-grid">
              ${checkboxField('首页显示突出展览', 'navigation.home.showFeaturedExhibition', draft.navigation.home.showFeaturedExhibition)}
              ${checkboxField('首页显示展厅入口', 'navigation.home.showHalls', draft.navigation.home.showHalls)}
              ${checkboxField('首页显示 Archive 入口', 'navigation.home.showArchiveEntry', draft.navigation.home.showArchiveEntry)}
              ${checkboxField('首页展示文字启用', 'navigation.home.showIntroText', draft.navigation.home.showIntroText)}
              ${selectField(
                '首页突出显示的展览',
                'featuredSlug',
                draft.featuredSlug,
                [
                  { value: '', label: '不突出显示任何展览' },
                  ...publishedExhibitions.map((exhibition) => ({
                    value: exhibition.slug,
                    label: `${exhibition.title || exhibition.slug} / ${getHallName(
                      exhibition.hallSlug,
                    )}`,
                  })),
                ],
                {
                  full: true,
                  help: '突出显示只是大厅里的临时提示。展览仍然属于它原本的展厅。',
                },
              )}
            </div>
          </form>
          <div class="studio-table-wrap" style="margin-top: 1rem;">
            <table class="studio-table">
              <thead><tr><th>首页显示</th><th>展厅</th><th>Slug</th><th>Order</th><th>Status</th><th>预览</th></tr></thead>
              <tbody>
                ${halls
                  .map(
                    (hall) => `
                      <tr>
                        <td>
                          <label class="studio-checkbox">
                            <input data-home-hall="${escapeAttr(hall.slug)}" type="checkbox" ${
                              draft.navigation.home.hallSlugs.includes(hall.slug) ? 'checked' : ''
                            } />
                            <span>show</span>
                          </label>
                        </td>
                        <td>${escapeHtml(hall.name)} / ${escapeHtml(hall.englishName)}</td>
                        <td>${escapeHtml(hall.slug)}</td>
                        <td>${escapeHtml(hall.order)}</td>
                        <td>${statusPill(hall.status)}</td>
                        <td>
                          <a class="studio-link-button subtle" href="${publicHrefForHall(
                            hall.slug,
                          )}" target="_blank" rel="noreferrer">打开</a>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
        saveActions('home', '/'),
      )}
    </div>
  `;
}

function renderHalls() {
  const halls = state.content.halls;
  const selected = halls.find((hall) => hall.slug === state.selectedHall) || halls[0];

  if (!state.editingNewHall && selected && state.selectedHall !== selected.slug) {
    state.selectedHall = selected.slug;
  }

  const draft =
    state.editingNewHall && state.draftKind === 'hall:_new'
      ? state.draft
      : selected
        ? ensureDraft(`hall:${selected.slug}`, selected)
        : null;

  return `
    <div class="studio-grid">
      ${workflowBanner('这里维护六大展厅的骨架和首页入口。', ['/halls', '/halls/[slug]', '/'])}

      ${panel(
        '展厅列表',
        '六大基础展厅可以 hidden，但不要直接删除。修改 slug 前会提示旧链接和展览引用风险。',
        `
          <div class="studio-toolbar">
            <button class="studio-button" type="button" data-action="new-hall">新建展厅</button>
            <span class="studio-publish-note">新建后保存即发布</span>
          </div>
          <div class="studio-table-wrap">
            <table class="studio-table">
              <thead><tr><th>名称</th><th>English</th><th>Slug</th><th>Status</th><th>Order</th><th>首页</th><th>展览</th><th>操作</th></tr></thead>
              <tbody>
                ${halls
                  .map(
                    (hall) => `
                      <tr>
                        <td>${escapeHtml(hall.name)}</td>
                        <td>${escapeHtml(hall.englishName)}</td>
                        <td>${escapeHtml(hall.slug)}</td>
                        <td>${statusPill(hall.status)}</td>
                        <td>${escapeHtml(hall.order)}</td>
                        <td>${hall.showOnHome ? '是' : '否'}</td>
                        <td>${escapeHtml(getHallExhibitionCount(hall.slug))}</td>
                        <td>
                          <div class="studio-row-actions">
                            <button class="studio-button subtle" type="button" data-select-hall="${escapeAttr(
                              hall.slug,
                            )}">编辑</button>
                            <a class="studio-link-button subtle" href="${publicHrefForHall(
                              hall.slug,
                            )}" target="_blank" rel="noreferrer">预览</a>
                            <button class="studio-button danger" type="button" data-action="delete-hall" data-delete-hall="${escapeAttr(
                              hall.slug,
                            )}">删除</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}

      ${
        draft
          ? panel(
              state.editingNewHall ? '新建展厅' : `编辑展厅：${draft.name}`,
              state.editingNewHall
                ? '新展厅会写入 src/content/halls/*.json。保存后会自动发布到公开展馆。'
                : '展厅数据存储在 src/content/halls/*.json。',
              `
                <form class="studio-form" data-form-kind="hall">
                  <div class="studio-form-grid">
                    ${textField('中文名 name', 'name', draft.name)}
                    ${textField('英文名 englishName', 'englishName', draft.englishName)}
                    ${textField('slug', 'slug', draft.slug, {
                      help: '修改 slug 可能影响旧链接和已有展览引用。',
                    })}
                    ${numberField('order', 'order', draft.order)}
                    ${selectField('status', 'status', draft.status, [
                      { value: 'active', label: 'active' },
                      { value: 'hidden', label: 'hidden' },
                    ])}
                    ${checkboxField('showOnHome / 首页展示', 'showOnHome', draft.showOnHome)}
                    ${textareaField('description / 展厅介绍', 'description', draft.description, {
                      full: true,
                      rows: 6,
                    })}
                    ${commaField('mood / 关键词', 'mood', draft.mood, {
                      full: true,
                      help: '用 / 或逗号分隔关键词。',
                    })}
                    ${textField('cover / 封面路径', 'cover', draft.cover || '', {
                      full: true,
                    })}
                    ${selectField('tone / 视觉气质', 'tone', draft.tone, [
                      { value: 'warm', label: 'warm' },
                      { value: 'blue-gray', label: 'blue-gray' },
                      { value: 'brown-gray', label: 'brown-gray' },
                      { value: 'daily', label: 'daily' },
                      { value: 'monochrome', label: 'monochrome' },
                    ])}
                    ${textField('accent / 强调色', 'accent', draft.accent || '')}
                    ${textField('layoutHint / 布局提示', 'layoutHint', draft.layoutHint || '', {
                      full: true,
                    })}
                  </div>
                </form>
              `,
              saveActions('hall', publicHrefForHall(draft.slug)),
            )
          : ''
      }
    </div>
  `;
}

function renderExhibitions() {
  const exhibitions = filteredExhibitions();
  const selected =
    state.content.exhibitions.find((item) => item.slug === state.selectedExhibition) ||
    state.content.exhibitions[0];
  const draft = selected ? ensureDraft(`exhibition:${selected.slug}`, selected) : null;

  return `
    <div class="studio-grid">
      ${workflowBanner('这里决定哪些展览被公开、隐藏、草稿保存或突出显示。', [
        '/exhibitions/[slug]',
        '/',
        '/archive',
      ])}

      ${panel(
        '展览列表',
        '支持按展厅、状态、featured、日期排序和搜索标题 / 地点 / intro。',
        `
          ${renderExhibitionFilters()}
          <div class="studio-toolbar">
            <button class="studio-button" type="button" data-action="new-exhibition">新建展览</button>
          </div>
          <div class="studio-table-wrap">
            <table class="studio-table">
              <thead><tr><th>标题</th><th>展厅</th><th>Status</th><th>Featured</th><th>日期</th><th>地点</th><th>操作</th></tr></thead>
              <tbody>
                ${exhibitions
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(item.title || '(未命名)')}<br /><span class="studio-help">${escapeHtml(
                          item.slug,
                        )}</span></td>
                        <td>${escapeHtml(getHallName(item.hallSlug))}</td>
                        <td>${statusPill(item.status)}</td>
                        <td>${item.featured ? '是' : '否'}</td>
                        <td>${escapeHtml(item.date || '')}</td>
                        <td>${escapeHtml(item.location || '')}</td>
                        <td>
                          <div class="studio-row-actions">
                            <button class="studio-button subtle" type="button" data-select-exhibition="${escapeAttr(
                              item.slug,
                            )}">编辑</button>
                            ${
                              item.status === 'published'
                                ? `<a class="studio-link-button subtle" href="${publicHrefForExhibition(
                                    item.slug,
                                  )}" target="_blank" rel="noreferrer">预览</a>`
                                : ''
                            }
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}

      ${
        draft
          ? renderExhibitionEditor(draft)
          : panel(
              '暂无展览',
              '',
              '<button class="studio-button" type="button" data-action="new-exhibition">新建第一个展览</button>',
            )
      }
    </div>
  `;
}

function renderExhibitionFilters() {
  const hallOptions = [
    '<option value="all">全部展厅</option>',
    ...state.content.halls.map(
      (hall) =>
        `<option value="${escapeAttr(hall.slug)}" ${
          state.filters.hall === hall.slug ? 'selected' : ''
        }>${escapeHtml(hall.name)}</option>`,
    ),
  ];

  return `
    <div class="studio-filters">
      <div class="studio-field">
        <label>展厅</label>
        <select data-filter="hall">${hallOptions.join('')}</select>
      </div>
      <div class="studio-field">
        <label>Status</label>
        <select data-filter="status">
          ${['all', 'draft', 'published', 'hidden']
            .map(
              (status) =>
                `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${status}</option>`,
            )
            .join('')}
        </select>
      </div>
      <div class="studio-field">
        <label>Featured</label>
        <select data-filter="featured">
          ${[
            ['all', '全部'],
            ['yes', 'featured'],
            ['no', 'not featured'],
          ]
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.filters.featured === value ? 'selected' : ''}>${label}</option>`,
            )
            .join('')}
        </select>
      </div>
      <div class="studio-field">
        <label>排序</label>
        <select data-filter="sort">
          ${[
            ['date-desc', '日期新到旧'],
            ['date-asc', '日期旧到新'],
            ['order-asc', 'displayOrder'],
          ]
            .map(
              ([value, label]) =>
                `<option value="${value}" ${state.filters.sort === value ? 'selected' : ''}>${label}</option>`,
            )
            .join('')}
        </select>
      </div>
      <div class="studio-field">
        <label>搜索</label>
        <input data-filter="query" value="${escapeAttr(state.filters.query)}" placeholder="标题 / 地点 / intro" />
      </div>
    </div>
  `;
}

function filteredExhibitions() {
  let exhibitions = [...state.content.exhibitions];

  if (state.filters.hall !== 'all') {
    exhibitions = exhibitions.filter((item) => item.hallSlug === state.filters.hall);
  }

  if (state.filters.status !== 'all') {
    exhibitions = exhibitions.filter((item) => item.status === state.filters.status);
  }

  if (state.filters.featured !== 'all') {
    exhibitions = exhibitions.filter((item) =>
      state.filters.featured === 'yes' ? item.featured : !item.featured,
    );
  }

  const query = state.filters.query.trim().toLowerCase();
  if (query) {
    exhibitions = exhibitions.filter((item) =>
      [item.title, item.location, item.intro, item.subtitle]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  exhibitions.sort((a, b) => {
    if (state.filters.sort === 'date-asc') {
      return String(a.date).localeCompare(String(b.date));
    }

    if (state.filters.sort === 'order-asc') {
      return (
        (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
        String(b.date).localeCompare(String(a.date))
      );
    }

    return String(b.date).localeCompare(String(a.date));
  });

  return exhibitions;
}

function renderExhibitionEditor(draft) {
  const hallChoices = getActiveHalls().map((hall) => ({
    value: hall.slug,
    label: `${hall.name} / ${hall.slug}`,
  }));
  const preview = draft.status === 'published' ? publicHrefForExhibition(draft.slug) : '';

  return panel(
    `编辑展览：${draft.title || '未命名展览'}`,
    '展览数据存储在 src/content/exhibitions/*.json。published 会进入公开展馆；draft / hidden 不公开。featured 是首页大厅里的“突出显示”。',
    `
      <form class="studio-form" data-form-kind="exhibition">
        <div class="studio-form-grid">
          ${textField('title', 'title', draft.title)}
          ${textField('subtitle', 'subtitle', draft.subtitle || '')}
          ${textField('slug', 'slug', draft.slug, {
            help: '修改 slug 可能影响旧链接。',
          })}
          ${selectField('所属展厅 hallSlug', 'hallSlug', draft.hallSlug, hallChoices)}
          ${textField('date', 'date', asDate(draft.date), { type: 'date' })}
          ${textField('dateLabel', 'dateLabel', draft.dateLabel || '')}
          ${textField('location', 'location', draft.location || '')}
          ${numberField('displayOrder', 'displayOrder', draft.displayOrder ?? '')}
          ${selectField('公开状态 status', 'status', draft.status, [
            { value: 'draft', label: 'draft' },
            { value: 'published', label: 'published' },
            { value: 'hidden', label: 'hidden' },
          ])}
          ${checkboxField('突出显示在首页大厅 / featured', 'featured', draft.featured)}
          ${textField('cover', 'cover', draft.cover || '', { full: true })}
          ${textareaField('intro', 'intro', draft.intro || '', { full: true, rows: 5 })}
          ${textField('SEO title', 'seo.title', draft.seo?.title || '', { full: true })}
          ${textareaField('SEO description', 'seo.description', draft.seo?.description || '', {
            full: true,
            rows: 3,
          })}
          ${textareaField('chapters / 章节预留', 'chaptersText', chaptersToText(draft.chapters), {
            full: true,
            rows: 4,
            help: '每行一个章节标题。Phase 2 只保存为基础章节结构。',
          })}
        </div>
      </form>
    `,
    `${saveActions('exhibition', preview)}
      <button class="studio-button secondary" type="button" data-action="edit-current-photos">管理照片与封面</button>`,
  );
}

function chaptersToText(chapters = []) {
  return chapters.map((chapter) => chapter.title).join('\n');
}

function textToChapters(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => ({ title }));
}

function renderPhotos() {
  const exhibitions = state.content.exhibitions;
  const selected =
    exhibitions.find((item) => item.slug === state.selectedPhotoExhibition) || exhibitions[0];

  if (selected && state.selectedPhotoExhibition !== selected.slug) {
    state.selectedPhotoExhibition = selected.slug;
  }

  const draft = selected ? ensureDraft(`photos:${selected.slug}`, selected) : null;

  if (!draft) {
    return panel(
      '照片信息管理',
      '',
      '<div class="studio-empty">当前还没有展览。请先在 Exhibitions 中新建展览。</div>',
    );
  }

  return `
    <div class="studio-grid">
      ${workflowBanner('这里只管理已有图片的 metadata，不做真实上传。', [
        '/exhibitions/[slug]',
        'cover',
        'photo captions',
      ])}

      ${panel(
        '选择展览',
        'Phase 2 不做真实上传，只管理已有图片路径和 metadata。',
        `
          <div class="studio-toolbar">
            <div class="studio-field" style="min-width: min(100%, 22rem);">
              <label>所属 exhibition</label>
              <select data-photo-exhibition>
                ${exhibitions
                  .map(
                    (item) =>
                      `<option value="${escapeAttr(item.slug)}" ${
                        item.slug === selected.slug ? 'selected' : ''
                      }>${escapeHtml(item.title || item.slug)}</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <a class="studio-link-button subtle" href="${publicHrefForExhibition(
              draft.slug,
            )}" target="_blank" rel="noreferrer">打开所属展览预览</a>
          </div>
        `,
      )}

      ${panel(
        `照片 metadata：${draft.title || draft.slug}`,
        '可以新增、删除 metadata 记录，调整排序，设置封面，并编辑 alt / caption / location / date / orientation。',
        `
          <div class="studio-toolbar">
            <button class="studio-button" type="button" data-action="add-photo">新增照片 metadata</button>
            <button class="studio-button" type="button" data-action="save-photos">保存照片信息</button>
            <button class="studio-button secondary" type="button" data-action="reset-draft">重置</button>
          </div>
          <div class="studio-photo-list">
            ${draft.photos?.length ? draft.photos.map(renderPhotoItem).join('') : '<div class="studio-empty">还没有照片 metadata。</div>'}
          </div>
        `,
      )}
    </div>
  `;
}

function renderPhotoItem(photo, index) {
  const src = photo.src || '';
  const order = photo.order ?? index + 1;

  return `
    <article class="studio-photo-item" data-photo-index="${index}">
      <div class="studio-photo-preview">
        ${
          src
            ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(photo.alt || '')}" loading="lazy" />`
            : '<span>No image path</span>'
        }
      </div>
      <div class="studio-form">
        <div class="studio-toolbar">
          <span class="studio-pill">#${index + 1}</span>
          ${photo.isCover ? '<span class="studio-pill ok">cover</span>' : ''}
          <button class="studio-button subtle" type="button" data-photo-action="up" data-photo-index="${index}">上移</button>
          <button class="studio-button subtle" type="button" data-photo-action="down" data-photo-index="${index}">下移</button>
          <button class="studio-button subtle" type="button" data-photo-action="cover" data-photo-index="${index}">设为封面</button>
          <button class="studio-button danger" type="button" data-photo-action="delete" data-photo-index="${index}">删除 metadata</button>
        </div>
        <div class="studio-form-grid">
          ${photoField(index, 'src', 'src', src, { full: true })}
          ${photoField(index, 'alt', 'alt', photo.alt || '')}
          ${photoField(index, 'caption', 'caption', photo.caption || '')}
          ${photoField(index, 'location', 'location', photo.location || '')}
          ${photoField(index, 'date', 'date', asDate(photo.date), { type: 'date' })}
          ${photoSelect(index, 'orientation', 'orientation', photo.orientation || 'unknown')}
          ${photoField(index, 'order', 'display order', order, { type: 'number' })}
        </div>
      </div>
    </article>
  `;
}

function photoField(index, field, label, value, options = {}) {
  return `
    <div class="studio-field ${options.full ? 'full' : ''}">
      <label>${label}</label>
      <input data-photo-index="${index}" data-photo-field="${field}" ${
        options.type ? `type="${options.type}"` : 'type="text"'
      } ${options.type === 'number' ? 'data-value-type="number"' : ''} value="${escapeAttr(value ?? '')}" />
    </div>
  `;
}

function photoSelect(index, field, label, value) {
  return `
    <div class="studio-field">
      <label>${label}</label>
      <select data-photo-index="${index}" data-photo-field="${field}">
        ${['landscape', 'portrait', 'square', 'unknown']
          .map(
            (item) =>
              `<option value="${item}" ${item === value ? 'selected' : ''}>${item}</option>`,
          )
          .join('')}
      </select>
    </div>
  `;
}

function renderHealth() {
  const health = state.content.health;
  const sorted = [...health.results].sort((a, b) => {
    const weight = { error: 0, warning: 1, info: 2 };
    return weight[a.severity] - weight[b.severity];
  });

  return `
    <div class="studio-grid">
      ${workflowBanner('保存会自动备份、构建并发布；这里负责发现发布前后的内容风险。', [
        'health',
        'build',
        'current release',
      ])}

      <div class="studio-grid cols-3">
        ${statCard('Error', health.counts.error, '必须修复')}
        ${statCard('Warning', health.counts.warning, '建议修复')}
        ${statCard('Info', health.counts.info, '普通提示')}
      </div>
      ${panel(
        '内容健康检查',
        `上次检查：${new Date(health.checkedAt).toLocaleString()}`,
        sorted.length
          ? `<div class="studio-issue-list">
              ${sorted
                .map(
                  (item) => `
                    <article class="studio-issue">
                      <div>${healthPill(item.severity)}</div>
                      <div>
                        <h3>${escapeHtml(item.title)}</h3>
                        <p>${escapeHtml(item.detail || '')}</p>
                        <p class="studio-help">${escapeHtml(item.code)}${item.source ? ` / ${escapeHtml(item.source)}` : ''}</p>
                      </div>
                    </article>
                  `,
                )
                .join('')}
            </div>`
          : '<div class="studio-empty">未发现内容问题。</div>',
        '<button class="studio-button secondary" type="button" data-action="refresh-content">重新检查</button>',
      )}
    </div>
  `;
}

function renderDocs() {
  const docs = [
    {
      title: 'README.md',
      path: 'C:\\Users\\Administrator\\OneDrive\\Desktop\\编程项目\\一鸣的展\\README.md',
      note: '本地运行、Studio 使用、内容编辑和常用命令。',
    },
    {
      title: 'PROJECT_BRIEF.md',
      path: 'C:\\Users\\Administrator\\OneDrive\\Desktop\\编程项目\\一鸣的展\\PROJECT_BRIEF.md',
      note: '项目定位、Public / Studio 边界、展厅原则和阶段路线图。',
    },
    {
      title: 'DEPLOYMENT.md',
      path: 'C:\\Users\\Administrator\\OneDrive\\Desktop\\编程项目\\一鸣的展\\DEPLOYMENT.md',
      note: '静态部署、生产禁用 /studio、回滚和注意事项。',
    },
  ];

  return `
    <div class="studio-grid">
      ${workflowBanner('这里是维护说明，不影响公开页面。', [
        'README.md',
        'PROJECT_BRIEF.md',
        'DEPLOYMENT.md',
      ])}
      ${panel(
        '项目文档入口',
        '这些文档不通过公开站点发布给访客；它们是本地维护和部署时的项目说明。',
        `
          <div class="studio-docs">
            ${docs
              .map(
                (doc) => `
                  <article class="studio-doc-card">
                    <h3>${escapeHtml(doc.title)}</h3>
                    <p>${escapeHtml(doc.note)}</p>
                    <code class="studio-code">${escapeHtml(doc.path)}</code>
                  </article>
                `,
              )
              .join('')}
          </div>
        `,
      )}
    </div>
  `;
}

function bindRenderedControls() {
  root.querySelectorAll('[data-bind]').forEach((input) => {
    input.addEventListener('input', handleBoundInput);
    input.addEventListener('change', handleBoundInput);
  });

  root.querySelectorAll('[data-nav-field]').forEach((input) => {
    input.addEventListener('input', handleNavigationInput);
    input.addEventListener('change', handleNavigationInput);
  });

  root.querySelectorAll('[data-home-hall]').forEach((input) => {
    input.addEventListener('change', handleHomeHallToggle);
  });

  root.querySelectorAll('[data-select-hall]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!guardDirty()) {
        return;
      }
      state.selectedHall = button.dataset.selectHall;
      state.editingNewHall = false;
      state.draft = null;
      render();
    });
  });

  root.querySelectorAll('[data-select-exhibition]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!guardDirty()) {
        return;
      }
      state.selectedExhibition = button.dataset.selectExhibition;
      state.editingNewExhibition = false;
      state.draft = null;
      render();
    });
  });

  root.querySelectorAll('[data-filter]').forEach((input) => {
    input.addEventListener('input', handleFilterInput);
    input.addEventListener('change', handleFilterInput);
  });

  root.querySelectorAll('[data-photo-exhibition]').forEach((select) => {
    select.addEventListener('change', () => {
      if (!guardDirty()) {
        select.value = state.selectedPhotoExhibition;
        return;
      }
      state.selectedPhotoExhibition = select.value;
      state.draft = null;
      render();
    });
  });

  root.querySelectorAll('[data-photo-field]').forEach((input) => {
    input.addEventListener('input', handlePhotoInput);
    input.addEventListener('change', handlePhotoInput);
  });
}

function handleBoundInput(event) {
  const input = event.currentTarget;
  let value = input.value;

  if (input.dataset.valueType === 'boolean') {
    value = input.checked;
  } else if (input.dataset.valueType === 'number') {
    value = input.value === '' ? undefined : Number(input.value);
  } else if (input.dataset.valueType === 'comma-array') {
    value = input.value
      .split(/[\/,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (input.dataset.valueType === 'paragraph-array') {
    value = input.value
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (input.dataset.bind === 'chaptersText') {
    state.draft.chapters = textToChapters(value);
  } else {
    setByPath(state.draft, input.dataset.bind, value);
  }

  markDirty();
}

function handleNavigationInput(event) {
  const input = event.currentTarget;
  const navigationDraft = getNavigationDraft();
  const item = navigationDraft.publicNav[Number(input.dataset.navIndex)];
  const field = input.dataset.navField;

  if (field === 'enabled') {
    item.enabled = input.checked;
  } else if (field === 'order') {
    item.order = input.value === '' ? undefined : Number(input.value);
  } else {
    item[field] = input.value;
  }

  if (
    field === 'href' &&
    (String(item.href).startsWith('/studio') || String(item.href).startsWith('/curator-studio'))
  ) {
    setStatus('Studio path cannot be public nav', 'error');
  } else {
    markDirty();
  }
}

function handleHomeHallToggle(event) {
  const input = event.currentTarget;
  const slug = input.dataset.homeHall;
  const navigationDraft = getNavigationDraft();
  const current = new Set(navigationDraft.home.hallSlugs);

  if (input.checked) {
    current.add(slug);
  } else {
    current.delete(slug);
  }

  navigationDraft.home.hallSlugs = state.content.halls
    .map((hall) => hall.slug)
    .filter((hallSlug) => current.has(hallSlug));
  markDirty();
}

function handleFilterInput(event) {
  const input = event.currentTarget;
  state.filters[input.dataset.filter] = input.value;
  render();
}

function handlePhotoInput(event) {
  const input = event.currentTarget;
  const index = Number(input.dataset.photoIndex);
  const field = input.dataset.photoField;
  let value = input.value;

  if (input.dataset.valueType === 'number') {
    value = input.value === '' ? undefined : Number(input.value);
  }

  state.draft.photos[index][field] = value;
  markDirty();
}

document.addEventListener('click', async (event) => {
  const moduleJump = event.target.closest('[data-module-jump]');
  if (moduleJump) {
    changeModule(moduleJump.dataset.moduleJump);
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) {
    const navButton = event.target.closest('[data-module]');
    if (navButton) {
      changeModule(navButton.dataset.module);
    }
    return;
  }

  if (action === 'reset-draft') {
    if (!guardDirty()) {
      return;
    }
    state.draft = null;
    state.draftKind = null;
    state.editingNewHall = false;
    markClean('Reset');
    render();
    return;
  }

  if (action === 'refresh-content') {
    if (!guardDirty()) {
      return;
    }
    state.draft = null;
    state.editingNewHall = false;
    await loadContent();
    return;
  }

  if (action === 'logout') {
    if (!guardDirty()) {
      return;
    }

    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    state.authenticated = false;
    state.content = null;
    state.draft = null;
    state.editingNewHall = false;
    renderLogin('已退出登录。');
    return;
  }

  if (action === 'new-hall') {
    if (!guardDirty()) {
      return;
    }
    state.module = 'halls';
    state.editingNewHall = true;
    const hall = createNewHall();
    state.selectedHall = hall.slug;
    state.draftKind = 'hall:_new';
    state.draft = hall;
    state.dirty = true;
    setStatus('New hall unsaved', 'dirty');
    render();
    return;
  }

  if (action === 'delete-hall') {
    await deleteHall(event.target.closest('[data-delete-hall]')?.dataset.deleteHall);
    return;
  }

  if (action === 'new-exhibition') {
    if (!guardDirty()) {
      return;
    }
    state.module = 'exhibitions';
    state.editingNewHall = false;
    state.editingNewExhibition = true;
    const exhibition = createNewExhibition();
    state.selectedExhibition = exhibition.slug;
    state.draftKind = `exhibition:${exhibition.slug}`;
    state.draft = exhibition;
    state.dirty = true;
    setStatus('New draft unsaved', 'dirty');
    render();
    return;
  }

  if (action === 'edit-current-photos') {
    if (state.dirty) {
      window.alert('请先保存或重置当前展览修改，再进入照片与封面。');
      return;
    }

    state.selectedPhotoExhibition = state.selectedExhibition;
    changeModule('photos');
    return;
  }

  if (action === 'add-photo') {
    state.draft.photos = state.draft.photos || [];
    state.draft.photos.push({
      src: '',
      alt: '',
      caption: '',
      location: '',
      date: state.draft.date || '',
      orientation: 'unknown',
      order: state.draft.photos.length + 1,
    });
    markDirty();
    render();
    return;
  }

  if (action.startsWith('save-')) {
    await saveCurrent(action.replace('save-', ''));
  }
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-photo-action]');
  if (!button) {
    return;
  }

  const index = Number(button.dataset.photoIndex);
  const action = button.dataset.photoAction;
  const photos = state.draft.photos || [];

  if (action === 'up' && index > 0) {
    [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]];
  }

  if (action === 'down' && index < photos.length - 1) {
    [photos[index + 1], photos[index]] = [photos[index], photos[index + 1]];
  }

  if (action === 'cover') {
    photos.forEach((photo, photoIndex) => {
      photo.isCover = photoIndex === index;
    });
    state.draft.cover = photos[index].src || state.draft.cover;
  }

  if (action === 'delete') {
    if (!window.confirm('确定删除这条照片 metadata 吗？这不会删除图片文件。')) {
      return;
    }
    photos.splice(index, 1);
  }

  photos.forEach((photo, photoIndex) => {
    photo.order = photoIndex + 1;
  });

  markDirty();
  render();
});

function changeModule(module) {
  const nextModule = normalizeModule(module);

  if (nextModule === state.module) {
    return;
  }

  if (!guardDirty()) {
    return;
  }

  state.module = nextModule;
  state.draft = null;
  state.draftKind = null;
  state.editingNewHall = false;
  state.editingNewExhibition = false;
  render();
}

async function saveCurrent(kind) {
  try {
    setStatus('Saving', 'dirty');

    if (kind === 'site') {
      const result = await post('/site', state.draft);
      await reloadAfterSave('site', result);
      return;
    }

    if (kind === 'home') {
      const result = await post('/home', state.draft);
      await reloadAfterSave('home control', result);
      return;
    }

    if (kind === 'navigation') {
      const result = await post('/navigation', state.draft);
      await reloadAfterSave('navigation', result);
      return;
    }

    if (kind === 'hall') {
      const oldSlug = state.editingNewHall ? '_new' : state.selectedHall;
      if (!state.editingNewHall && oldSlug !== state.draft.slug) {
        const ok = window.confirm('修改展厅 slug 可能影响旧链接和已有展览引用。确定继续吗？');
        if (!ok) {
          setStatus('Save cancelled', '');
          return;
        }
      }
      const result = await post(`/halls/${oldSlug}`, state.draft);
      state.selectedHall = result.slug;
      state.editingNewHall = false;
      await reloadAfterSave('hall', result);
      return;
    }

    if (kind === 'exhibition' || kind === 'photos') {
      const oldSlug = state.editingNewExhibition ? '_new' : state.selectedExhibition;
      if (!state.editingNewExhibition && oldSlug !== state.draft.slug) {
        const ok = window.confirm('修改展览 slug 可能影响旧链接。确定继续吗？');
        if (!ok) {
          setStatus('Save cancelled', '');
          return;
        }
      }

      normalizePhotos(state.draft);
      const result = await post(`/exhibitions/${oldSlug}`, state.draft);
      state.selectedExhibition = result.slug;
      state.selectedPhotoExhibition = result.slug;
      state.editingNewExhibition = false;
      await reloadAfterSave(kind, result);
    }
  } catch (error) {
    setStatus('Save failed', 'error');
    window.alert(`保存失败：\n${error.message || String(error)}`);
  }
}

async function reloadAfterSave(kind, result) {
  state.draft = null;
  state.draftKind = null;
  await loadContent();
  markClean(`${kind} saved${publishSummary(result?.publish)}`);
}

function publishSummary(publish) {
  if (!publish) {
    return '';
  }

  if (publish.published) {
    return ' / rebuilt + published';
  }

  if (publish.built) {
    return ' / rebuilt';
  }

  return ' / saved only';
}

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    state.authenticated = false;
    renderLogin('登录已过期，请重新登录。');
    throw new Error('Authentication required.');
  }

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

async function deleteHall(slug) {
  if (!slug) {
    return;
  }

  if (!guardDirty()) {
    return;
  }

  const hall = state.content.halls.find((item) => item.slug === slug);
  if (!hall) {
    window.alert(`找不到展厅：${slug}`);
    return;
  }

  const count = getHallExhibitionCount(slug);
  if (count > 0) {
    window.alert(
      `不能删除「${hall.name}」。当前有 ${count} 个展览仍然引用这个展厅，请先移动或隐藏相关展览。`,
    );
    return;
  }

  let confirmation = slug;
  let confirmFoundation = false;

  if (isFoundationalHall(slug)) {
    confirmation = window.prompt(
      `「${hall.name}」是基础展厅。更推荐改为 hidden。若确实要删除，请输入 slug：${slug}`,
      '',
    );
    if (confirmation !== slug) {
      setStatus('Delete cancelled', '');
      return;
    }
    confirmFoundation = true;
  } else {
    const ok = window.confirm(
      `确定删除展厅「${hall.name}」吗？删除前会自动备份，保存后会自动发布。`,
    );
    if (!ok) {
      setStatus('Delete cancelled', '');
      return;
    }
  }

  try {
    setStatus('Deleting hall', 'dirty');
    const result = await post(`/halls/${slug}/delete`, { confirmation, confirmFoundation });
    state.selectedHall = state.content.halls.find((item) => item.slug !== slug)?.slug || null;
    state.editingNewHall = false;
    await reloadAfterSave('hall deleted', result);
  } catch (error) {
    setStatus('Delete failed', 'error');
    window.alert(`删除失败：\n${error.message || String(error)}`);
  }
}

function createNewHall() {
  const existing = new Set(state.content.halls.map((item) => item.slug));
  let slug = 'new-hall';
  let index = 2;

  while (existing.has(slug)) {
    slug = `new-hall-${index}`;
    index += 1;
  }

  const nextOrder = Math.max(0, ...state.content.halls.map((hall) => Number(hall.order) || 0)) + 1;

  return {
    slug,
    name: '新展厅',
    englishName: 'New Hall',
    description: '这里写这个展厅的观看边界、气质和收纳内容。',
    mood: ['待整理'],
    status: 'hidden',
    order: nextOrder,
    showOnHome: false,
    cover: '',
    tone: 'warm',
    accent: '',
    layoutHint: '',
  };
}

function createNewExhibition() {
  const existing = new Set(state.content.exhibitions.map((item) => item.slug));
  let slug = 'untitled-exhibition';
  let index = 2;

  while (existing.has(slug)) {
    slug = `untitled-exhibition-${index}`;
    index += 1;
  }

  return {
    slug,
    title: '未命名展览',
    subtitle: '',
    hallSlug: getActiveHalls()[0]?.slug || state.content.halls[0]?.slug || 'travel',
    date: new Date().toISOString().slice(0, 10),
    dateLabel: '',
    location: '',
    cover: '',
    intro: '',
    status: 'draft',
    featured: false,
    displayOrder: undefined,
    chapters: [],
    seo: {
      title: '',
      description: '',
    },
    photos: [],
  };
}

function normalizePhotos(exhibition) {
  exhibition.photos = exhibition.photos || [];
  exhibition.photos.forEach((photo, index) => {
    photo.order = photo.order ?? index + 1;
    photo.orientation = photo.orientation || 'unknown';

    if (photo.isCover) {
      exhibition.cover = photo.src;
    }
  });
}

checkSession();
