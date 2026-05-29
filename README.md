# YIMING PHOTO ARCHIVE

一鸣私人摄影馆是一个长期维护的私人摄影网页展览馆。它不是普通相册，不是商业摄影接单作品集，也不是博客。公开页面面向访客观看展厅、展览、照片和文字；未来的私人策展台面向站点所有者整理内容，不混入公开展览体验。

## 技术栈

- Astro + TypeScript
- Astro Content Collections
- Astro `astro:assets` 图片优化
- pnpm
- 全局 CSS tokens + 组件局部样式
- Astro View Transitions / 轻量滚动显现
- Playwright 本地渲染 QA

Phase 1 不使用数据库、登录系统、商业 CMS、Next.js、Vue 或大型 React 应用架构。Supabase 只作为未来线上 Curator Studio 的候选方案记录，不在当前公开站点接入。

## 本地运行

```bash
pnpm install
pnpm dev
```

本地预览生产构建：

```bash
pnpm build
pnpm preview
```

常用检查：

```bash
pnpm check
pnpm format
pnpm format:check
```

## 当前页面

- `/`：展馆大厅
- `/halls`：展厅总览
- `/halls/[slug]`：单个展厅
- `/exhibitions/[slug]`：单个展览
- `/archive`：展览归档
- `/about`：关于页面
- `/studio`：私人策展台占位页，不进入公开导航

## 展厅结构

展厅内容位于 `src/content/halls`，由 Content Collections 校验。当前展厅：

- `city`：城市展厅 / City Hall
- `travel`：旅行展厅 / Travel Hall
- `campus-theatre`：校园 / 剧场展厅 / Campus & Theatre
- `still-life`：静物 / 生活展厅 / Still Life
- `daily-notes`：日常札记 / Daily Notes
- `experiments`：黑白 / 实验展厅 / Experiments

`日常札记` 用于收纳较轻、较散、难以归入明确主题但仍经过选择的日常片段。它不是垃圾桶，也不是随手乱放的朋友圈相册；视觉上应比 Still Life 更轻、更私人、更像生活记录，但仍保持展馆秩序。

新增展厅时，在 `src/content/halls` 新建 JSON 文件，至少包含：

```json
{
  "slug": "example",
  "name": "示例展厅",
  "englishName": "Example Hall",
  "description": "展厅说明。",
  "mood": ["关键词"],
  "status": "active",
  "order": 7,
  "tone": "warm"
}
```

## 添加展览

展览内容位于 `src/content/exhibitions`。新增展览时新建 JSON 文件，至少包含：

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
  "photos": [
    {
      "src": "/src/assets/exhibitions/example/photo-01.webp",
      "alt": "照片替代文本",
      "caption": "照片说明。",
      "location": "地点",
      "date": "2026-05-30",
      "orientation": "landscape"
    }
  ]
}
```

公开页面只显示 `status: "published"` 的展览。`draft` 和 `hidden` 可作为未来策展台工作流的状态基础。

## 替换照片

公开网页不直接使用原始大图。建议流程：

1. 原片保存在本地硬盘、云盘或独立备份。
2. 为网页生成展示图、封面图和必要缩略图，优先使用 `webp` / `avif` / 优化后的 `jpg`。
3. 将网页展示图放入 `src/assets/exhibitions/<exhibition-slug>/`。
4. 在展览 JSON 中更新 `cover` 和 `photos[].src`。
5. 为每张图填写准确 `alt`、`caption`、`orientation`。

## Public Exhibition 与 Curator Studio

Public Exhibition 是公开展馆，只负责观看：

- 首页、展厅、展览、归档、关于
- 安静、克制、沉浸、展览感
- 不出现上传、编辑、排序、管理操作

Curator Studio 是未来私人策展台：

- 路径从 `/studio` 开始
- 用于新建展览、导入照片、编辑 caption、调整排序、设置封面和发布状态
- 不出现在公开 Header 导航
- 不和公开展览页共用展示布局逻辑
- Phase 1 仅有占位页，生产环境应阻止公开访问

未来推荐先做本地策展台：通过 `pnpm studio` 启动本地 Node 服务，选择照片、填写信息、排序、生成 metadata 和网页展示图，再检查、commit、push、部署。

## Phase 1 Pro 已完成目标

- Astro + TypeScript 项目底盘
- Content Collections 内容结构
- 六个展厅与一个示例展览
- 公开页面 IA
- `/studio` 私人策展台占位页
- 设计 tokens、响应式布局和克制动效
- 图片优化策略和项目内占位展示图
- README / PROJECT_BRIEF / DEPLOYMENT 文档

## 下一阶段建议

- Phase 2：替换真实照片，完善 2-3 个正式展览。
- Phase 3：建立本地 Curator Studio 原型，生成图片衍生版本和展览 JSON。
- Phase 4：评估是否引入 Supabase Auth / Storage / Database，用于线上私人策展台。
