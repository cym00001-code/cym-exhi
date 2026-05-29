# PROJECT BRIEF

## 项目定位

YIMING PHOTO ARCHIVE / 一鸣私人摄影馆是一个私人摄影网页展览馆。首页像展馆大厅，不同主题是不同展厅，每个展厅下可以有多个具体展览，每个展览是一组有节奏、有标题、有文字、有观看顺序的摄影作品。

它不是：

- 普通相册
- 摄影师商业接单作品集
- 博客
- 模板化图片瀑布流
- 带价格、预约、服务、客户评价的商业网站

整体气质应保持私人、美术馆、影像档案、安静、有秩序、细节讲究。技术可以高级，但公开界面必须克制。

## 视觉原则

主站不做纯黑白灰模板。黑白灰作为秩序基础，辅以 warm ivory、stone gray、ink black、muted brown gray、muted blue gray。

视觉关键词：

- 温润
- 克制
- 干净
- 有留白
- 私人展馆
- 影像档案
- 不商业
- 不网红
- 不模板

不同展厅可预留不同气质。黑白 / 实验展厅可以更冷、更锐利；日常札记可以更轻、更私人、更像生活记录；但所有公开页面仍应保持展馆秩序。

## 动效原则

动效服务于进入展馆、切换展厅、观看照片和建立沉浸感，不抢照片注意力。

允许：

- 页面轻微 fade in
- Astro View Transitions 或轻量页面切换
- 展厅入口 hover 的轻微位移、明暗或边框变化
- 照片滚动进入视野时轻微浮现
- 链接、按钮、导航状态的自然过渡
- 图片加载时避免突兀跳动

禁止：

- 大幅旋转
- 弹跳
- 夸张缩放
- 3D 炫技动画
- 花哨 loading
- 抢照片注意力的动效

必须支持 `prefers-reduced-motion`。

## 信息架构

公开展馆 Public Exhibition：

- `/`：首页展馆大厅
- `/halls`：展厅总览
- `/halls/[slug]`：单个展厅
- `/exhibitions/[slug]`：单个展览
- `/archive`：按时间归档
- `/about`：关于页面

展厅结构：

1. 城市展厅 / City Hall / `city`
2. 旅行展厅 / Travel Hall / `travel`
3. 校园 / 剧场展厅 / Campus & Theatre / `campus-theatre`
4. 静物 / 生活展厅 / Still Life / `still-life`
5. 日常札记 / Daily Notes / `daily-notes`
6. 黑白 / 实验展厅 / Experiments / `experiments`

`日常札记` 说明：不是所有照片都需要被放进一个明确的主题。这里存放一些日常里较轻、较散，却仍然值得留下的片段。它们不一定像展览作品那样完整，也不一定拥有强烈的风格，但它们保留了生活里更细的部分。它不是垃圾桶，也不是随手乱放的相册，仍然需要选择和整理。

## 内容结构

使用 Astro Content Collections。

每个 hall 至少包含：

- `slug`
- `name`
- `englishName`
- `description`
- `mood`
- `status`
- `order`
- `tone`

每个 exhibition 至少包含：

- `slug`
- `title`
- `subtitle`
- `hallSlug`
- `date`
- `location`
- `cover`
- `intro`
- `status`
- `featured`
- `photos: [{ src, alt, caption, location, date, orientation }]`

Phase 1 示例展览：

- `title`: 短暂离开日常
- `subtitle`: 一次从日常中短暂出走的影像记录
- `hallSlug`: travel
- `location`: 深圳 / 广州 / 路上
- `status`: published
- `featured`: true
- 6 张项目内优化占位图

## Public Exhibition / Curator Studio 边界

Public Exhibition 面向访客：

- 只负责观看
- 使用展厅、展览、照片、文字
- 追求安静、克制、沉浸、展览感
- 不出现上传、编辑、管理、排序操作

Curator Studio 面向站点所有者：

- 路径从 `/studio` 开始
- 用于新建展览、导入照片、编辑 caption、设置封面、调整排序、设置发布状态
- 不出现在公开导航栏
- 可以共享设计 tokens
- 不共享公开展览展示组件的布局逻辑
- Phase 1 只创建占位页
- 生产部署时应禁用或要求鉴权

未来建议本地策展台优先：`pnpm studio` 启动本地 Node 服务，负责复制图片、生成展示图、封面、缩略图和 metadata，然后人工检查、commit、push、部署。

Supabase 可以作为未来线上 Curator Studio 的候选方案，但不进入 Phase 1。若未来使用 Supabase，必须重新设计 Auth、RLS、Storage 权限和发布流程。

## 图片管理原则

公开网页展示使用优化后的图片，不直接使用原始大图。

原则：

- 原片保存在本地硬盘、云盘或独立备份。
- 项目中保存网页展示图、封面图、必要缩略图。
- 图片必须有稳定尺寸、`alt` 和 caption。
- 使用 Astro 图片能力输出优化资源。
- 未来 Curator Studio 应支持从原图生成展示图、封面图、缩略图和必要 metadata。

## 禁止跑偏方向

- 不做摄影接单官网。
- 不加入价格、服务、预约、客户评价。
- 不做廉价模板或卡片堆叠。
- 不把上传、编辑、排序放进公开展览页。
- 不让 `/studio` 出现在公开导航。
- 不一开始做复杂线上后台。
- 不把 Supabase 或数据库提前接进 Phase 1。
- 不把原始大图无脑塞进公开网页。
- 不把日常札记变成杂乱相册。

## 阶段路线图

- Phase 1 Pro：展馆系统、审美基调、内容结构、动效原则、Git 工作流、部署文档、Curator Studio 边界。
- Phase 2：替换真实照片，增加正式展览，完善移动端观看节奏。
- Phase 3：本地 Curator Studio，支持导入、排序、caption、封面、图片衍生版本生成。
- Phase 4：评估线上私人策展台，必要时引入 Supabase Auth / Storage / Database。

## 验收原则

Phase 1 以后每次公开界面改动都应至少运行 `pnpm check`、`pnpm build`，并用浏览器或 Playwright 查看关键页面。构建通过不等于观看体验通过；需要检查图片是否真实渲染、导航是否可用、移动端是否溢出、`/studio` 是否仍与公开导航分离。
