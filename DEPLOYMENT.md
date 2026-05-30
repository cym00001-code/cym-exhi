# DEPLOYMENT

## Git 远程仓库

远程仓库：

```bash
https://github.com/cym00001-code/cym-exhi.git
```

本地默认分支使用 `main`。不要提交 `.env`、服务器密码、token、密钥或原始大图。

## 本地构建流程

```bash
pnpm install
pnpm check
pnpm build
```

带 Studio API 的本地开发：

```bash
pnpm studio
```

## 服务器目标

- SSH：`ssh server`
- 公开访问：`http://8.138.150.200:8080/`
- Studio：`http://8.138.150.200:8080/curator-studio`
- Nginx 配置：`/www/server/panel/vhost/nginx/photo-exhibition.conf`
- 项目根目录：`/www/wwwroot/photo-exhibition-site`
- 应用目录：`/www/wwwroot/photo-exhibition-site/app`
- 静态发布目录：`/www/wwwroot/photo-exhibition-site/releases/<timestamp>/`
- 当前静态软链：`/www/wwwroot/photo-exhibition-site/current`
- PM2 应用：`photo-exhibition`
- API 端口：`127.0.0.1:3000`

## 云端架构

Nginx 直接服务 `current` 中的 Astro 静态站：

- 公开页面为静态文件。
- `/curator-studio` 也是静态页面，但没有登录无法读取内容。
- `/api/curator-studio` 反向代理到 PM2 内网 API。
- `/studio` 继续返回 404。

PM2 API 负责：

- 鉴权登录与 HttpOnly session cookie。
- 读取 `src/data` 与 `src/content`。
- 保存前备份到 `.studio-backups/`。
- 写回 JSON 内容文件。
- 保存后运行 `pnpm build`。
- 将 `dist/` 复制到新 release。
- 更新 `current` 软链。

## 环境变量

服务器 `.env` 必须只存在于服务器或本机未跟踪文件，不得提交。

需要配置：

```bash
STUDIO_PATH=/curator-studio
STUDIO_API_BASE=/api/curator-studio
STUDIO_HOST=127.0.0.1
STUDIO_API_PORT=3000
STUDIO_PASSWORD_HASH=sha256:<hash>
STUDIO_SESSION_SECRET=<long-random-secret>
STUDIO_SESSION_HOURS=8
STUDIO_PUBLISH_MODE=release
STUDIO_AUTO_BUILD=1
STUDIO_RELEASES_DIR=/www/wwwroot/photo-exhibition-site/releases
STUDIO_CURRENT_LINK=/www/wwwroot/photo-exhibition-site/current
```

生成密码 hash：

```bash
node -e "console.log(require('crypto').createHash('sha256').update('your-password').digest('hex'))"
```

## Nginx 示例

```nginx
server {
    listen 8080;
    server_name 8.138.150.200;

    root /www/wwwroot/photo-exhibition-site/current;
    index index.html;

    location = /studio {
        return 404;
    }

    location ^~ /studio/ {
        return 404;
    }

    location ^~ /api/curator-studio/ {
        proxy_pass http://127.0.0.1:3000/api/curator-studio/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(jpg|jpeg|png|gif|webp|avif|css|js|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
```

## 部署流程

1. 本地运行 `pnpm check` 和 `pnpm build`。
2. 打包项目源码，排除 `node_modules`、`dist`、`.git`、`.env`、`.studio-backups`。
3. 上传到服务器 `/www/wwwroot/photo-exhibition-site/app`。
4. 在服务器 app 目录安装依赖。
5. 确认服务器 `.env` 已配置 Studio 密码 hash 和 session secret。
6. 运行 `pnpm build`，复制 `dist` 到新 release，并更新 `current`。
7. 启动或重启 PM2：`pm2 start ecosystem.config.cjs --update-env`。
8. 更新并重载 Nginx。

## 验证

```bash
pm2 status photo-exhibition
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/studio
curl -I http://127.0.0.1:8080/curator-studio
curl -I http://127.0.0.1:8080/halls/campus/
curl -i http://127.0.0.1:8080/api/curator-studio/content
```

预期：

- `/` 返回 200。
- `/studio` 返回 404。
- `/curator-studio` 返回 200。
- 未登录访问 `/api/curator-studio/content` 返回 401。
- 登录后 Studio 可读取内容、保存、备份并发布。

## 回滚方式

查看可用 release：

```bash
ls -la /www/wwwroot/photo-exhibition-site/releases
```

回滚：

```bash
ln -sfn /www/wwwroot/photo-exhibition-site/releases/<previous> /www/wwwroot/photo-exhibition-site/current
/www/server/nginx/sbin/nginx -s reload
```

如果 API 代码出问题，先回滚 Git 工作树或重新上传上一版 app，再重启 PM2。不要删除 `.env`、`data/`、`releases/` 或 `.studio-backups/`。

## 常见问题

- `pnpm` 不存在：先安装 pnpm。
- Node 版本不满足 Astro：升级服务器 Node，或使用指定 Node 运行 PM2 和构建。
- 保存成功但页面没变：检查 API publish 返回、`pnpm build` 日志和 `current` 软链。
- `/curator-studio` 无法登录：检查 `.env` 中 `STUDIO_PASSWORD_HASH` 和 `STUDIO_SESSION_SECRET`。
- `/studio` 公开可访问：检查 Nginx 404 规则。
- 内存不足：停止无关旧服务，避免并发构建。
