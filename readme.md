# VanBlog Publisher (Obsidian Plugin)

在 Obsidian 中将文档发布到 [VanBlog](https://github.com/Mereithhh/vanblog) 博客系统。

---

## 项目结构

```
obsidian-vanblog-pulgin/
├── manifest.json                 # Obsidian 插件元数据（ID、版本、最低版本要求）
├── package.json                  # npm 依赖和构建脚本
├── tsconfig.json                 # TypeScript 编译配置（strict 模式）
├── esbuild.config.mjs            # esbuild 打包配置（树摇、CJS 输出、排除 Obsidian API）
├── styles.css                    # 弹窗和 UI 样式
├── readme.md                     # 项目文档（本文件）
│
├── main.js                       # 构建产物（esbuild 输出）
│
├── src/
│   │
│   ├── main.ts                   # 插件入口
│   │   ├── 生命周期 onload / onunload
│   │   ├── 注册命令（Publish / Revoke）
│   │   ├── 注册文件右键菜单
│   │   ├── 注册设置面板
│   │   ├── 设置读写 + 持久化
│   │   ├── 文章发布流程（读取 → 解析嵌入文件 → 上传媒体 → 发布/更新）
│   │   ├── 文章撤回流程
│   │   ├── 连接测试（testConnection）
│   │   ├── 标签/分类 CRUD 代理方法
│   │   └── 自动拉取 tag/category 元数据
│   │
│   ├── settings.ts               # 设置界面
│   │   ├── 连接配置（URL + Token）
│   │   ├── 连接测试按钮 + 刷新数据按钮
│   │   ├── 标签管理（列出、新增、重命名、删除）
│   │   ├── 分类管理（列出、新增、重命名、删除）
│   │   └── 默认发布选项
│   │
│   ├── api/
│   │   ├── types.ts              # TypeScript 类型定义
│   │   │   ├── ArticlePayload / ArticleResponse
│   │   │   ├── TagItem / CategoryItem
│   │   │   ├── UploadResponse
│   │   │   └── PluginData / ArticleRecord
│   │   │
│   │   └── client.ts             # HTTP API 客户端
│   │       ├── requestUrl（绕过 CORS）
│   │       ├── 文章 CRUD（POST/GET/PUT/DELETE /api/article）
│   │       ├── 标签 CRUD（GET/POST/PUT/DELETE /api/admin/tag）
│   │       ├── 分类 CRUD（GET/POST/PUT/DELETE /api/admin/category）
│   │       ├── 文件上传（multipart 手动构建）
│   │       └── 连接测试
│   │
│   ├── modals/
│   │   ├── publish-modal.ts      # 发布弹窗
│   │   │   ├── 标题输入
│   │   │   ├── 分类下拉框（数据来源：VanBlog API）
│   │   │   ├── 标签文本 + 下拉框补全
│   │   │   ├── Slug / 置顶 / 密码 / 隐藏
│   │   │   └── 确认 / 取消
│   │   │
│   │   └── revoke-modal.ts       # 撤回确认弹窗
│   │
│   ├── utils/
│   │   └── markdown.ts           # Markdown 工具函数
│   │       ├── 解析 front-matter（title/tags/category/slug/top/password/hide）
│   │       ├── 查找嵌入文件（![[image.png]] / ![alt](path) 等）
│   │       └── 替换本地路径为远程 URL
│   │
│   └── data.ts                   # 插件数据管理
│       └── 文件路径 ↔ 文章 ID 映射（增删改查）
│
└── .editorconfig                 # 编辑器配置
```

### 各模块职责说明

| 模块 | 文件 | 职责 |
|------|------|------|
| **插件入口** | `src/main.ts` | 生命周期管理、命令注册、右键菜单、编排发布/撤回流程 |
| **API 客户端** | `src/api/client.ts` | 使用 Obsidian `requestUrl` 发起 HTTP 请求，统一处理认证、错误、响应解包 |
| **类型定义** | `src/api/types.ts` | 全量 TS 接口定义，包括请求/响应结构、文章/标签/分类/附件模型 |
| **设置界面** | `src/settings.ts` | 连接配置、连接测试、标签/分类 CRUD 管理的完整 UI |
| **发布弹窗** | `src/modals/publish-modal.ts` | 发布前确认弹窗，支持编辑标题/分类/标签等元数据 |
| **撤回弹窗** | `src/modals/revoke-modal.ts` | 撤回前二次确认 |
| **Markdown 工具** | `src/utils/markdown.ts` | Front-matter 解析、嵌入文件扫描、路径替换 |
| **数据持久化** | `src/data.ts` | 发布记录的读写（local ↔ 远端文章 ID 映射） |

---

## 功能

### 发布文档
1. 选中 Markdown 文件 → 右键 → "Publish to VanBlog"（或命令面板）
2. 插件自动读取文件的 **front-matter**（`title`、`tags`、`category`、`slug`、`top`、`password`、`hide`）
3. 扫描内容中的嵌入文件（图片、附件等），依次上传到 **VanBlog 内置图床**
4. 将本地路径替换为远程 URL
5. 弹出发布确认弹窗，可修改标题、分类、标签等
6. 如果是首次发布 → `POST /api/article` 创建；如果已发布过 → `PUT /api/article/:id` 更新
7. 保存文件路径 ↔ 文章 ID 映射，供后续操作

### 撤回文档
1. 选中已发布的 Markdown 文件 → 右键 → "Revoke from VanBlog"
2. 弹出确认对话框
3. 确认后调用 `DELETE /api/article/:id`
4. 删除本地映射记录

### 标签与分类管理（设置界面）
- **连接测试** — 一键验证 URL 和 Token 是否可用
- **刷新数据** — 从 VanBlog 重新拉取全量标签和分类列表
- **标签管理** — 列出所有标签、新增、重命名、删除
- **分类管理** — 列出所有分类、新增、重命名、删除
- 默认分类和标签采用**下拉框**，数据来自 VanBlog API
- 拉取的标签/分类会**持久化缓存**，下次启动不再等待网络

### 右键菜单
在文件管理器中右键 **Markdown 文件**，显示：
- **Publish to VanBlog** — 发布/更新文档
- **Revoke from VanBlog** — 撤回已发布的文档（仅已发布文件显示）

---

## 配置

### 设置项

| 设置项 | 类型 | 说明 |
|--------|------|------|
| **VanBlog 地址** | 文本 | 你的 VanBlog 实例 URL（如 `https://blog.example.com`） |
| **API Token** | 文本 | 在 VanBlog 后台 → 系统设置 → Token 管理中创建 |
| **默认分类** | 下拉框 | 文档 front-matter 中未指定分类时的默认值 |
| **默认标签** | 下拉框 | 文档 front-matter 中未指定标签时的默认值 |
| **自动上传媒体** | 开关 | 开启后自动上传文档中的图片/附件到 VanBlog 图床 |

### 路由对照

| 路径 | 文件 | 说明 |
|------|------|------|
| `src/main.ts` | `VanBlogPlugin` | 插件主类 |
| `src/settings.ts` | `VanBlogSettingTab` | 设置面板 |
| `src/api/types.ts` | — | API 类型定义 |
| `src/api/client.ts` | `VanBlogApiClient` | HTTP 客户端 |
| `src/modals/publish-modal.ts` | `PublishModal` | 发布弹窗 |
| `src/modals/revoke-modal.ts` | `RevokeModal` | 撤回弹窗 |
| `src/utils/markdown.ts` | — | Markdown 工具函数 |
| `src/data.ts` | — | 发布记录持久化 |

---

## API 参考

插件使用的 VanBlog REST API 端点：

### 文章

| 方法 | 端点 | 说明 | 所在文件 |
|------|------|------|----------|
| `POST` | `/api/article` | 创建文章 | `client.ts:createArticle` |
| `PUT` | `/api/article/:id` | 更新文章 | `client.ts:updateArticle` |
| `DELETE` | `/api/article/:id` | 删除文章 | `client.ts:deleteArticle` |
| `GET` | `/api/article/:id` | 获取单篇文章 | `client.ts:getArticle` |
| `GET` | `/api/article?page=&pageSize=` | 分页列表 | `client.ts:listArticles` |

### 标签

| 方法 | 端点 | 说明 | 所在文件 |
|------|------|------|----------|
| `GET` | `/api/admin/tag/all` | 获取所有标签 | `client.ts:getTags` |
| `POST` | `/api/admin/tag` | 新建标签 | `client.ts:createTag` |
| `PUT` | `/api/admin/tag/:id` | 重命名标签 | `client.ts:updateTag` |
| `DELETE` | `/api/admin/tag/:id` | 删除标签 | `client.ts:deleteTag` |

### 分类

| 方法 | 端点 | 说明 | 所在文件 |
|------|------|------|----------|
| `GET` | `/api/admin/category/all` | 获取所有分类 | `client.ts:getCategories` |
| `POST` | `/api/admin/category` | 新建分类 | `client.ts:createCategory` |
| `PUT` | `/api/admin/category/:id` | 重命名分类 | `client.ts:updateCategory` |
| `DELETE` | `/api/admin/category/:id` | 删除分类 | `client.ts:deleteCategory` |

### 文件上传

| 方法 | 端点 | 说明 | 所在文件 |
|------|------|------|----------|
| `POST` | `/api/upload` | 上传图片/附件（multipart） | `client.ts:uploadFile` |

### 认证

所有 API 请求在 Header 中添加 `token` 字段进行鉴权。Token 在 VanBlog 后台 → 系统设置 → Token 管理创建。

完整的 Swagger 文档可访问 `{你的VanBlog地址}/swagger` 查看。

---

## 开发

### 环境要求

- Node.js >= 18
- npm

### 本地开发

```bash
npm install
npm run dev    # 开发模式（watch 模式，自动重新编译）
npm run build  # 构建生产版本（tsc 检查 + esbuild 打包）
npm run lint   # ESLint 代码检查
```

### 手动安装到 Obsidian

```bash
cp main.js styles.css manifest.json /你的Obsidian仓库/.obsidian/plugins/obsidian-vanblog-publisher/
```

然后在 Obsidian 设置中启用插件，配置 VanBlog 地址和 Token。

### 技术栈

| 技术 | 用途 |
|------|------|
| **TypeScript** | 语言 |
| **Obsidian API** | 插件 SDK（`requestUrl`、`Plugin`、`Setting`、`Modal` 等） |
| **esbuild** | 打包工具 |
| **requestUrl** | HTTP 客户端（Electron 主进程，绕过 CORS） |

### 关键设计决策

- **requestUrl 代替 fetch**：Obsidian 的 `requestUrl` 走 Electron 主进程，天然绕过 CORS 限制。
- **手动构造 multipart**：`requestUrl` 不支持 `FormData`，文件上传需手动构建 multipart body + boundary header。
- **响应解包**：VanBlog API 返回 `{ code, message, data }` 信封，`parseResponse` 统一解包到泛型 `T`。
- **持久化**：文章映射和标签/分类缓存均通过 `plugin.loadData/saveData` 存储，与设置共享同一个 JSON 对象。
