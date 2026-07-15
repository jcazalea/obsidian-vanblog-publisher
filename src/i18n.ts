/**
 * Internationalisation / 国际化
 *
 * All user‑visible strings in the plugin live here so they can be
 * switched between Chinese and English.
 *
 * Usage:
 *   import { t, useLocale } from './i18n';
 *   useLocale('zh');               // at startup
 *   someEl.setText(t('settings.connection')); // wherever text is needed
 */

import type VanBlogPlugin from './main';

// ──── Locale resolver ──────────────────────────────────────

export type Locale = 'zh' | 'en' | 'obsidian';

let _current: 'zh' | 'en' = 'en';

/**
 * Resolve the effective locale.
 * `obsidian` is resolved by reading the Obsidian app language.
 */
export function resolveLocale(
	locale: Locale,
	plugin?: VanBlogPlugin,
): 'zh' | 'en' {
	if (locale === 'obsidian') {
		// Try Obsidian's language config (in order of reliability)
		try {
			const lang =
				// 1. Obsidian stores the language in localStorage
				window.localStorage.getItem('language') ??
				// 2. Plugin API (may not be available on all versions)
				(plugin?.app as any)?.vault?.getConfig?.('language') ??
				// 3. Browser / OS language
				navigator.language ??
				'en';
			return lang.startsWith('zh') ? 'zh' : 'en';
		} catch {
			return navigator.language?.startsWith('zh') ? 'zh' : 'en';
		}
	}
	return locale;
}

/**
 * Set the current locale (must already be resolved to 'zh' | 'en').
 */
export function useLocale(resolved: 'zh' | 'en'): void {
	_current = resolved;
}

/**
 * Get current effective locale.
 */
export function getLocale(): 'zh' | 'en' {
	return _current;
}

// ──── Translation dictionary ───────────────────────────────

type Dict = Record<string, { zh: string; en: string }>;

