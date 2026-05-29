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

本地预览：

```bash
pnpm preview
```

构建产物位于 `dist/`。Phase 1 部署为静态站，不需要服务器安装项目依赖。Playwright 只用于本地渲染 QA，不随部署产物上传。

## 服务器部署目标

服务器信息来自本地服务器说明文档。

- SSH：`ssh server`
- 公开访问：`http://8.138.150.200:8080/`
- Nginx 站点配置：`/www/server/panel/vhost/nginx/photo-exhibition.conf`
- 新站根目录：`/www/wwwroot/photo-exhibition-site`
- 发布目录：`/www/wwwroot/photo-exhibition-site/releases/<timestamp>/`
- 当前版本软链：`/www/wwwroot/photo-exhibition-site/current`

旧服务：

- PM2 应用：`photo-exhibition`
- 端口：`3000`
- 旧目录：`/www/wwwroot/photo-exhibition-site`

Phase 1 新站会接管旧服务。执行部署前必须备份旧站。

## 发布流程

1. 本地运行检查和构建。
2. 在服务器创建旧站备份：

```bash
mkdir -p /www/backups/photo-exhibition-site
tar --exclude='node_modules' -czf /www/backups/photo-exhibition-site/legacy-<timestamp>.tar.gz -C /www/wwwroot photo-exhibition-site
```

3. 停止旧 PM2 应用：

```bash
pm2 stop photo-exhibition
pm2 delete photo-exhibition
```

4. 上传本地 `dist/` 到新 release 目录。
5. 更新 `current` 软链指向最新 release。
6. 将 Nginx 改为直接服务静态文件：

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

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(jpg|jpeg|png|gif|webp|avif|css|js|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
```

7. 重载 Nginx：

```bash
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
```

8. 验证：

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/studio
```

公网验证：

```bash
curl -I http://8.138.150.200:8080/
curl -I http://8.138.150.200:8080/studio
```

## Curator Studio 上线注意事项

`/studio` 是私人策展台，不属于公开展馆。生产环境在 Phase 1 应禁止公开访问。

未来开放 `/studio` 前必须满足至少一种条件：

- 仅本地运行，不部署到公网。
- 有可靠鉴权。
- 有清晰的上传、图片压缩、EXIF 读取、metadata 生成和发布流程。
- 若使用 Supabase，必须正确配置 Auth、RLS、Storage 权限和服务端密钥边界。

## 回滚方式

如果当前 release 出问题：

1. 查看可用版本：

```bash
ls -la /www/wwwroot/photo-exhibition-site/releases
```

2. 将 `current` 指回上一个 release：

```bash
ln -sfn /www/wwwroot/photo-exhibition-site/releases/<previous> /www/wwwroot/photo-exhibition-site/current
/www/server/nginx/sbin/nginx -s reload
```

3. 如果需要回到旧 PM2 站点，先从 `/www/backups/photo-exhibition-site/legacy-<timestamp>.tar.gz` 恢复，并重新启动对应 PM2 配置。恢复旧站前不要删除备份。

## 常见问题

- `pnpm` 不存在：先全局安装 `npm install -g pnpm`。
- `pnpm` 拦截 `sharp` / `esbuild` 构建脚本：运行 `pnpm approve-builds --all` 后重新 `pnpm install`。
- 服务器内存较小：优先本地构建，只上传 `dist/`，不要在服务器上安装依赖和构建。
- `/studio` 公开可访问：检查 Nginx 中 `/studio` 的 404 规则是否生效。
- 图片太大：不要上传原片，先生成网页展示图、封面图和缩略图。
