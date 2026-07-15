/**
 * VanBlog Publisher – Obsidian plugin
 *
 * Publish markdown documents from Obsidian to a VanBlog instance.
 *   - Uploads embedded images / attachments, replacing local paths.
 *   - Respects front‑matter fields (title, tags, category, slug, …).
 *   - Writes VanBlog properties (vanblog-id, vanblog-url, …) to front‑matter.
 *   - Fetches available tags & categories on startup for dropdown UIs.
 */

import {
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	Menu,
	normalizePath,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	VanBlogSettingTab,
	type VanBlogSettings,
} from './settings';
import { VanBlogApiClient, VanBlogApiError } from './api/client';
import type { ArticlePayload, ArticleResponse } from './api/types';
import {
	findEmbeddedFiles,
	applyReplacements,
	parseFrontMatter,
	stripVanBlogProperties,
	addVanBlogProperties,
	type VanBlogFileProps,
} from './utils/markdown';
import { PublishModal } from './modals/publish-modal';
import { RevokeModal } from './modals/revoke-modal';
import { t, useLocale, resolveLocale } from './i18n';

export default class VanBlogPlugin extends Plugin {
	settings!: VanBlogSettings;
	api!: VanBlogApiClient;

	/** Tags & categories fetched from VanBlog — used in dropdown UIs */
	availableTags: string[] = [];
	availableCategories: string[] = [];

	/** Maps tag/category name -> id for CRUD operations */
	tagIdMap: Record<string, string | number> = {};
	categoryIdMap: Record<string, string | number> = {};

	// ──── Lifecycle ─────────────────────────────────────────

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialise i18n locale (resolve 'obsidian' to actual language)
		useLocale(resolveLocale(this.settings.locale, this));
		this.api = new VanBlogApiClient(
			this.settings.baseUrl,
			this.settings.apiToken,
		);

		// Auto-fetch tags & categories when credentials are available
		if (this.settings.baseUrl && this.settings.apiToken) {
			this.fetchTagsAndCategories();
		}

