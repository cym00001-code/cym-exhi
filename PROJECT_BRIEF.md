# PROJECT BRIEF

## 项目定位

YIMING PHOTO ARCHIVE / 一鸣私人摄影馆是一个私人摄影网页展览馆。首页像展馆大厅，不同主题是不同展厅，每个展厅下可以有多个具体展览，每个展览是一组有节奏、有标题、有文字、有观看顺序的摄影作品。

它不是普通相册、摄影师商业接单作品集、博客、模板化瀑布流，也不包含价格、预约、服务、客户评价等商业模块。

整体气质：私人、美术馆、影像档案、安静、有秩序、细节讲究。技术可以高级，但公开界面必须克制。

## Phase 2 Final 目标

Phase 2 Final 的重点是 Curator Studio：建立一个云端存在、需要鉴权、能真正写入内容并发布到线上展馆的私人策展控制台。

它需要让我管理：

- 全站文案
- 导航与首页展示
- 六大展厅
- 展览 metadata
- 照片 metadata
- 内容健康检查
- 基础展示逻辑

当前仍不接入 Supabase、不接入数据库、不做商业 CMS、不做真实公网图片上传系统。

## 视觉原则

主站不做纯黑白灰模板。黑白灰作为秩序基础，辅以 warm ivory、stone gray、ink black、muted brown gray、muted blue gray。

公开展馆关键词：

- 温润
- 克制
- 干净
- 有留白
- 私人展馆
- 影像档案
- 不商业
- 不网红
- 不模板

Curator Studio 可以更工具化，但仍应干净、清楚、克制，不做粗糙后台感。

## 动效原则

动效服务于进入展馆、切换展厅、观看照片和建立沉浸感，不抢照片注意力。必须支持 `prefers-reduced-motion`。

允许轻微 fade、View Transitions、hover 细节、照片浮现和自然状态过渡。禁止大幅旋转、弹跳、夸张缩放、3D 炫技和花哨 loading。

## 信息架构

公开展馆 Public Exhibition：

- `/`
- `/halls`
- `/halls/[slug]`
- `/exhibitions/[slug]`
- `/archive`
- `/about`

Curator Studio：

- `/curator-studio`
- `/api/curator-studio`

`/studio` 不作为公开入口，不进入公开导航。

## 六大展厅结构

1. 城市展厅 / City Hall / `city`
2. 旅行展厅 / Travel Hall / `travel`
3. 校园展厅 / Campus / `campus`
4. 静物 / 生活展厅 / Still Life / `still-life`
5. 日常札记 / Daily Notes / `daily-notes`
6. 黑白 / 实验展厅 / Experiments / `experiments`

校园展厅说明：

校园不是单一的青春符号，也不只是课堂和活动。这里存放在学校里看见的空间、人物、物件和片刻：走廊、教室、操场、窗边、课桌、活动现场，以及那些在日常秩序中短暂出现的变化。它可以安静，也可以热闹；可以是一次活动的现场，也可以只是某个普通下午留下的光。

剧场、舞台、话剧以后可以作为校园展厅下的具体展览存在，例如《幕前与幕后》，但不作为整个校园展厅的核心定义。

日常札记说明：

不是所有照片都需要被放进一个明确的主题。这里存放一些日常里较轻、较散，却仍然值得留下的片段。它们不一定像展览作品那样完整，也不一定拥有强烈的风格，但它们保留了生活里更细的部分。它不是垃圾桶，也不是随手乱放的相册，仍然需要选择和整理。

## 内容结构

内容存储：

- `src/data/site.json`
- `src/data/navigation.json`
- `src/content/halls/*.json`
- `src/content/exhibitions/*.json`

每个 hall 包含：

- `slug`
- `name`
- `englishName`
- `description`
- `mood`
- `status`
- `order`
- `showOnHome`
- `cover`
- `tone`
- `accent`
- `layoutHint`

每个 exhibition 包含：

- `slug`
- `title`
- `subtitle`
- `hallSlug`
- `date`
- `dateLabel`
- `location`
- `cover`
- `intro`
- `status`
- `featured`
- `displayOrder`
- `chapters`
- `seo`
- `photos`

## Public Exhibition / Curator Studio 边界

Public Exhibition 面向访客：

- 只负责观看
- 使用静态 Astro 构建
- 只展示 active 展厅和 published 展览
- 不出现上传、编辑、管理、排序操作

Curator Studio 面向站点所有者：

- 云端存在
- 需要鉴权登录
- 不进入公开导航
- 写入内容文件前创建 `.studio-backups/`
- 保存后触发构建并发布静态展馆
- 不共享公开展览展示组件的布局逻辑
- 不使用 Supabase、数据库或线上 CMS

## 图片管理原则

公开网页展示使用优化后的图片，不直接使用原始大图。原片保存在本地硬盘、云盘或独立备份。项目中保存网页展示图、封面图和必要缩略图。图片必须有稳定尺寸、`alt` 和 caption。

Phase 2 只管理已有图片 metadata，不做真实公网上传。

## 禁止跑偏方向

- 不做摄影接单官网。
- 不加入价格、服务、预约、客户评价。
- 不做廉价模板或卡片堆叠。
- 不把上传、编辑、排序放进公开展览页。
- 不让 Studio 入口进入公开导航。
- 不把 Supabase 或数据库提前接进 Phase 2。
- 不把原始大图无脑塞进公开网页。
- 不把日常札记变成杂乱相册。

## 阶段路线图

- Phase 1 Pro：公开展馆系统、审美基调、内容结构、动效原则、Git 工作流、部署文档。
- Phase 2 Final：云端受保护 Curator Studio，管理内容、健康检查、备份和静态发布。
- Phase 3：真实照片导入、图片衍生图生成、EXIF 读取和更完整的策展工作流。
- Phase 4：只有在需求明确升级后，才评估 Supabase 或其他线上数据服务。

## 验收原则

每次阶段完成至少运行 `pnpm check`、`pnpm build`，并用浏览器或 Playwright 查看关键页面。构建通过不等于观看体验通过；需要检查图片是否真实渲染、导航是否可用、移动端是否溢出、Studio 是否需要登录、公开导航是否不出现 Studio。
