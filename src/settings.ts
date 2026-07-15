/**
 * VanBlog Publisher – settings
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import VanBlogPlugin from './main';

export interface VanBlogSettings {
	/** VanBlog base URL (e.g. https://blog.example.com) */
	baseUrl: string;
	/** API token created in VanBlog admin → System → Token Management */
	apiToken: string;
	/** Default category assigned when the article has no `category` front‑matter */
	defaultCategory: string;
	/** Default tags applied on publish (comma‑separated) */
	defaultTags: string;
	/** Whether to automatically upload embedded files before publishing */
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

		containerEl.createEl('h2', { text: 'VanBlog Connection' });

		new Setting(containerEl)
			.setName('VanBlog base URL')
			.setDesc(
				'Your VanBlog instance URL (e.g. https://blog.yourdomain.com). '
					+ 'Must be accessible from this machine.',
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
			.setDesc(
				'Create a token in VanBlog admin → System Settings → Token Management.',
			)
			.addText((text) =>
				text
					.setPlaceholder('vanblog-token-xxx')
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl('h2', { text: 'Default publish options' });

		new Setting(containerEl)
			.setName('Default category')
			.setDesc(
				'Category assigned when the markdown file has no `category` front‑matter. '
					+ 'Leave empty to skip setting a category.',
			)
			.addText((text) =>
				text
					.setPlaceholder('Tech')
					.setValue(this.plugin.settings.defaultCategory)
					.onChange(async (value) => {
						this.plugin.settings.defaultCategory = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default tags')
			.setDesc(
				'Comma‑separated tags used when the file has no `tags` front‑matter.',
			)
			.addText((text) =>
				text
					.setPlaceholder('obsidian, blog')
					.setValue(this.plugin.settings.defaultTags)
					.onChange(async (value) => {
						this.plugin.settings.defaultTags = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Auto‑upload embedded media')
			.setDesc(
				'Upload images / attachments referenced in the markdown file to '
					+ 'VanBlog before publishing, and replace local paths with remote URLs.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoUploadMedia)
					.onChange(async (value) => {
						this.plugin.settings.autoUploadMedia = value;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl('hr');
		containerEl.createEl('p', {
			text: 'Need help? Check the Swagger docs at your VanBlog instance: '
				+ `${this.plugin.settings.baseUrl || '<base-url>'}/swagger`,
			attr: { style: 'color: var(--text-muted); font-size: 0.85em;' },
		});
	}
}
