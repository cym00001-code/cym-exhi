# YIMING PHOTO ARCHIVE

一鸣私人摄影馆是一个长期维护的私人摄影网页展览馆。它不是普通相册，不是商业摄影接单作品集，也不是博客。公开页面面向访客观看展厅、展览、照片和文字；Curator Studio 面向站点所有者管理内容。

## 技术栈

- Astro + TypeScript
- Astro Content Collections
- Astro `astro:assets` 图片优化
- pnpm
- 全局 CSS tokens + 组件局部样式
- Astro View Transitions / 轻量滚动显现
- Node.js Curator Studio API
- PM2 + Nginx 云端运行

当前不使用 Supabase、数据库、商业 CMS、Next.js、Vue 或大型 React 应用架构。

## 本地运行

公开展馆开发：

```bash
pnpm install
pnpm dev
```

带 Curator Studio API 的本地开发：

```bash
pnpm studio
```

本地 Studio 入口：

- 页面：`http://127.0.0.1:4321/curator-studio`
- API：`http://127.0.0.1:8787/api/curator-studio`
- 本地默认密码：`local-studio`

生产环境必须使用 `.env` 中的 `STUDIO_PASSWORD_HASH` 和 `STUDIO_SESSION_SECRET`，不要使用默认本地密码。

## 常用命令

```bash
pnpm check
pnpm build
pnpm preview
pnpm format
pnpm format:check
```

## 页面清单

- `/`：展馆大厅
- `/halls`：展厅总览
- `/halls/[slug]`：单个展厅
- `/exhibitions/[slug]`：单个展览
- `/archive`：展览归档
- `/about`：关于页面
- `/curator-studio`：受保护的私人策展台

`/studio` 不再作为入口，也不进入公开导航。

## 六大展厅

展厅内容位于 `src/content/halls`，由 Content Collections 校验。当前基础展厅：

- `city`：城市展厅 / City Hall
- `travel`：旅行展厅 / Travel Hall
- `campus`：校园展厅 / Campus
- `still-life`：静物 / 生活展厅 / Still Life
- `daily-notes`：日常札记 / Daily Notes
- `experiments`：黑白 / 实验展厅 / Experiments

`校园展厅` 是宽口径校园空间，不以剧场、舞台、话剧作为核心定义。剧场、舞台、话剧以后可以作为校园展厅下的具体展览，例如《幕前与幕后》。

`日常札记` 用于收纳较轻、较散、难以归入明确主题但仍经过选择的日常片段。它不是垃圾桶，也不是随手乱放的朋友圈相册。

## 可编辑内容

Curator Studio 可管理：

- 全站文案：`src/data/site.json`
- 公开导航与首页展示：`src/data/navigation.json`
- 六大展厅：`src/content/halls/*.json`
- 展览 metadata：`src/content/exhibitions/*.json`
- 照片 metadata：展览 JSON 中的 `photos`
- 内容健康检查

保存时 API 会先写入 `.studio-backups/` 轻量备份，再写回内容文件。云端开启发布模式后，保存会触发 `pnpm build` 并更新静态 `current` 发布目录。

## 添加展览

展览内容位于 `src/content/exhibitions`。公开页面只显示 `status: "published"` 的展览。`draft` 和 `hidden` 默认不公开。

最小结构示例：

```json
{
  "slug": "example-exhibition",
  "title": "展览标题",
  "subtitle": "展览副标题",
  "hallSlug": "travel",
  "date": "2026-05-30",
  "location": "地点",
  "cover": "/src/assets/exhibitions/example/cover.webp",
  "intro": "展览介绍。",
  "status": "published",
  "featured": false,
  "photos": []
}
```

## 图片策略

公开网页不直接使用原始大图。原片保存在本地硬盘、云盘或独立备份；项目内只放网页展示图、封面图和必要缩略图。照片 metadata 必须尽量填写 `alt`、`caption`、`orientation`，避免布局跳动和无障碍信息缺失。

## Public Exhibition / Curator Studio 边界

Public Exhibition 是公开展馆：

- 只负责观看
- 不出现上传、编辑、排序、管理操作
- 继续保持静态 Astro 页面

Curator Studio 是私人策展台：

- 路径：`/curator-studio`
- API：`/api/curator-studio`
- 需要鉴权登录
- 不出现在公开导航
- 不与公开展览页共用展示布局逻辑
- 负责编辑内容、备份、构建并发布静态展馆

## 当前阶段

Phase 2 Final：建立云端受保护 Curator Studio，让内容修改真正作用于展馆，同时继续保持公开页面的静态、克制和展览感。

## 下一阶段建议

- 完成真实图片导入和压缩工作流。
- 增加多展览内容和更细的展览章节结构。
- 为 Curator Studio 增加图片衍生图生成和 EXIF 读取。
- 继续避免数据库和复杂线上后台，除非未来需求明确升级。
