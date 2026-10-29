# 拾页 · 个人学习档案

这是一个 Vue 3 + Vite 前端和 Fastify + Prisma 后端组成的个人知识库。前端和后端源码、配置、构建产物分别放在两个目录；根目录只负责 workspace 编排和统一命令。

## 目录结构

```text
web/
├── frontend/       # Vue 3 + Vite 页面和组件
├── backend/        # Fastify API、Prisma schema、seed 和运行时数据
│   ├── prisma/      # SQLite 数据库（dev.db）
│   └── storage/     # 私有 PDF 文件
├── package.json     # npm workspace 和统一命令
└── package-lock.json
```

## 本地运行

在项目根目录安装依赖并初始化数据库：

```bash
npm install
npm run db:setup
```

同时启动前后端：

```bash
npm run dev:all
```

启动后通过 `http://服务器IP:5173` 访问（本机可用 `http://localhost:5173`），并保持启动终端运行。前端固定使用 5173 端口；端口被占用时会提示错误，不会自动切换到其他端口。

开发环境的 WebSocket 用于 Vite 热更新，与网页使用相同地址和端口。若控制台出现 `WebSocket ... ERR_CONNECTION_REFUSED`，先确认前端启动终端仍在运行；服务停止后，已打开的网页会持续尝试重连。重新启动后刷新网页即可。

也可以在两个终端分别启动，监听地址默认都是 `0.0.0.0`：

```bash
cd /root/docu/web/backend
npm run dev       # API：http://0.0.0.0:3001
```

```bash
cd /root/docu/web/frontend
npm run dev       # 前端：http://0.0.0.0:5173
```

根目录也提供 `npm run dev:backend`、`npm run dev:frontend`、`npm run build` 和 `npm run typecheck` 等 workspace 命令。

后端配置位于 `backend/.env`，模板是 `backend/.env.example`。本地默认数据库为 `backend/prisma/dev.db`，PDF 文件存放在 `backend/storage/private/`，这些运行时数据不会提交到版本库。

首次初始化默认管理员账号：

```text
邮箱：admin@example.com
密码：change-me-now
```

部署前请修改 `backend/.env` 中的 `JWT_SECRET`、`ADMIN_PASSWORD` 和 `DATABASE_URL`。

## 已实现功能

- 网页上传 PDF：管理页支持上传、标题、摘要、分类和私有开关。
- 笔记管理：独立列表支持标题/摘要搜索、学科和可见范围筛选、新建、编辑、预览与删除。正文直接使用 Markdown 编辑，旁边提供 Markdown、代码块和 LaTeX 数学公式用法文档；保存后继续兼容公式排版、代码高亮、全文搜索和旧笔记。
- 数据库存储：Prisma schema 保存用户、主题、目录节点、资源和阅读进度。
- PDF 全文搜索：上传时提取 PDF 文本，搜索接口查询标题、摘要和正文。
- Linux-6.8 源码浏览：内核源码和 Universal Ctags 索引保存在 `backend/storage/kernel/linux-6.8`，启动时自动建立 `Linux Kernel -> Linux-6.8` 导航；源码目录与文件只读浏览，内容按需从磁盘读取。
- Linux 符号搜索：全局搜索可分别检索笔记/PDF 或 Linux 符号。tags 使用按符号名排序的文件索引和二分定位，不导入普通笔记表；选择定义后打开对应源码位置。
- Linux 源码高亮与跳转：C/C++、汇编、Rust、Make 等源码按语言高亮；源码中的可识别函数调用会链接到对应 tags 定义，可继续浏览调用链。
- 阅读进度同步：登录用户可以保存页码和百分比进度。
- 私有文件访问：PDF 存放在 `backend/storage/private`，通过 API 校验访问权限后流式返回，不能被静态 URL 直接访问；私有文件需要作者或管理员登录。
- 注册和登录：邮箱注册、密码校验、JWT 登录；注册成功后自动登录，账号默认为普通用户。
- 导航和菜单：未登录时主导航只有首页；登录后显示全部学科和唯一的“学科管理”入口。学科管理只维护顶部一级导航；进入学科后，左侧目录栏维护多级子菜单。
- 笔记归属：每篇笔记必须归属于一个子菜单。历史上没有归类的笔记会在后端启动时自动迁入该学科的“未分类”子菜单，并保留正文、权限、作者和阅读进度。
- 权限：`ADMIN` 可以管理用户和所有资源；普通用户只能编辑或删除自己的资源，也只能查看自己的私有资料。公开资料仍可通过 API 读取。
- 公开个人主页：地址为 `/u/邮箱账号`，访客无需登录，可浏览该作者公开的学科目录、笔记和 PDF；公开页始终只读，不显示任何管理、添加、编辑或删除入口。

## 内容管理

点击右上角“登录”，再选择“注册账号”即可创建账号。登录后可从顶部“学科管理”维护一级导航；PDF 管理仍位于管理工作区，笔记管理保留为兼容和集中整理入口：

| 页面 | 地址 | 功能 |
| --- | --- | --- |
| 学科管理 | `/admin/subjects` | 维护顶部一级学科菜单 |
| 笔记管理 | `/admin/notes` | 搜索、筛选、新建、编辑、预览、删除笔记 |
| PDF 资料 | `/admin/pdfs` | 上传 PDF 并查看电子书列表 |

