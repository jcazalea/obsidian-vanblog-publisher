/**
 * VanBlog Publisher – settings
 *
 * Connection config, test button, tag & category management (list + CRUD).
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import VanBlogPlugin from './main';

export interface VanBlogSettings {
	baseUrl: string;
	apiToken: string;
	defaultCategory: string;
	defaultTags: string;
	autoUploadMedia: boolean;
}

export const DEFAULT_SETTINGS: VanBlogSettings = {
	baseUrl: '',
	apiToken: '',
	defaultCategory: '',
	defaultTags: '',
	autoUploadMedia: true,
};

export class VanBlogSettingTab extends PluginSettingTab {
	plugin: VanBlogPlugin;

	constructor(app: App, plugin: VanBlogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderConnectionSection(containerEl);
		this.renderTagManagementSection(containerEl);
		this.renderCategoryManagementSection(containerEl);
	}

	// ──── Connection settings ───────────────────────────

	private renderConnectionSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'VanBlog Connection' });

		new Setting(containerEl)
			.setName('VanBlog base URL')
			.setDesc(
				'Your VanBlog instance URL (e.g. https://blog.yourdomain.com).',
			)
			.addText((text) =>
				text
					.setPlaceholder('https://blog.example.com')
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('API token')
			.setDesc('Create a token in VanBlog admin → System Settings → Token Management.')
			.addText((text) =>
				text
					.setPlaceholder('vanblog-token-xxx')
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					}),
			);

		// Test connection + refresh buttons
		new Setting(containerEl)
			.setName('Connection test')
			.setDesc('Verify that the URL and token are correct, then refresh data.')
			.addButton((btn) => {
				btn.setButtonText('Test Connection')
					.setCta()
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText('Testing…');
						await this.plugin.testConnection();
						btn.setDisabled(false);
						btn.setButtonText('Test Connection');
					});
				return btn;
			})
			.addButton((btn) => {
				btn.setButtonText('Refresh Data')
					.onClick(async () => {
						btn.setDisabled(true);
						await this.plugin.fetchTagsAndCategories();
						this.display();
						btn.setDisabled(false);
					});
				return btn;
			});

		containerEl.createEl('hr');
	}

	// ──── Tag management ───────────────────────────────

	private renderTagManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Tag Management' });

		const tags = this.plugin.availableTags;
		const tagItems = tags.map((t) => ({ name: t }));

		if (tagItems.length === 0) {
			containerEl.createEl('p', {
				text: 'No tags loaded. Use "Refresh Data" above or configure URL/token first.',
				attr: { style: 'color: var(--text-muted);' },
			});
		} else {
			const listEl = containerEl.createEl('div', {
				attr: {
					style:
						'max-height: 200px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 0.25rem; margin-bottom: 0.5rem;',
				},
			});

			for (const tag of tagItems) {
				const rowEl = listEl.createEl('div', {
					attr: {
						style:
							'display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--background-modifier-border);',
					},
				});

				rowEl.createEl('span', { text: tag.name });

				const btnGroup = rowEl.createEl('div', {
					attr: { style: 'display: flex; gap: 0.25rem;' },
				});

				// Rename button
				btnGroup.createEl('button', {
					text: 'Rename',
					attr: { style: 'font-size: 0.8rem; padding: 0 0.4rem;' },
				}).onclick = () => {
					this.promptRename('tag', tag.name, async (newName) => {
						const rid = this.plugin.tagIdMap[tag.name];
							if (!rid) return;
							await this.plugin.updateTag(rid, newName);
						this.display();
					});
				};

				// Delete button
				btnGroup.createEl('button', {
					text: 'Delete',
					attr: {
						style:
							'font-size: 0.8rem; padding: 0 0.4rem; color: var(--text-error);',
					},
				}).onclick = () => {
					this.confirmDelete('tag', tag.name, async () => {
						const delTagId = this.plugin.tagIdMap[tag.name]; if (delTagId) this.plugin.deleteTag(delTagId, tag.name);
						this.display();
					});
				};
			}
		}

		// Add tag button
		new Setting(containerEl)
			.setName('Add new tag')
			.addButton((btn) => {
				btn.setButtonText('+ Add Tag')
					.setCta()
					.onClick(() => {
						this.promptCreate('tag', async (name) => {
							await this.plugin.createTag(name);
							this.display();
						});
					});
				return btn;
			});

		containerEl.createEl('hr');
	}

	// ──── Category management ──────────────────────────

	private renderCategoryManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Category Management' });

		const cats = this.plugin.availableCategories;
		const catItems = cats.map((c) => ({ name: c }));

		if (catItems.length === 0) {
			containerEl.createEl('p', {
				text: 'No categories loaded. Use "Refresh Data" above or configure URL/token first.',
				attr: { style: 'color: var(--text-muted);' },
			});
		} else {
			const listEl = containerEl.createEl('div', {
				attr: {
					style:
						'max-height: 200px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 0.25rem; margin-bottom: 0.5rem;',
				},
			});

			for (const cat of catItems) {
				const rowEl = listEl.createEl('div', {
					attr: {
						style:
							'display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--background-modifier-border);',
					},
				});

				rowEl.createEl('span', { text: cat.name });

				const btnGroup = rowEl.createEl('div', {
					attr: { style: 'display: flex; gap: 0.25rem;' },
				});

				// Rename button
				btnGroup.createEl('button', {
					text: 'Rename',
					attr: { style: 'font-size: 0.8rem; padding: 0 0.4rem;' },
				}).onclick = () => {
					this.promptRename('category', cat.name, async (newName) => {
						const catUpdId = this.plugin.categoryIdMap[cat.name]; if (catUpdId) this.plugin.updateCategory(catUpdId, newName);
						this.display();
					});
				};

				// Delete button
				btnGroup.createEl('button', {
					text: 'Delete',
					attr: {
						style:
							'font-size: 0.8rem; padding: 0 0.4rem; color: var(--text-error);',
					},
				}).onclick = () => {
					this.confirmDelete('category', cat.name, async () => {
						const catDelId = this.plugin.categoryIdMap[cat.name]; if (catDelId) this.plugin.deleteCategory(catDelId, cat.name);
						this.display();
					});
				};
			}
		}

		// Add category button
		new Setting(containerEl)
			.setName('Add new category')
			.addButton((btn) => {
				btn.setButtonText('+ Add Category')
					.setCta()
					.onClick(() => {
						this.promptCreate('category', async (name) => {
							await this.plugin.createCategory(name);
							this.display();
						});
					});
				return btn;
			});

		containerEl.createEl('hr');
	}

	// ──── Dialog helpers ───────────────────────────────

	private promptCreate(
		type: string,
		onConfirm: (name: string) => Promise<void>,
	): void {
		const value = prompt(`Enter new ${type} name:`);
		if (!value?.trim()) return;
		onConfirm(value.trim());
	}

	private promptRename(
		type: string,
		oldName: string,
		onConfirm: (newName: string) => Promise<void>,
	): void {
		const value = prompt(`Rename "${oldName}" to:`, oldName);
		if (!value?.trim() || value.trim() === oldName) return;
		onConfirm(value.trim());
	}

	private confirmDelete(
		type: string,
		name: string,
		onConfirm: () => Promise<void>,
	): void {
		if (confirm(`Delete ${type} "${name}"? This cannot be undone.`)) {
			onConfirm();
		}
	}
}