const dict: Dict = {
	// ── Settings - Connection ──
	'settings.connection':            { zh: 'VanBlog 连接', en: 'VanBlog Connection' },
	'settings.baseUrl':               { zh: 'VanBlog 地址', en: 'VanBlog base URL' },
	'settings.baseUrlDesc':           { zh: '你的 VanBlog 实例 URL（如 https://blog.example.com）', en: 'Your VanBlog instance URL (e.g. https://blog.example.com).' },
	'settings.baseUrlPlaceholder':    { zh: 'https://blog.example.com', en: 'https://blog.example.com' },
	'settings.apiToken':              { zh: 'API Token', en: 'API token' },
	'settings.apiTokenDesc':          { zh: '在 VanBlog 后台 → 系统设置 → Token 管理中创建', en: 'Create a token in VanBlog admin → System Settings → Token Management.' },
	'settings.apiTokenPlaceholder':   { zh: 'vanblog-token-xxx', en: 'vanblog-token-xxx' },
	'settings.connectionTest':        { zh: '连接测试', en: 'Connection test' },
	'settings.connectionTestDesc':    { zh: '验证地址和 Token 是否正确', en: 'Verify that the URL and token are correct.' },
	'settings.testBtn':               { zh: '测试连接', en: 'Test Connection' },
	'settings.testingBtn':            { zh: '测试中…', en: 'Testing…' },
	'settings.refreshBtn':            { zh: '刷新数据', en: 'Refresh Data' },
	'settings.testSuccess':           { zh: 'VanBlog 连接成功！', en: 'VanBlog connection successful!' },
	'settings.testFailed':            { zh: '连接测试失败', en: 'Connection test failed' },
	'settings.fetchFailed':           { zh: '获取标签和分类失败', en: 'Failed to fetch tags & categories' },
	'settings.notConfigured':         { zh: '请先配置 VanBlog 地址和 Token', en: 'Configure URL and API token first' },

	// ── Settings - Language ──
	'settings.language':              { zh: '语言 / Language', en: 'Language' },
	'settings.languageDesc':          { zh: '选择插件显示语言', en: 'Choose the plugin display language.' },
	'lang.zh':                        { zh: '中文', en: 'Chinese' },
	'lang.en':                        { zh: '英文', en: 'English' },
	'lang.obsidian':                  { zh: '跟随 Obsidian', en: 'Follow Obsidian' },

	// ── Settings - Tag management ──
	'settings.tagManagement':         { zh: '标签管理', en: 'Tag Management' },
	'settings.tagEmpty':              { zh: '暂无标签，请先点击上方"刷新数据"', en: 'No tags loaded. Use "Refresh Data" above or configure URL/token first.' },
	'settings.rename':                { zh: '重命名', en: 'Rename' },
	'settings.delete':                { zh: '删除', en: 'Delete' },
	'settings.addTag':                { zh: '新增标签', en: 'Add new tag' },
	'settings.addTagBtn':             { zh: '+ 新增标签', en: '+ Add Tag' },
	'settings.renamePrompt':          { zh: '请输入新的名称：', en: 'Enter new name:' },
	'settings.deleteConfirm':         { zh: '确定要删除', en: 'Delete' },
	'settings.undoWarning':           { zh: '此操作不可撤销！', en: 'This cannot be undone!' },
	'settings.tagCreated':            { zh: '标签"', en: 'Tag "' },
	'settings.tagCreatedEnd':         { zh: '" 已创建', en: '" created' },
	'settings.tagUpdated':            { zh: '标签已更新为"', en: 'Tag updated to "' },
	'settings.tagUpdatedEnd':         { zh: '"', en: '"' },
	'settings.tagDeleted':            { zh: '标签"', en: 'Tag "' },
	'settings.tagDeletedEnd':         { zh: '" 已删除', en: '" deleted' },
	'settings.createTagFailed':       { zh: '创建标签失败', en: 'Failed to create tag' },
	'settings.updateTagFailed':       { zh: '更新标签失败', en: 'Failed to update tag' },
	'settings.deleteTagFailed':       { zh: '删除标签失败', en: 'Failed to delete tag' },

	// ── Settings - Category management ──
	'settings.categoryManagement':    { zh: '分类管理', en: 'Category Management' },
	'settings.categoryEmpty':         { zh: '暂无分类，请先点击上方"刷新数据"', en: 'No categories loaded. Use "Refresh Data" above or configure URL/token first.' },
	'settings.addCategory':           { zh: '新增分类', en: 'Add new category' },
	'settings.addCategoryBtn':        { zh: '+ 新增分类', en: '+ Add Category' },
	'settings.categoryCreated':       { zh: '分类"', en: 'Category "' },
	'settings.categoryCreatedEnd':    { zh: '" 已创建', en: '" created' },
	'settings.categoryUpdated':       { zh: '分类已更新为"', en: 'Category updated to "' },
	'settings.categoryUpdatedEnd':    { zh: '"', en: '"' },
	'settings.categoryDeleted':       { zh: '分类"', en: 'Category "' },
	'settings.categoryDeletedEnd':    { zh: '" 已删除', en: '" deleted' },
	'settings.createCategoryFailed':  { zh: '创建分类失败', en: 'Failed to create category' },
	'settings.updateCategoryFailed':  { zh: '更新分类失败', en: 'Failed to update category' },
	'settings.deleteCategoryFailed':  { zh: '删除分类失败', en: 'Failed to delete category' },

	// ── Settings - Default publish options ──
	'settings.defaultOptions':        { zh: '默认发布选项', en: 'Default publish options' },
	'settings.defaultCategory':       { zh: '默认分类', en: 'Default category' },
	'settings.defaultCategoryDesc':   { zh: '文档 front-matter 中未指定分类时使用此默认值', en: 'Category used when the file has no `category` front-matter.' },
	'settings.defaultTag':            { zh: '默认标签', en: 'Default tag' },
	'settings.defaultTagDesc':        { zh: '文档 front-matter 中未指定标签时使用此默认值（如需多个标签请在文档中配置 front-matter）', en: 'Tag used when the file has no `tags` front-matter. (Use front-matter for multiple tags.)' },
	'settings.defaultAuthor':         { zh: '默认作者', en: 'Default author' },
	'settings.defaultAuthorDesc':     { zh: '文档 front-matter 中未指定作者时使用此默认值', en: 'Author used when the file has no `author` front-matter.' },
	'settings.defaultAuthorPlaceholder': { zh: '请输入作者名称', en: 'Enter author name' },
	'settings.autoUpload':            { zh: '自动上传媒体文件', en: 'Auto-upload embedded media' },
	'settings.autoUploadDesc':        { zh: '发布时自动将文档中的图片/附件上传到 VanBlog 图床，并替换为远程地址', en: 'Upload images/attachments to VanBlog before publishing and replace local paths with remote URLs.' },
	'settings.none':                  { zh: '— 无 —', en: '— None —' },

	// ── Publish modal ──
	'publish.title':                  { zh: '发布到 VanBlog', en: 'Publish to VanBlog' },
	'publish.titleField':             { zh: '标题', en: 'Title' },
	'publish.titlePlaceholder':       { zh: '文章标题', en: 'Article title' },
	'publish.category':               { zh: '分类', en: 'Category' },
	'publish.tags':                   { zh: '标签', en: 'Tags' },
	'publish.tagsDesc':               { zh: '逗号分隔。使用下拉框添加建议标签', en: 'Comma-separated. Use the dropdown to add suggested tags.' },
	'publish.tagsPlaceholder':        { zh: '标签1, 标签2', en: 'tag1, tag2' },
	'publish.addTag':                 { zh: '— 从已有标签选择 —', en: '— Select existing tag —' },
	'publish.addBtn':                 { zh: '确定', en: 'Add' },
	'publish.noTags':                 { zh: '暂无标签，请输入或从列表选择', en: 'No tags yet — type or choose from the list' },
	'publish.removeTag':              { zh: '移除此标签', en: 'Remove this tag' },
	'publish.slug':                   { zh: 'Slug（可选）', en: 'Slug (optional)' },
	'publish.slugDesc':               { zh: 'URL 友好的标识符。留空则自动生成。', en: 'URL-friendly identifier. Leave empty for auto-generation.' },
	'publish.slugPlaceholder':        { zh: 'my-article-slug', en: 'my-article-slug' },
	'publish.top':                    { zh: '置顶优先级', en: 'Pin priority' },
	'publish.topDesc':                { zh: '0 = 不置顶。数字越大优先级越高。', en: '0 = not pinned. Higher = higher display priority.' },
	'publish.password':               { zh: '密码（可选）', en: 'Password (optional)' },
	'publish.passwordDesc':           { zh: '为文章设置密码保护', en: 'Password-protect this article.' },
	'publish.hide':                   { zh: '在首页隐藏', en: 'Hide from front page' },
	'publish.author':                 { zh: '作者', en: 'Author' },
	'publish.authorPlaceholder':      { zh: '请输入作者名称', en: 'Enter author name' },
	'publish.cancel':                 { zh: '取消', en: 'Cancel' },
	'publish.publish':                { zh: '发布', en: 'Publish' },
	'publish.cancelled':              { zh: '已取消发布', en: 'Publish cancelled' },
	'publish.updated':                { zh: '已在 VanBlog 上更新"', en: 'Updated "' },
	'publish.updatedEnd':             { zh: '"', en: '" on VanBlog' },
	'publish.published':              { zh: '已发布"', en: 'Published "' },
	'publish.publishedEnd':           { zh: '" 到 VanBlog', en: '" to VanBlog' },
	'publish.uploading':              { zh: '正在上传 {count} 个嵌入文件…', en: 'Uploading {count} embedded file(s)…' },
	'publish.untitled':               { zh: '无标题', en: 'Untitled' },

	// ── Revoke modal ──
	'revoke.title':                   { zh: '从 VanBlog 撤回', en: 'Revoke from VanBlog' },
	'revoke.confirm':                 { zh: '确定要从 VanBlog 撤回"', en: 'Are you sure you want to revoke "' },
	'revoke.confirmEnd':              { zh: '"?', en: '" from VanBlog?' },
	'revoke.fileLabel':               { zh: '文件：', en: 'File: ' },
	'revoke.cancel':                  { zh: '取消', en: 'Cancel' },
	'revoke.revoke':                  { zh: '撤回', en: 'Revoke' },
	'revoke.cancelled':               { zh: '已取消撤回', en: 'Revoke cancelled' },
	'revoke.success':                 { zh: '已撤回"', en: 'Revoked "' },
	'revoke.successEnd':              { zh: '"', en: '" from VanBlog' },
	'revoke.notFound':                { zh: '此文件未发布到 VanBlog', en: 'This file is not published on VanBlog' },

	// ── Plugin status ──
	'plugin.loaded':                  { zh: 'VanBlog 发布插件已加载', en: 'VanBlog Publisher loaded' },
	'plugin.unloaded':                { zh: 'VanBlog 发布插件已卸载', en: 'VanBlog Publisher unloaded' },
	'plugin.publishCmd':              { zh: '将当前文件发布到 VanBlog', en: 'Publish current file to VanBlog' },
	'plugin.revokeCmd':               { zh: '从 VanBlog 撤回当前文件', en: 'Revoke current file from VanBlog' },
	'plugin.publishMenu':             { zh: '发布到 VanBlog', en: 'Publish to VanBlog' },
	'plugin.revokeMenu':              { zh: '从 VanBlog 撤回', en: 'Revoke from VanBlog' },
	'plugin.publishFailed':           { zh: '发布失败', en: 'Publish failed' },
	'plugin.revokeFailed':            { zh: '撤回失败', en: 'Revoke failed' },

	// ── Errors ──
	'error.upload':                   { zh: '上传嵌入文件失败', en: 'Failed to upload embedded file' },
};

// ──── Translation function ─────────────────────────────────

/**
 * Translate a key into the current locale.
 *
 * Supports simple `{var}` interpolation:
 *   t('publish.uploading', { count: 3 }) → "正在上传 3 个嵌入文件…"
 */
export function t(key: string, vars?: Record<string, string | number>): string {
	const entry = dict[key];
	if (!entry) return key;

	let msg = entry[_current] ?? entry.en ?? key;

	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			msg = msg.replace(`{${k}}`, String(v));
		}
	}

	return msg;
}
