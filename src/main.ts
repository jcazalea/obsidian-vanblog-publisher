/**
 * VanBlog Publisher – Obsidian plugin
 *
 * Publish markdown documents from Obsidian to a VanBlog instance.
 *   - Uploads embedded images / attachments, replacing local paths.
 *   - Respects front‑matter fields (title, tags, category, slug, …).
 *   - Stores a mapping for later revoke / update.
 */

import {
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	MarkdownView,
	Menu,
	normalizePath,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	VanBlogSettingTab,
	type VanBlogSettings,
} from './settings';
import { VanBlogApiClient, VanBlogApiError } from './api/client';
import type { ArticlePayload, ArticleRecord } from './api/types';
import {
	findEmbeddedFiles,
	applyReplacements,
	parseFrontMatter,
} from './utils/markdown';
import { PublishModal } from './modals/publish-modal';
import { RevokeModal } from './modals/revoke-modal';
import { emptyData, getRecord, setRecord, removeRecord } from './data';

export default class VanBlogPlugin extends Plugin {
	settings!: VanBlogSettings;
	api!: VanBlogApiClient;

	/** Article mapping data */
	private pluginData = emptyData();

	// ──── Lifecycle ─────────────────────────────────────────

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadPluginData();

		this.api = new VanBlogApiClient(
			this.settings.baseUrl,
			this.settings.apiToken,
		);

		// Commands (can be triggered from the command palette)
		this.addCommand({
			id: 'publish-to-vanblog',
			name: 'Publish current file to VanBlog',
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
			name: 'Revoke current file from VanBlog',
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
					item.setTitle('Publish to VanBlog')
						.setIcon('upload')
						.onClick(() => this.publishFile(file));
				});

				const record = getRecord(this.pluginData, file.path);
				if (record?.isPublished) {
					menu.addItem((item) => {
						item.setTitle('Revoke from VanBlog')
							.setIcon('trash')
							.onClick(() => this.revokeFile(file));
					});
				}
			}),
		);

		// Settings tab
		this.addSettingTab(new VanBlogSettingTab(this.app, this));

		new Notice('VanBlog Publisher loaded');
	}

	onunload(): void {
		new Notice('VanBlog Publisher unloaded');
	}

	// ──── Settings ─────────────────────────────────────────

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<VanBlogSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved) as VanBlogSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Keep the API client in sync
		if (this.api) {
			this.api.setCredentials(this.settings.baseUrl, this.settings.apiToken);
		}
	}

	private async loadPluginData(): Promise<void> {
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		const stored = raw?.articles;
		if (stored && typeof stored === 'object') {
			this.pluginData = { articles: stored as Record<string, ArticleRecord> };
		}
	}

	private async savePluginData(): Promise<void> {
		// Merge articles into the settings object so both live under loadData
		const existing =
			((await this.loadData()) as Record<string, unknown>) ?? {};
		existing.articles = this.pluginData.articles;
		await this.saveData(existing);
	}

	// ──── Publish flow ─────────────────────────────────────

	private async publishFile(file: TFile): Promise<void> {
		try {
			await this.doPublish(file);
		} catch (err) {
			this.handleError(err, 'Publish failed');
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

		// 3. Gather article payload from front‑matter + settings
		const payload: ArticlePayload = {
			title,
			content: body,
			tags:
				frontmatter.tags?.length
					? frontmatter.tags
					: this.settings.defaultTags
						? this.settings.defaultTags.split(',').map((t) => t.trim()).filter(Boolean)
						: undefined,
			category: frontmatter.category || this.settings.defaultCategory || undefined,
			top: frontmatter.top,
			password: frontmatter.password,
			hide: frontmatter.hide,
			slug: frontmatter.slug,
		};

		// 4. Handle embedded media if the setting is on
		if (this.settings.autoUploadMedia) {
			const embeddedRefs = findEmbeddedFiles(body, sourceDir);
			if (embeddedRefs.length > 0) {
				new Notice(
					`Uploading ${embeddedRefs.length} embedded file(s)…`,
				);

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

		// 5. Show publish modal for confirmation / editing
		const modal = new PublishModal(this.app, file.name, payload);
		modal.open();
		const result = await modal.waitForResult();

		if (!result.confirmed) {
			new Notice('Publish cancelled');
			return;
		}

		const finalPayload = result.payload;

		// 6. Check for existing published article → update vs create
		const existing = getRecord(this.pluginData, file.path);
		let articleId: string | number;

		if (existing?.isPublished && existing.articleId) {
			// Update
			await this.api.updateArticle(existing.articleId, finalPayload);
			articleId = existing.articleId;
			new Notice(`Updated "${finalPayload.title}" on VanBlog`);
		} else {
			// Create
			const created = await this.api.createArticle(finalPayload);
			articleId = created.id;
			new Notice(`Published "${finalPayload.title}" to VanBlog`);
		}

		// 7. Store mapping
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
			this.handleError(err, 'Revoke failed');
		}
	}

	private async doRevoke(file: TFile): Promise<void> {
		const record = getRecord(this.pluginData, file.path);
		if (!record?.isPublished) {
			new Notice('This file is not published on VanBlog');
			return;
		}

		// Confirmation modal
		const modal = new RevokeModal(this.app, file.name, record.title);
		modal.open();
		const confirmed = await modal.waitForResult();
		if (!confirmed) {
			new Notice('Revoke cancelled');
			return;
		}

		await this.api.deleteArticle(record.articleId);
		removeRecord(this.pluginData, file.path);
		await this.savePluginData();

		new Notice(`Revoked "${record.title}" from VanBlog`);
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

		// Return the URL from the upload response.
		// It may be in `result.url` or the response might use a different key.
		return result.url;
	}

	// ──── Utilities ────────────────────────────────────────

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
