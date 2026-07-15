# VanBlog Publisher

[English](#features) | [中文](#功能)

将 Obsidian 中的 Markdown 文档直接发布到 [VanBlog](https://github.com/Mereithhh/vanblog) 博客系统。

## 功能

### 文章发布与更新

- 通过**右键菜单**或**命令面板**将文档发布到 VanBlog
- 发布前弹出编辑弹窗，可修改标题、分类、标签、Slug、置顶、密码保护、首页隐藏、作者等
- 已发布的文档自动识别，右键显示「更新到 VanBlog」
- 支持 front-matter 字段：`title`、`tags`、`category`、`slug`、`top`、`password`、`hide`、`author`、`date`、`copyright`

### 文章撤回

- 右键菜单或命令面板撤回已发布的文章
- 自动清除文件中的 `vanblog-*` 笔记属性

### 嵌入媒体自动上传

- 发布时自动检测文档中的嵌入图片/附件（`![[file.png]]`、`![alt](path)`）
- 上传到 VanBlog 图床后自动替换为远程 URL
- 支持格式：png, jpg, gif, svg, webp, mp4, webm, mp3, wav, pdf 等

### 笔记属性回写

发布成功后自动在文件 front-matter 中写入：

```yaml
vanblog-id: 7
vanblog-published-at: 2026-07-13 15:31:49
vanblog-url: https://blog.example.com/post/abc123
```

### 已发布文档管理

- 设置界面提供「查看已发布文档」功能
- 扫描仓库中所有包含 `vanblog-id` 的文件
- 并发校验每个文档在 VanBlog 服务器上是否真实存在
- 表格展示：文档名称、VanBlog 是否存在、操作（详情 / 清空属性）

### 标签与分类管理

- 启动时自动从 VanBlog 获取已有标签和分类
- 发布弹窗中提供下拉选择
- 设置界面可手动刷新数据

### 国际化

支持中文 / 英文，可选择跟随 Obsidian 语言设置。

---

## 安装

将以下文件复制到 Obsidian 仓库的 `.obsidian/plugins/obsidian-vanblog-publisher/` 目录：

- `main.js`
- `manifest.json`
- `styles.css`

然后在 Obsidian 设置 → 第三方插件中启用 VanBlog Publisher。

---

## 配置

| 设置项 | 类型 | 说明 |
|--------|------|------|
| VanBlog 地址 | 文本 | VanBlog 实例 URL，如 `https://blog.example.com` |
| API Token | 文本 | VanBlog 后台 → 系统设置 → Token 管理中创建 |
| 默认分类 | 下拉框 | 文档 front-matter 未指定分类时的默认值 |
| 默认标签 | 下拉框 | 文档 front-matter 未指定标签时的默认值 |
| 默认作者 | 文本 | 文档 front-matter 未指定作者时的默认值 |
| 默认首页隐藏 | 开关 | 发布时默认隐藏文章 |
| 自动上传媒体 | 开关 | 发布时自动上传嵌入的图片/附件 |
| 语言 | 下拉框 | 中文 / 英文 / 跟随 Obsidian |

---

## 使用方式

### 发布文档

1. 打开一个 Markdown 文件
2. 右键 →「发布到 VanBlog」，或命令面板输入 `Publish current file to VanBlog`
3. 在弹窗中确认或修改标题、分类、标签等
4. 点击「发布」

### 更新文档

已发布的文件（含 `vanblog-id` 属性）右键会显示「更新到 VanBlog」，流程与发布相同。

### 撤回文档

- 右键 →「从 VanBlog 撤回」
- 或命令面板输入 `Revoke current file from VanBlog`

---

## 项目结构

```
src/
├── main.ts                     # 插件入口，发布/撤回流程，右键菜单，命令注册
├── settings.ts                 # 设置界面（连接、语言、默认选项、标签/分类管理、已发布文档）
├── i18n.ts                     # 国际化（中文/英文）
├── api/
│   ├── client.ts               # VanBlog HTTP API 客户端
│   └── types.ts                # TypeScript 类型定义
├── modals/
│   ├── publish-modal.ts        # 发布确认/编辑弹窗
│   ├── revoke-modal.ts         # 撤回确认弹窗
│   └── input-modal.ts          # 通用输入/确认弹窗
└── utils/
    └── markdown.ts             # Front-matter 解析、嵌入文件检测、属性写入/清除
```

---

## 开发

### 环境要求

- Node.js >= 18
- npm

### 命令

```bash
npm install       # 安装依赖
npm run dev       # 开发模式（watch，自动编译）
npm run build     # 生产构建（TypeScript 检查 + esbuild 打包）
npm run lint      # ESLint 代码检查
```

### 手动安装

```bash
npm run build
cp main.js styles.css manifest.json /你的Vault/.obsidian/plugins/obsidian-vanblog-publisher/
```

在 Obsidian 中重新加载插件即可。

### 技术栈

| 技术 | 用途 |
|------|------|
| TypeScript | 开发语言 |
| Obsidian API | 插件 SDK |
| esbuild | 打包工具 |
| requestUrl | HTTP 请求（Electron 主进程，绕过 CORS） |

---

## VanBlog API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/admin/article` | 创建文章 |
| `PUT` | `/api/admin/article/:id` | 更新文章 |
| `DELETE` | `/api/admin/article/:id` | 删除文章 |
| `GET` | `/api/admin/article/:id` | 获取单篇文章 |
| `GET` | `/api/admin/article` | 文章列表（分页） |
| `GET` | `/api/admin/tag/all` | 获取所有标签 |
| `GET` | `/api/admin/category/all` | 获取所有分类 |
| `POST` | `/api/upload` | 上传文件 |

认证方式：请求头 `token: {your-api-token}`

完整 API 文档访问：`{VanBlog地址}/swagger`