		// Commands (can be triggered from the command palette)
		this.addCommand({
			id: 'publish-to-vanblog',
			name: t('plugin.publishCmd'),
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') return false;
				if (!checking) {
					this.publishFile(file);
				}
				return true;
			},
		});

		this.addCommand({
			id: 'revoke-from-vanblog',
			name: t('plugin.revokeCmd'),
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== 'md') return false;
				if (!checking) {
					this.revokeFile(file);
				}
				return true;
			},
		});

		// File explorer context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;

				// Use metadataCache (synchronous) to check vanblog-id in frontmatter
				const cache = this.app.metadataCache.getFileCache(file);
				const vanblogId = cache?.frontmatter?.['vanblog-id'] ?? null;

				if (vanblogId != null) {
					// Already published — show Update and Revoke
					menu.addItem((item) => {
						item.setTitle(t('plugin.updateMenu'))
							.setIcon('sync')
							.onClick(() => this.publishFile(file));
					});
					menu.addItem((item) => {
						item.setTitle(t('plugin.revokeMenu'))
							.setIcon('trash')
							.onClick(() => this.revokeFile(file));
					});
				} else {
					// Not published — show Publish
					menu.addItem((item) => {
						item.setTitle(t('plugin.publishMenu'))
							.setIcon('upload')
							.onClick(() => this.publishFile(file));
					});
				}
			}),
		);

		// Settings tab
		this.addSettingTab(new VanBlogSettingTab(this.app, this));

		new Notice(t('plugin.loaded'));
	}

	onunload(): void {
		new Notice(t('plugin.unloaded'));
	}

	// ──── Settings ─────────────────────────────────────────

	async loadSettings(): Promise<void> {
		const data = ((await this.loadData()) as Record<string, unknown>) ?? {};
		const saved = data.settings as Partial<VanBlogSettings> | undefined;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			saved,
		) as VanBlogSettings;

		// Restore cached tag/category arrays from persisted data
		const storedTags = data.availableTags as string[] | undefined;
		if (Array.isArray(storedTags)) this.availableTags = storedTags;
		const storedCats = data.availableCategories as string[] | undefined;
		if (Array.isArray(storedCats)) this.availableCategories = storedCats;
	}

	async saveSettings(): Promise<void> {
		const data: Record<string, unknown> = {
			settings: this.settings,
			availableTags: this.availableTags,
			availableCategories: this.availableCategories,
		};
		await this.saveData(data);
		// Keep the API client in sync
		if (this.api) {
			this.api.setCredentials(this.settings.baseUrl, this.settings.apiToken);
		}
	}

	// ──── Fetch tags & categories from VanBlog ────────────

	/**
	 * Fetch available tags & categories from the VanBlog API and cache
	 * them so the UIs (settings, publish modal) can offer dropdowns.
	 *
	 * Called automatically on startup when credentials are configured,
	 * and can also be invoked manually via the "Refresh" buttons in settings.
	 */
	async fetchTagsAndCategories(): Promise<void> {
		if (!this.settings.baseUrl || !this.settings.apiToken) {
			new Notice(t('settings.notConfigured'));
			return;
		}

		try {
			const [tags, cats] = await Promise.all([
				this.api.getTags(),
				this.api.getCategories(),
			]);

			if (tags && tags.length > 0) {
				this.availableTags = [
					...new Set(tags.filter(Boolean).sort()),
				];
			}
			if (cats && cats.length > 0) {
				this.availableCategories = [
					...new Set(cats.filter(Boolean).sort()),
				];
			}

			await this.saveSettings();
		} catch (err) {
			this.handleError(err, t('settings.fetchFailed'));
		}
	}


		// ---- Connection test --------------------------------------------

		async testConnection(): Promise<boolean> {
			try {
				const ok = await this.api.testConnection();
				if (ok) {
					new Notice(t('settings.testSuccess'));
				}
				return ok;
			} catch (err) {
				this.handleError(err, t('settings.testFailed'));
				return false;
			}
		}

		// ---- Tag management helpers -------------------------------------

		async createTag(name: string): Promise<void> {
			try {
				await this.api.createTag(name);
				new Notice(t('settings.tagCreated') + name + t('settings.tagCreatedEnd'));
				await this.fetchTagsAndCategories();
			} catch (err) {
				this.handleError(err, t('settings.createTagFailed'));
			}
		}

		async updateTag(id: string | number, name: string): Promise<void> {
			try {
				await this.api.updateTag(id, name);
				new Notice(t('settings.tagUpdated') + name + t('settings.tagUpdatedEnd'));
				await this.fetchTagsAndCategories();
			} catch (err) {
				this.handleError(err, t('settings.updateTagFailed'));
			}
		}

		async deleteTag(id: string | number, name: string): Promise<void> {
			try {
				await this.api.deleteTag(id);
				new Notice(t('settings.tagDeleted') + name + t('settings.tagDeletedEnd'));
				await this.fetchTagsAndCategories();
			} catch (err) {
				this.handleError(err, t('settings.deleteTagFailed'));
			}
		}

		// ---- Category management helpers --------------------------------

		async createCategory(name: string): Promise<void> {
			try {
				await this.api.createCategory(name);
				new Notice(t('settings.categoryCreated') + name + t('settings.categoryCreatedEnd'));
				await this.fetchTagsAndCategories();
			} catch (err) {
				this.handleError(err, t('settings.createCategoryFailed'));
			}
		}

		async updateCategory(id: string | number, name: string): Promise<void> {
			try {
				await this.api.updateCategory(id, name);
				new Notice(t('settings.categoryUpdated') + name + t('settings.categoryUpdatedEnd'));
				await this.fetchTagsAndCategories();
			} catch (err) {
				this.handleError(err, t('settings.updateCategoryFailed'));
			}
		}

		async deleteCategory(id: string | number, name: string): Promise<void> {
			try {
				await this.api.deleteCategory(id);
				new Notice(t('settings.categoryDeleted') + name + t('settings.categoryDeletedEnd'));
				await this.fetchTagsAndCategories();
			} catch (err) {
				this.handleError(err, t('settings.deleteCategoryFailed'));
			}
		}

	// ──── Publish flow ─────────────────────────────────────

	private async publishFile(file: TFile): Promise<void> {
		try {
			await this.doPublish(file);
		} catch (err) {
			this.handleError(err, t('plugin.publishFailed'));
		}
	}

	private async doPublish(file: TFile): Promise<void> {
		// 1. Read file content
		const content = await this.app.vault.read(file);
		const sourceDir = file.parent?.path ?? '';

		// 2. Parse front‑matter
		const { frontmatter, body } = parseFrontMatter(content);
		const title =
			frontmatter.title ?? file.basename;

		// 3. If the file has a vanblog-id, fetch the existing article to pre-fill
		let existingArticle: ArticleResponse | null = null;
		if (frontmatter.vanblogId) {
			try {
				existingArticle = await this.api.getArticle(frontmatter.vanblogId);
			} catch {
				// Ignore fetch errors; fall back to local data
			}
		}

		// 4. Gather article payload for modal pre‑fill
		//    Priority: existing server data > settings defaults > front‑matter
		//    The modal lets the user review & edit; the edited result (finalPayload)
		//    is what actually gets sent to the VanBlog API on confirm.
		const now = new Date().toISOString();
		const payload: ArticlePayload = {
			title: existingArticle?.title || title || '',
			content: existingArticle?.content || body || '',
			tags:
				existingArticle?.tags?.length
					? existingArticle.tags
					: frontmatter.tags?.length
						? frontmatter.tags
						: this.settings.defaultTags
							? this.settings.defaultTags.split(',').map((t) => t.trim()).filter(Boolean)
							: undefined,
			category: existingArticle?.category || frontmatter.category || this.settings.defaultCategory || undefined,
			top: existingArticle?.top ?? frontmatter.top,
			hidden: existingArticle?.hidden ?? frontmatter.hide ?? this.settings.defaultHide,
			private: existingArticle?.private ?? (frontmatter.password ? true : undefined),
			password: existingArticle?.password || frontmatter.password || undefined,
			pathname: existingArticle?.pathname || frontmatter.slug,
			copyright: existingArticle?.copyright || frontmatter.copyright,
			author: existingArticle?.author || frontmatter.author || this.settings.defaultAuthor || undefined,
			createdAt: existingArticle?.createdAt || frontmatter.date || now,
			updatedAt: now,
		};

		// 5. Handle embedded media if the setting is on
		if (this.settings.autoUploadMedia) {
			const embeddedRefs = findEmbeddedFiles(body, sourceDir);
			if (embeddedRefs.length > 0) {
				new Notice(t('publish.uploading', { count: embeddedRefs.length }));

				const replacements: { fullMatch: string; rawPath: string; remoteUrl: string }[] = [];
				for (const ref of embeddedRefs) {
					try {
						const remoteUrl = await this.uploadEmbeddedFile(file, ref.rawPath);
						replacements.push({
							fullMatch: ref.fullMatch,
							rawPath: ref.rawPath,
							remoteUrl,
						});
					} catch (err) {
						console.warn(
							`[VanBlog] Failed to upload "${ref.filePath}":`,
							err,
						);
						// Keep the original reference; don't block the whole publish
					}
				}

				if (replacements.length > 0) {
					payload.content = applyReplacements(body, replacements);
				}
			}
		}

		// 6. Show publish modal for confirmation / editing — pass available tags & categories
		const modal = new PublishModal(
			this.app,
			file.name,
			payload,
			this.availableTags,
			this.availableCategories,
		);
		modal.open();
		const result = await modal.waitForResult();
		if (!result.confirmed) {
			new Notice(t('publish.cancelled'));
			return;
		}

		const finalPayload = result.payload;

		// 7. Check for existing published article → update vs create
		//    Use server-side check (existingArticle) to determine if this is
		//    an update or new publish. The frontmatter vanblog-id is the source of truth.
		const serverArticleId = existingArticle?.id ?? frontmatter.vanblogId;

		if (serverArticleId) {
			// Update existing article (exists on VanBlog server)
			const updatedRes = await this.api.updateArticle(serverArticleId, finalPayload);
			await this.writeVanBlogProps(file, serverArticleId, finalPayload, updatedRes.pathname);
			new Notice(t('publish.updated') + finalPayload.title + t('publish.updatedEnd'));
		} else {
			// Create new article
			const created = await this.api.createArticle(finalPayload);
			await this.writeVanBlogProps(file, created.id, finalPayload, created.pathname);
			new Notice(t('publish.published') + finalPayload.title + t('publish.publishedEnd'));
		}
	}

	// ──── Revoke flow ──────────────────────────────────────

	private async revokeFile(file: TFile): Promise<void> {
		try {
			await this.doRevoke(file);
		} catch (err) {
			this.handleError(err, t('plugin.revokeFailed'));
		}
	}

	private async doRevoke(file: TFile): Promise<void> {
		// Read frontmatter to get vanblog-id
		const content = await this.app.vault.read(file);
		const { frontmatter } = parseFrontMatter(content);

		if (!frontmatter.vanblogId) {
			new Notice(t('revoke.notFound'));
			return;
		}

		const title = frontmatter.title ?? file.basename;

		// Confirmation modal
		const modal = new RevokeModal(this.app, file.name, title);
		modal.open();
		const confirmed = await modal.waitForResult();
		if (!confirmed) {
			new Notice(t('revoke.cancelled'));
			return;
		}

		// Delete from VanBlog server
		await this.api.deleteArticle(frontmatter.vanblogId);

		// Strip vanblog properties from frontmatter
		const newContent = stripVanBlogProperties(content);
		await this.app.vault.modify(file, newContent);

		new Notice(t('revoke.success') + title + t('revoke.successEnd'));
	}

	// ──── Embedded file upload ─────────────────────────────

	/**
	 * Upload a single embedded file (image / attachment) to VanBlog.
	 *
	 * @param sourceFile The markdown file that references the embedded file
	 * @param linkText The raw link text from the markdown (e.g. "image.png" or "folder/image.png")
	 * @returns The remote URL returned by VanBlog
	 */
	private async uploadEmbeddedFile(
		sourceFile: TFile,
		linkText: string,
	): Promise<string> {
		// Convert relative paths (./ ../) to absolute vault paths
		let resolvedLink = linkText;
		if (linkText.startsWith('./') || linkText.startsWith('../')) {
			const sourceDir = sourceFile.parent?.path ?? '';
			const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath ?? '';
			const absPath = linkText.startsWith('./')
				? `${sourceDir}/${linkText.slice(2)}`
				: this.resolveRelativePath(sourceDir, linkText);
			resolvedLink = normalizePath(`${vaultPath}/${absPath}`);
		}

		// Use Obsidian's metadataCache.getFirstLinkpathDest to resolve the link
		// (handles attachment folders, subfolders, etc.)
		const targetFile = this.app.metadataCache.getFirstLinkpathDest(resolvedLink, sourceFile.path);

		if (!(targetFile instanceof TFile)) {
			throw new Error(`Could not resolve link "${linkText}" from "${sourceFile.path}"`);
		}

		// Read file as ArrayBuffer
		const buffer = await this.app.vault.readBinary(targetFile);
		const mimeType = this.getMimeType(targetFile.extension);
		// Generate a random 16-char filename to avoid encoding issues with non-ASCII names
		const randomName = this.generateRandomName(16) + '.' + targetFile.extension;
		const result = await this.api.uploadFile(
			randomName,
			buffer,
			mimeType,
		);

		return result.src;
	}

	// ──── Published documents management ──────────────────

	/**
	 * Scan the vault for files with vanblog-id in frontmatter,
	 * then concurrently verify each against VanBlog via GET /api/admin/article/:id.
	 */
	async scanPublishedDocs(): Promise<{ file: TFile; vanblogId: string | number; existsOnVanBlog: boolean }[]> {
		// 1. Collect local published docs
		const files = this.app.vault.getMarkdownFiles();
		const localItems: { file: TFile; vanblogId: string | number }[] = [];
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const vanblogId = cache?.frontmatter?.['vanblog-id'];
			if (vanblogId != null) {
				localItems.push({ file, vanblogId });
			}
		}

		if (localItems.length === 0) return [];

		// 2. Concurrently verify each ID against VanBlog
		const verifications = await Promise.all(
			localItems.map(async (item) => {
				let exists = false;
				try {
					const article = await this.api.getArticle(item.vanblogId);
					exists = article?.id != null;
				} catch {
					exists = false;
				}
				return { ...item, existsOnVanBlog: exists };
			}),
		);

		return verifications;
	}

	/**
	 * Clear all vanblog-* properties from a file's frontmatter.
	 */
	async clearVanBlogProps(file: TFile): Promise<void> {
		const content = await this.app.vault.read(file);
		const newContent = stripVanBlogProperties(content);
		await this.app.vault.modify(file, newContent);
	}

	// ──── Utilities ────────────────────────────────────────

	/**
	 * Resolve a relative path (with ../) against a base directory.
	 * e.g. ("folder/sub", "../image.png") → "folder/image.png"
	 */
	private resolveRelativePath(baseDir: string, relativePath: string): string {
		const baseParts = baseDir ? baseDir.split('/') : [];
		const relParts = relativePath.split('/');
		for (const part of relParts) {
			if (part === '..') {
				baseParts.pop();
			} else if (part !== '.' && part !== '') {
				baseParts.push(part);
			}
		}
		return baseParts.join('/');
	}

	/**
	 * Generate a random alphanumeric string of the given length.
	 */
	private generateRandomName(length: number): string {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (b) => chars[b % chars.length]).join('');
	}

	// ---- Write VanBlog properties to file -------------------------------

	private async writeVanBlogProps(
		file: TFile,
		articleId: string | number,
		payload: ArticlePayload,
		pathname: string,
	): Promise<void> {
		try {
			const baseUrl = this.settings.baseUrl.replace(/\/+$/, '');
			const url = pathname ? `${baseUrl}/post/${pathname}` : baseUrl;
			const props: VanBlogFileProps = {
				'vanblog-id': articleId,
				'vanblog-published-at': this.formatDate(new Date()),
				'vanblog-url': url,
			};

			const currentContent = await this.app.vault.read(file);
			const newContent = addVanBlogProperties(currentContent, props);
			await this.app.vault.modify(file, newContent);
		} catch (err) {
			console.error('[VanBlog] Failed to write properties:', err);
		}
	}

	private formatDate(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
	}

	private getMimeType(ext: string): string {
		const map: Record<string, string> = {
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			bmp: 'image/bmp',
			svg: 'image/svg+xml',
			webp: 'image/webp',
			mp4: 'video/mp4',
			webm: 'video/webm',
			ogg: 'video/ogg',
			mov: 'video/quicktime',
			mp3: 'audio/mpeg',
			wav: 'audio/wav',
			flac: 'audio/flac',
			aac: 'audio/aac',
			pdf: 'application/pdf',
		};
		return map[ext.toLowerCase()] ?? 'application/octet-stream';
	}

	private handleError(err: unknown, context: string): void {
		if (err instanceof VanBlogApiError) {
			new Notice(
				`${context}: ${err.message} (status ${err.status ?? 'unknown'})`,
			);
		} else if (err instanceof Error) {
			new Notice(`${context}: ${err.message}`);
		} else {
			new Notice(`${context}: an unknown error occurred`);
		}
		console.error(`[VanBlog] ${context}`, err);
	}
}
