# VanBlog Publisher (Obsidian Plugin)

在 Obsidian 中将文档发布到 VanBlog 博客系统。

## 功能

- **发布文档** — 解析 Markdown 中的嵌入文件（图片、附件），先上传到 VanBlog 图床，替换本地路径后发布文章
- **撤回文档** — 从 VanBlog 中删除已发布的文章
- **右键菜单** — 在文件管理器中右键 Markdown 文件，可选择"上传文档"和"撤回文档"
- **Front-matter 支持** — 自动读取 `title`、`tags`、`category`、`slug`、`top`、`password`、`hide` 等字段
- **重新发布** — 已发布的文档再次发布将触发更新（PUT）而非新建

## 安装

1. 复制 `main.js`、`styles.css`、`manifest.json` 到 `.obsidian/plugins/obsidian-vanblog-publisher/`
2. 在 Obsidian 设置中启用插件
3. 在插件设置中配置 VanBlog 地址和 API Token

## 配置

| 设置项 | 说明 |
|--------|------|
| VanBlog 地址 | 你的 VanBlog 实例 URL（如 https://blog.example.com） |
| API Token | 在 VanBlog 后台 → 系统设置 → Token 管理中创建 |
| 默认分类 | 文档 front-matter 中未指定分类时的默认值 |
| 默认标签 | 文档 front-matter 中未指定标签时的默认值（逗号分隔） |
| 自动上传媒体 | 开启后自动上传文档中的图片/附件到 VanBlog 图床 |

## API 参考

插件使用 VanBlog 的 REST API。完整的 Swagger 文档可访问 `{你的VanBlog地址}/swagger` 查看。

## 开发

```bash
npm install
npm run dev   # 开发模式（watch）
npm run build # 构建生产版本
```