笔记管理只列出当前用户可编辑的笔记；管理员可以管理全部笔记。编辑器可修改标题、摘要、所属学科、子菜单和正文，离开未保存的编辑器时会提醒确认。正文区域直接编辑 Markdown，点击“Markdown 与数学公式用法”会在新标签页打开完整参考文档，包含标题、列表、链接、表格、代码块，以及极限、积分、求和、开方、矩阵、分段函数等 LaTeX 示例。数学公式使用 `$...$`（行内）或独立成行的 `$$...$$`（块级），预览和阅读页会自动用 KaTeX 排版，不需要本地安装 LaTeX。新建笔记默认私有，作者可以自行设置公开或私有。笔记阅读页也提供“管理这篇笔记”入口。

学科和子菜单的行为如下：

- 添加学科后会自动生成顶部菜单，链接标识可以留空。
- 进入学科页面后，左侧每个子菜单都有“＋”和“−”。“＋”可以添加下一级子菜单，或直接在当前子菜单下新建笔记；“−”删除菜单及其下级菜单。
- 含有笔记的菜单不能直接删除，需先在笔记编辑器中把笔记移动到其他子菜单，或删除笔记，避免笔记失去归属。
- 学科页面正文列出当前子菜单的直属笔记，点击标题在正文区域阅读；每行提供编辑和删除操作。
- 删除有资料的学科时，需选择资料迁入的其他学科；笔记会迁入目标学科的“未分类”子菜单，PDF、正文和阅读进度都会保留。
- 上传 PDF 或通过集中笔记管理创建笔记时，也必须选择子菜单；PDF 仍允许放在学科根目录。

学科和菜单接口沿用现有 `/api/admin` 路径，所有登录用户均可调用；用户管理接口仍仅限管理员：

```text
POST /api/admin/subjects
POST /api/admin/nodes
DELETE /api/admin/subjects/:slug?moveTo=目标学科标识
DELETE /api/admin/nodes/:id
```

登录后目录页从 `/api/catalog` 加载数据库内容。后端暂不可用时会显示重试提示；退出登录会清空前端目录缓存。

## 分享个人主页

登录后点击顶部“个人主页”即可预览；首页和管理页的“公开个人主页”卡片提供完整地址和“复制链接”按钮。例如登录账号为 `admin@example.com` 时，分享地址为：

```text
http://服务器IP:5173/u/admin@example.com
```

账号使用现有登录邮箱，无需另外注册用户名。将链接发给访客即可访问，学科、子目录、笔记和 PDF 的链接都会保留账号路径，直接打开或刷新也可浏览。

- 公开笔记：在编辑器中取消勾选“私有笔记”，保存后展示在作者的主页。
- 公开 PDF：上传时取消勾选“私有文件”；已有 PDF 可以在“PDF 资料”页点击“公开展示”。
- 取消公开：重新设为私有后，公开接口即拒绝后续访问，主页也不再列出该资料。

每个主页仅展示对应作者明确公开的资料及其目录祖先，私有资料、其他作者的资料和没有公开内容的目录不会展示。已有资料不会自动改为公开。作者或管理员登录后打开公开地址，也只会看到相同的只读页面；编辑需返回管理页面。

Linux Kernel 使用独立的只读源码浏览和符号索引，不会把源码文件或 tags 转成普通笔记。默认源码目录是 `backend/storage/kernel/linux-6.8`，也可通过后端环境变量 `KERNEL_SOURCE_DIR` 指定；此目录在 `.gitignore` 的 `**/storage/` 规则下，不会提交到 Git。进入“Linux Kernel”后选择“Linux-6.8”，顶层源码目录显示在侧栏，目录中的子目录和文件在内容区按需浏览；全局“搜索”支持“全部”“笔记与 PDF”“Linux 符号”范围，选择 Linux 符号结果会定位到对应源码定义。

开发环境通过 Vite 代理 `/api`。正式部署时，需把 `/api` 转发到后端，并将其他页面路径回退到前端 `index.html`，以支持分享链接和深层目录的直接访问。

## 主要 API

```text
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me
GET    /api/catalog
GET    /api/public/:account
GET    /api/public/:account/resources/:id
GET    /api/public/:account/resources/:id/file
GET    /api/resources/:id
PATCH  /api/resources/:id
DELETE /api/resources/:id
POST   /api/resources/note
POST   /api/resources/upload
GET    /api/resources/:id/file
GET    /api/resources/:id/progress
PUT    /api/resources/:id/progress
GET    /api/search?q=关键词
```

需要登录的接口使用：

```http
Authorization: Bearer <JWT>
```

## 数据库说明

`npm run db:setup` 会生成 Prisma Client、使用 Node 24 内置 SQLite 初始化开发表结构并执行 seed。生产环境建议使用 PostgreSQL，并通过 Prisma migration 管理 schema；不要把 SQLite 文件、JWT 密钥或私有 PDF 放进代码仓库。

## 构建验证

```bash
npm run typecheck
npm test --workspace backend
npm run build
```

接口测试使用临时 SQLite 数据库和文件目录，覆盖注册、权限、笔记编辑与搜索索引、笔记删除、菜单删除、资料迁移，以及个人主页账号隔离、匿名只读、公开 PDF 读取和取消公开后的访问控制，不修改现有资料。
