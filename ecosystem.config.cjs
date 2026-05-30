const path = require('node:path');

const nodeBin = process.env.STUDIO_NODE_BIN || '/opt/node-v22/bin/node';
const nodeDir = path.dirname(nodeBin);

module.exports = {
  apps: [
    {
      name: 'photo-exhibition',
      script: 'scripts/studio-server.mjs',
      cwd: '/www/wwwroot/photo-exhibition-site/app',
      interpreter: nodeBin,
      env: {
        NODE_ENV: 'production',
        PATH: `${nodeDir}:${process.env.PATH || ''}`,
        STUDIO_HOST: '127.0.0.1',
        STUDIO_API_PORT: '3000',
        STUDIO_PATH: '/curator-studio',
        STUDIO_API_BASE: '/api/curator-studio',
        STUDIO_PUBLISH_MODE: 'release',
        STUDIO_AUTO_BUILD: '1',
        STUDIO_RELEASES_DIR: '/www/wwwroot/photo-exhibition-site/releases',
        STUDIO_CURRENT_LINK: '/www/wwwroot/photo-exhibition-site/current',
      },
      max_memory_restart: '512M',
    },
  ],
};
