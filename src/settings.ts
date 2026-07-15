/**
 * VanBlog Publisher – settings
 *
 * Connection config, test button, tag & category management (list + CRUD).
 * Fully internationalised (中文 / English).
 */

import { App, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import VanBlogPlugin from './main';
import { t, useLocale, resolveLocale, type Locale } from './i18n';
import { InputModal, ConfirmModal } from './modals/input-modal';

export interface VanBlogSettings {
	baseUrl: string;
	apiToken: string;
	defaultCategory: string;
	defaultTags: string;
	defaultAuthor: string;
	defaultHide: boolean;
	autoUploadMedia: boolean;
	deleteFilesOnRevoke: boolean;
	locale: Locale;
}

export const DEFAULT_SETTINGS: VanBlogSettings = {
	baseUrl: '',
	apiToken: '',
	defaultCategory: '',
	defaultTags: '',
	defaultAuthor: '',
	defaultHide: false,
	autoUploadMedia: true,
	deleteFilesOnRevoke: false,
	locale: 'obsidian',
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
		this.renderLanguageSection(containerEl);
		this.renderDefaultOptionsSection(containerEl);
		this.renderTagManagementSection(containerEl);
		this.renderCategoryManagementSection(containerEl);
		this.renderPublishedDocsSection(containerEl);
	}

	// ──── Connection settings ───────────────────────────

	private renderConnectionSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: t('settings.connection') });

		new Setting(containerEl)
			.setName(t('settings.baseUrl'))
			.setDesc(t('settings.baseUrlDesc'))
			.addText((text) =>
				text
					.setPlaceholder(t('settings.baseUrlPlaceholder'))
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t('settings.apiToken'))
			.setDesc(t('settings.apiTokenDesc'))
			.addText((text) =>
				text
					.setPlaceholder(t('settings.apiTokenPlaceholder'))
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t('settings.connectionTest'))
			.setDesc(t('settings.connectionTestDesc'))
			.addButton((btn) => {
				btn.setButtonText(t('settings.testBtn'))
					.setCta()
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText(t('settings.testingBtn'));
						await this.plugin.testConnection();
						btn.setDisabled(false);
						btn.setButtonText(t('settings.testBtn'));
					});
				return btn;
			});

		containerEl.createEl('hr');
	}

	// ──── Language ─────────────────────────────────────

	private renderLanguageSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: t('settings.language') });

		new Setting(containerEl)
			.setName(t('settings.language'))
			.setDesc(t('settings.languageDesc'))
			.addDropdown((dropdown) => {
				dropdown.addOption('obsidian', t('lang.obsidian'));
				dropdown.addOption('zh', t('lang.zh'));
				dropdown.addOption('en', t('lang.en'));
				dropdown.setValue(this.plugin.settings.locale);
				dropdown.onChange(async (value) => {
					this.plugin.settings.locale = value as Locale;
					await this.plugin.saveSettings();
					// Apply immediately so the UI re-renders in the chosen language
					useLocale(resolveLocale(value as Locale, this.plugin));
					this.display();
				});
			});

		containerEl.createEl('hr');
	}

	// ──── Default publish options ──────────────────────

	private renderDefaultOptionsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: t('settings.defaultOptions') });

		// Default category — dropdown from available categories
		const catOptions = new Set(this.plugin.availableCategories);
		const currentCat = this.plugin.settings.defaultCategory;
		if (currentCat && !catOptions.has(currentCat)) {
			catOptions.add(currentCat);
		}

		new Setting(containerEl)
			.setName(t('settings.defaultCategory'))
			.setDesc(t('settings.defaultCategoryDesc'))
			.addDropdown((dropdown) => {
				dropdown.addOption('', t('settings.none'));
				for (const c of [...catOptions].sort()) {
					if (c) dropdown.addOption(c, c);
				}
				dropdown.setValue(currentCat);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultCategory = value;
					await this.plugin.saveSettings();
				});
			});

		// Default tag — dropdown from available tags
		const tagOptions = new Set(this.plugin.availableTags);
		const currentTag = this.plugin.settings.defaultTags;
		if (currentTag && !tagOptions.has(currentTag)) {
			tagOptions.add(currentTag);
		}

		new Setting(containerEl)
			.setName(t('settings.defaultTag'))
			.setDesc(t('settings.defaultTagDesc'))
			.addDropdown((dropdown) => {
				dropdown.addOption('', t('settings.none'));
				for (const tag of [...tagOptions].sort()) {
					if (tag) dropdown.addOption(tag, tag);
				}
				dropdown.setValue(currentTag);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultTags = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(t('settings.defaultAuthor'))
			.setDesc(t('settings.defaultAuthorDesc'))
			.addText((text) =>
				text
					.setPlaceholder(t('settings.defaultAuthorPlaceholder'))
					.setValue(this.plugin.settings.defaultAuthor)
					.onChange(async (value) => {
						this.plugin.settings.defaultAuthor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t('settings.defaultHide'))
			.setDesc(t('settings.defaultHideDesc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.defaultHide)
					.onChange(async (value) => {
						this.plugin.settings.defaultHide = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t('settings.autoUpload'))
			.setDesc(t('settings.autoUploadDesc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoUploadMedia)
					.onChange(async (value) => {
						this.plugin.settings.autoUploadMedia = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t('settings.deleteFilesOnRevoke'))
			.setDesc(t('settings.deleteFilesOnRevokeDesc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.deleteFilesOnRevoke)
					.onChange(async (value) => {
						this.plugin.settings.deleteFilesOnRevoke = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl('hr');
	}

	// ──── Tag management ───────────────────────────────

	private renderTagManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: t('settings.tagManagement') });

		// Refresh button for tags
		new Setting(containerEl)
			.addButton((btn) => {
				btn.setButtonText(t('settings.refreshBtn'))
					.onClick(async () => {
						btn.setDisabled(true);
						await this.plugin.fetchTagsAndCategories();
						this.display();
						btn.setDisabled(false);
					});
				return btn;
			});

		const tags = this.plugin.availableTags;

		if (tags.length === 0) {
			containerEl.createEl('p', {
				text: t('settings.tagEmpty'),
				attr: { style: 'color: var(--text-muted);' },
			});
		} else {
			const listEl = containerEl.createEl('div', {
				attr: {
					style: 'max-height: 200px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 0.25rem; margin-bottom: 0.5rem;',
				},
			});

			for (const tagName of tags) {
				const rowEl = listEl.createEl('div', {
					attr: {
						style: 'display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--background-modifier-border);',
					},
				});

				rowEl.createEl('span', { text: tagName });

				const btnGroup = rowEl.createEl('div', {
					attr: { style: 'display: flex; gap: 0.25rem;' },
				});

				/*btnGroup.createEl('button', {
					text: t('settings.rename'),
					attr: { style: 'font-size: 0.8rem; padding: 0 0.4rem;' },
				}).onclick = async () => {
					await this.promptRename('tag', tagName, async (newName) => {
						const id = this.plugin.tagIdMap[tagName];
						if (!id) return;
						await this.plugin.updateTag(id, newName);
						this.display();
					});
				};*/

				/*btnGroup.createEl('button', {
					text: t('settings.delete'),
					attr: { style: 'font-size: 0.8rem; padding: 0 0.4rem; color: var(--text-error);' },
				}).onclick = async () => {
					await this.confirmDelete(t('settings.tagManagement'), tagName, async () => {
						const id = this.plugin.tagIdMap[tagName];
						if (!id) return;
						await this.plugin.deleteTag(id, tagName);
						this.display();
					});
				};*/
			}
		}

		// (Add-tag button removed — tags are auto‑managed by VanBlog)

		containerEl.createEl('hr');
	}

	// ──── Category management ──────────────────────────

	private renderCategoryManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: t('settings.categoryManagement') });

		// Refresh button for categories
		new Setting(containerEl)
			.addButton((btn) => {
				btn.setButtonText(t('settings.refreshBtn'))
					.onClick(async () => {
						btn.setDisabled(true);
						await this.plugin.fetchTagsAndCategories();
						this.display();
						btn.setDisabled(false);
					});
				return btn;
			});

		const cats = this.plugin.availableCategories;

		if (cats.length === 0) {
			containerEl.createEl('p', {
				text: t('settings.categoryEmpty'),
				attr: { style: 'color: var(--text-muted);' },
			});
		} else {
			const listEl = containerEl.createEl('div', {
				attr: {
					style: 'max-height: 200px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 0.25rem; margin-bottom: 0.5rem;',
				},
			});

			for (const catName of cats) {
				const rowEl = listEl.createEl('div', {
					attr: {
						style: 'display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--background-modifier-border);',
					},
				});

				rowEl.createEl('span', { text: catName });

				const btnGroup = rowEl.createEl('div', {
					attr: { style: 'display: flex; gap: 0.25rem;' },
				});

				/*btnGroup.createEl('button', {
					text: t('settings.rename'),
					attr: { style: 'font-size: 0.8rem; padding: 0 0.4rem;' },
				}).onclick = async () => {
					await this.promptRename('category', catName, async (newName) => {
						const id = this.plugin.categoryIdMap[catName];
						if (!id) return;
						await this.plugin.updateCategory(id, newName);
						this.display();
					});
				};*/

				/*btnGroup.createEl('button', {
					text: t('settings.delete'),
					attr: { style: 'font-size: 0.8rem; padding: 0 0.4rem; color: var(--text-error);' },
				}).onclick = async () => {
					await this.confirmDelete(t('settings.categoryManagement'), catName, async () => {
						const id = this.plugin.categoryIdMap[catName];
						if (!id) return;
						await this.plugin.deleteCategory(id, catName);
						this.display();
					});
				};*/
			}
		}

		// (Add-category button removed — categories are auto‑managed by VanBlog)

		containerEl.createEl('hr');
	}

	// ──── Published documents ─────────────────────────

	private renderPublishedDocsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: t('settings.publishedDocs') });

		// Container for the results table
		const resultContainer = containerEl.createEl('div');

		new Setting(containerEl)
			.addButton((btn) => {
				btn.setButtonText(t('settings.viewPublishedBtn'))
					.setCta()
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText(t('settings.scanning'));
						resultContainer.empty();
						await this.renderPublishedDocsList(resultContainer);
						btn.setDisabled(false);
						btn.setButtonText(t('settings.viewPublishedBtn'));
					});
				return btn;
			});

		containerEl.createEl('hr');
	}

	private async renderPublishedDocsList(container: HTMLElement): Promise<void> {
		const results = await this.plugin.scanPublishedDocs();

		if (results.length === 0) {
			container.createEl('p', {
				text: t('settings.noPublishedDocs'),
				attr: { style: 'color: var(--text-muted); padding: 1rem 0;' },
			});
			return;
		}

		// Build table
		const table = container.createEl('table', {
			attr: {
				style: 'width: 100%; border-collapse: collapse; margin-top: 0.5rem;',
			},
		});

		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', {
			text: t('settings.docName'),
			attr: { style: 'text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--background-modifier-border);' },
		});
		headerRow.createEl('th', {
			text: t('settings.vanblogExists'),
			attr: { style: 'text-align: center; padding: 0.5rem; border-bottom: 2px solid var(--background-modifier-border);' },
		});
		headerRow.createEl('th', {
			text: t('settings.actions'),
			attr: { style: 'text-align: center; padding: 0.5rem; border-bottom: 2px solid var(--background-modifier-border);' },
		});

		// Body
		const tbody = table.createEl('tbody');
		for (const item of results) {
			const row = tbody.createEl('tr');

			// Document name
			row.createEl('td', {
				text: item.file.basename,
				attr: { style: 'padding: 0.5rem; border-bottom: 1px solid var(--background-modifier-border);' },
			});

			// Exists on VanBlog?
			row.createEl('td', {
				text: item.existsOnVanBlog ? t('settings.yes') : t('settings.no'),
				attr: {
					style: `text-align: center; padding: 0.5rem; border-bottom: 1px solid var(--background-modifier-border); color: ${item.existsOnVanBlog ? 'var(--text-success)' : 'var(--text-error)'};`,
				},
			});

			// Actions
			const actionsCell = row.createEl('td', {
				attr: {
					style: 'text-align: center; padding: 0.5rem; border-bottom: 1px solid var(--background-modifier-border);',
				},
			});
			const btnGroup = actionsCell.createEl('div', {
				attr: { style: 'display: flex; justify-content: center; gap: 0.5rem;' },
			});

			// Details button
			btnGroup.createEl('button', {
				text: t('settings.detail'),
				attr: { style: 'font-size: 0.8rem; padding: 0.2rem 0.6rem;' },
			}).onclick = () => {
				this.app.workspace.openLinkText(item.file.path, '', true);
			};

			// Clear properties button (only when not exists on VanBlog)
			if (!item.existsOnVanBlog) {
				btnGroup.createEl('button', {
					text: t('settings.clearProps'),
					attr: { style: 'font-size: 0.8rem; padding: 0.2rem 0.6rem; color: var(--text-error);' },
				}).onclick = async () => {
					const modal = new ConfirmModal(this.app, t('settings.clearPropsConfirm'));
					modal.open();
					const confirmed = await modal.waitForResult();
					if (confirmed) {
						await this.plugin.clearVanBlogProps(item.file);
						row.remove();
						new Notice(t('settings.cleared'));
					}
				};
			}
		}
	}

	// ──── Dialog helpers ───────────────────────────────

	private async promptCreate(
		_type: string,
		onConfirm: (name: string) => Promise<void>,
	): Promise<void> {
		const modal = new InputModal(this.app, t('settings.renamePrompt'), '');
		modal.open();
		const val = await modal.waitForResult();
		if (!val?.trim()) return;
		await onConfirm(val.trim());
	}

	private async promptRename(
		_type: string,
		oldName: string,
		onConfirm: (newName: string) => Promise<void>,
	): Promise<void> {
		const modal = new InputModal(this.app, t('settings.renamePrompt'), '', oldName);
		modal.open();
		const val = await modal.waitForResult();
		if (!val?.trim() || val.trim() === oldName) return;
		await onConfirm(val.trim());
	}

	private async confirmDelete(
		label: string,
		name: string,
		onConfirm: () => Promise<void>,
	): Promise<void> {
		const msg = `${t('settings.deleteConfirm')} ${label} "${name}"？${t('settings.undoWarning')}`;
		const modal = new ConfirmModal(this.app, msg);
		modal.open();
		const confirmed = await modal.waitForResult();
		if (confirmed) {
			await onConfirm();
		}
	}
}
