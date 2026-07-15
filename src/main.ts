/**
 * VanBlog Publisher – Obsidian plugin
 *
 * Publish markdown documents from Obsidian to a VanBlog instance.
 *   - Uploads embedded images / attachments, replacing local paths.
 *   - Respects front‑matter fields (title, tags, category, slug, …).
 *   - Stores a mapping for later revoke / update.
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
import type { ArticlePayload, ArticleRecord, ArticleResponse } from './api/types';
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
import { emptyData, getRecord, setRecord, removeRecord } from './data';
import { t, useLocale, resolveLocale } from './i18n';

export default class VanBlogPlugin extends Plugin {
	settings!: VanBlogSettings;
	api!: VanBlogApiClient;

	/** Article mapping data */
	private pluginData = emptyData();

	/** Tags & categories fetched from VanBlog — used in dropdown UIs */
	availableTags: string[] = [];
	availableCategories: string[] = [];

	/** Maps tag/category name -> id for CRUD operations */
	tagIdMap: Record<string, string | number> = {};
	categoryIdMap: Record<string, string | number> = {};

	// ──── Lifecycle ─────────────────────────────────────────

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadPluginData();

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
				const record = getRecord(this.pluginData, file.path);
				if (!record || !record.isPublished) return false;
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

				menu.addItem((item) => {
					item.setTitle(t('plugin.publishMenu'))
						.setIcon('upload')
						.onClick(() => this.publishFile(file));
				});

				const record = getRecord(this.pluginData, file.path);
				if (record?.isPublished) {
					menu.addItem((item) => {
						item.setTitle(t('plugin.revokeMenu'))
							.setIcon('trash')
							.onClick(() => this.revokeFile(file));
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
			articles: this.pluginData.articles,
			availableTags: this.availableTags,
			availableCategories: this.availableCategories,
		};
		await this.saveData(data);
		// Keep the API client in sync
		if (this.api) {
			this.api.setCredentials(this.settings.baseUrl, this.settings.apiToken);
		}
	}

	private async loadPluginData(): Promise<void> {
		const data =
			((await this.loadData()) as Record<string, unknown>) ?? {};
		const stored = data.articles;
		if (stored && typeof stored === 'object') {
			this.pluginData = {
				articles: stored as Record<string, ArticleRecord>,
			};
		}
	}

	private async savePluginData(): Promise<void> {
		const data: Record<string, unknown> = {
			settings: this.settings,
			articles: this.pluginData.articles,
			availableTags: this.availableTags,
			availableCategories: this.availableCategories,
		};
		await this.saveData(data);
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

				const replacements: { fullMatch: string; remoteUrl: string }[] = [];
				for (const ref of embeddedRefs) {
					try {
						const remoteUrl = await this.uploadEmbeddedFile(file, ref.filePath);
						replacements.push({
							fullMatch: ref.fullMatch,
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
		//    Prefer the server-side check (existingArticle) over local data
		//    to avoid creating duplicates when local data is out of sync.
		const existingLocal = getRecord(this.pluginData, file.path);
		const serverArticleId = existingArticle?.id ?? existingLocal?.articleId;
		let articleId: string | number;

		if (serverArticleId) {
			// Update existing article (exists on VanBlog server)
			const updatedRes = await this.api.updateArticle(serverArticleId, finalPayload);
			articleId = serverArticleId;
			await this.writeVanBlogProps(file, articleId, finalPayload, updatedRes.pathname);
			new Notice(t('publish.updated') + finalPayload.title + t('publish.updatedEnd'));
		} else {
			// Create new article
			const created = await this.api.createArticle(finalPayload);
			articleId = created.id;
			await this.writeVanBlogProps(file, articleId, finalPayload, created.pathname);
			new Notice(t('publish.published') + finalPayload.title + t('publish.publishedEnd'));
		}

		// 8. Store mapping
		const record: ArticleRecord = {
			filePath: file.path,
			articleId,
			title: finalPayload.title,
			publishedAt: new Date().toISOString(),
			isPublished: true,
		};
		setRecord(this.pluginData, file.path, record);
		await this.savePluginData();
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
		const record = getRecord(this.pluginData, file.path);
		if (!record?.isPublished) {
			new Notice(t('revoke.notFound'));
			return;
		}

		// Confirmation modal
		const modal = new RevokeModal(this.app, file.name, record.title);
		modal.open();
		const confirmed = await modal.waitForResult();
		if (!confirmed) {
			new Notice(t('revoke.cancelled'));
			return;
		}

		await this.api.deleteArticle(record.articleId);
		removeRecord(this.pluginData, file.path);
		await this.savePluginData();

		new Notice(t('revoke.success') + record.title + t('revoke.successEnd'));
	}

	// ──── Embedded file upload ─────────────────────────────

	/**
	 * Upload a single embedded file (image / attachment) to VanBlog.
	 *
	 * @param sourceFile The markdown file that references the embedded file
	 * @param embeddedFilePath The (possibly relative) path from the markdown
	 * @returns The remote URL returned by VanBlog
	 */
	private async uploadEmbeddedFile(
		sourceFile: TFile,
		embeddedFilePath: string,
	): Promise<string> {
		// Resolve the embedded file relative to the vault
		const resolvedPath = normalizePath(embeddedFilePath);
		const targetFile = this.app.vault.getAbstractFileByPath(resolvedPath);

		if (!(targetFile instanceof TFile)) {
			throw new Error(`File not found in vault: ${resolvedPath}`);
		}

		// Read file as ArrayBuffer
		const buffer = await this.app.vault.readBinary(targetFile);
		const mimeType = this.getMimeType(targetFile.extension);
		const result = await this.api.uploadFile(
			targetFile.name,
			buffer,
			mimeType,
		);

		return result.url;
	}

	// ──── Utilities ────────────────────────────────────────

	// ---- Write VanBlog properties to file -------------------------------

	private async writeVanBlogProps(
		file: TFile,
		articleId: string | number,
		payload: ArticlePayload,
		pathname: string,
	): Promise<void> {
		try {
			const baseUrl = this.settings.baseUrl.replace(/\/+$/, '');
			const url = pathname ? `${baseUrl}/article/${pathname}` : baseUrl;
			const props: VanBlogFileProps = {
				'vanblog-id': articleId,
				'vanblog-published-at': new Date().toISOString(),
				'vanblog-url': url,
			};
			if (payload.tags && payload.tags.length > 0) {
				props['vanblog-tags'] = payload.tags;
			}
			if (payload.category) {
				props['vanblog-category'] = payload.category;
			}

			const currentContent = await this.app.vault.read(file);
			const newContent = addVanBlogProperties(currentContent, props);
			await this.app.vault.modify(file, newContent);
		} catch (err) {
			console.error('[VanBlog] Failed to write properties:', err);
		}
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
