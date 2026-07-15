/**
 * Publish article modal – shows a preview of what will be published and
 * lets the user adjust category (dropdown) & tags (multi‑select with
 * suggestions from the VanBlog API) before confirming.
 */

import { App, Modal, Setting } from 'obsidian';
import type { ArticlePayload } from '../api/types';

export interface PublishResult {
	confirmed: boolean;
	payload: ArticlePayload;
}

export class PublishModal extends Modal {
	private result: PublishResult;
	private payload: ArticlePayload;
	private resolvePromise!: (value: PublishResult) => void;
	private promise: Promise<PublishResult>;

	private availableTags: string[];
	private availableCategories: string[];

	constructor(
		app: App,
		fileName: string,
		initialPayload: ArticlePayload,
		availableTags: string[],
		availableCategories: string[],
	) {
		super(app);
		this.payload = { ...initialPayload };
		this.availableTags = availableTags;
		this.availableCategories = availableCategories;

		this.result = {
			confirmed: false,
			payload: this.payload,
		};

		this.promise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});

		this.titleEl.setText(`Publish to VanBlog: ${fileName}`);
		this.build();
	}

	/** Await the modal result from outside */
	async waitForResult(): Promise<PublishResult> {
		return this.promise;
	}

	private build(): void {
		const { contentEl } = this;

		// ── Title ──
		new Setting(contentEl)
			.setName('Title')
			.addText((text) =>
				text
					.setPlaceholder('Article title')
					.setValue(this.payload.title ?? '')
					.onChange((value) => {
						this.payload.title = value;
					}),
			);

		// ── Category (dropdown) ──
		const catOptions = new Set(this.availableCategories);
		const currentCat = this.payload.category ?? '';
		if (currentCat && !catOptions.has(currentCat)) {
			catOptions.add(currentCat);
		}

		new Setting(contentEl)
			.setName('Category')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '— None —');
				for (const c of [...catOptions].sort()) {
					if (c) dropdown.addOption(c, c);
				}
				dropdown.setValue(currentCat);
				dropdown.onChange((value) => {
					this.payload.category = value || undefined;
				});
			});

		// ── Tags (dropdown + text) ──
		// We keep a text input showing the tags and a dropdown to add suggestions.
		let tagInputRef: import('obsidian').TextComponent | null = null;
		const tagSetting = new Setting(contentEl)
			.setName('Tags')
			.setDesc('Comma‑separated. Use the dropdown to add suggested tags.');

		tagSetting.addText((text) => {
			tagInputRef = text;
			text
				.setPlaceholder('tag1, tag2')
				.setValue((this.payload.tags ?? []).join(', '))
				.onChange((value) => {
					this.payload.tags = value
						.split(',')
						.map((t) => t.trim())
						.filter(Boolean);
				});
		});

		// Dropdown for adding a tag from the suggestion list
		tagSetting.addDropdown((dropdown) => {
			dropdown.addOption('', '— Add tag —');
			for (const t of this.availableTags) {
				if (t) dropdown.addOption(t, t);
			}
			dropdown.onChange((value) => {
				if (!value) return;
				// Append to existing tags
				const current = new Set(
					(this.payload.tags ?? []).map((t) => t.toLowerCase()),
				);
				if (!current.has(value.toLowerCase())) {
					const updated = [...(this.payload.tags ?? []), value];
					this.payload.tags = updated;
					if (tagInputRef) tagInputRef.setValue(updated.join(', '));
				}
				dropdown.setValue(''); // Reset to placeholder
			});
		});

		// ── Slug ──
		new Setting(contentEl)
			.setName('Slug (optional)')
			.setDesc('URL‑friendly identifier. Leave empty for auto‑generation.')
			.addText((text) =>
				text
					.setPlaceholder('my-article-slug')
					.setValue(this.payload.slug ?? '')
					.onChange((value) => {
						this.payload.slug = value || undefined;
					}),
			);

		// ── Pin / Top ──
		new Setting(contentEl)
			.setName('Pin priority')
			.setDesc('0 = not pinned. Higher = higher display priority.')
			.addText((text) =>
				text
					.setPlaceholder('0')
					.setValue(String(this.payload.top ?? 0))
					.onChange((value) => {
						this.payload.top = Number(value) || 0;
					}),
			);

		// ── Password ──
		new Setting(contentEl)
			.setName('Password (optional)')
			.setDesc('Password‑protect this article.')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(this.payload.password ?? '')
					.onChange((value) => {
						this.payload.password = value || undefined;
					}),
			);

		// ── Hide ──
		new Setting(contentEl)
			.setName('Hide from front page')
			.addToggle((toggle) =>
				toggle.setValue(this.payload.hide ?? false).onChange((value) => {
					this.payload.hide = value;
				}),
			);

		// ── Buttons ──
		const btnContainer = contentEl.createDiv({
			attr: {
				style:
					'display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;',
			},
		});

		btnContainer.createEl('button', { text: 'Cancel' }).onclick = () => {
			this.result.confirmed = false;
			this.close();
		};

		const publishBtn = btnContainer.createEl('button', {
			text: 'Publish',
			attr: {
				style:
					'background: var(--interactive-accent); color: var(--text-on-accent);',
			},
		});
		publishBtn.onclick = () => {
			// Validate title
			if (!this.payload.title?.trim()) {
				this.payload.title = 'Untitled';
			}
			this.result.confirmed = true;
			this.result.payload = { ...this.payload };
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolvePromise(this.result);
	}
}
