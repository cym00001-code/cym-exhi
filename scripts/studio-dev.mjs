import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const packageRunner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function spawnPackage(args) {
  if (process.platform !== 'win32') {
    return spawn(packageRunner, args, { cwd: projectRoot, stdio: 'inherit' });
  }

  return spawn('cmd.exe', ['/d', '/s', '/c', [packageRunner, ...args].join(' ')], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

const children = [
  spawn(process.execPath, [path.join(scriptDir, 'studio-server.mjs')], {
    cwd: projectRoot,
    stdio: 'inherit',
  }),
  spawnPackage(['exec', 'astro', 'dev', '--host', '127.0.0.1', '--port', '4321']),
];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
