/**
 * Publish article modal – shows a preview of what will be published and
 * lets the user adjust category (dropdown) & tags (multi‑select with
 * suggestions from the VanBlog API) before confirming.
 */

import { App, Modal, Setting } from 'obsidian';
import type { ArticlePayload } from '../api/types';
import { t } from '../i18n';

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
		// Auto‑generate a random slug if none was provided
		if (!this.payload.pathname) {
			this.payload.pathname = generateSlug();
		}
		this.availableTags = availableTags;
		this.availableCategories = availableCategories;

		this.result = {
			confirmed: false,
			payload: this.payload,
		};

		this.promise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});

		this.titleEl.setText(t('publish.title') + ': ' + fileName);
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
			.setName(t('publish.titleField'))
			.addText((text) =>
				text
					.setPlaceholder(t('publish.titlePlaceholder'))
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
			.setName(t('publish.category'))
			.addDropdown((dropdown) => {
				dropdown.addOption('', t('settings.none'));
				for (const c of [...catOptions].sort()) {
					if (c) dropdown.addOption(c, c);
				}
				dropdown.setValue(currentCat);
				dropdown.onChange((value) => {
					this.payload.category = value || undefined;
				});
			});

			// ---- Tags section --------------------------------------------------
			const tagsContainer = contentEl.createDiv({
				attr: { style: 'margin-bottom: 0.75rem;' },
			});
			tagsContainer.createEl('h3', {
				text: t('publish.tags'),
				attr: { style: 'margin: 0 0 0.25rem 0; font-size: 0.9em;' },
			});

			// Row: text input + Add button
			const inputRow = tagsContainer.createDiv({
				attr: { style: 'display: flex; gap: 0.25rem; margin-bottom: 0.25rem;' },
			});
			const tagInput = inputRow.createEl('input', {
				type: 'text',
				attr: { placeholder: t('publish.tagsPlaceholder'), style: 'flex: 1;' },
			});
			const addBtn = inputRow.createEl('button', {
				text: t('publish.addBtn'),
				attr: { style: 'padding: 0 0.6rem;' },
			});

			// Row: dropdown + Add from suggestions
			const dropdownRow = tagsContainer.createDiv({
				attr: { style: 'display: flex; gap: 0.25rem; margin-bottom: 0.5rem;' },
			});
			const tagSelect = dropdownRow.createEl('select', {
				attr: { style: 'flex: 1;' },
			});
			tagSelect.createEl('option', { value: '', text: t('publish.addTag') });
			for (const tag of this.availableTags) {
				if (tag) tagSelect.createEl('option', { value: tag, text: tag });
			}
			const suggestBtn = dropdownRow.createEl('button', {
				text: t('publish.addBtn'),
				attr: { style: 'padding: 0 0.6rem;' },
			});

			// Tag list display
			const tagListEl = tagsContainer.createEl('div', {
				attr: { style: 'display: flex; flex-wrap: wrap; gap: 0.3rem; min-height: 1.8rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 0.3rem;' },
			});

			const renderTags = () => {
				tagListEl.empty();
				const tags = this.payload.tags ?? [];
				if (tags.length === 0) {
					tagListEl.createEl('span', {
						text: t('publish.noTags'),
						attr: { style: 'color: var(--text-muted); font-size: 0.85em; padding: 0.15rem 0.3rem;' },
					});
					return;
				}
				for (let i = 0; i < tags.length; i++) {
					const tag = tags[i];
					const chip = tagListEl.createEl('span', {
						attr: { style: 'display: inline-flex; align-items: center; gap: 0.2rem; background: var(--background-modifier-hover); border-radius: 3px; padding: 0.1rem 0.3rem; font-size: 0.85em;' },
					});
					chip.createEl('span', { text: tag });
					const removeBtn = chip.createEl('span', {
						text: '×',
						attr: { style: 'cursor: pointer; font-weight: bold; color: var(--text-error); padding: 0 0.1rem; font-size: 1.1em; line-height: 1;', title: t('publish.removeTag') },
					});
					const idx = i;
					removeBtn.onclick = () => {
						const updated = [...(this.payload.tags ?? [])];
						updated.splice(idx, 1);
						this.payload.tags = updated;
						renderTags();
					};
				}
			};

			renderTags();

			// Add from text input
			addBtn.onclick = () => {
				const val = tagInput.value.trim();
				if (!val) return;
				const current = (this.payload.tags ?? []).map((t) => t.toLowerCase());
				if (!current.includes(val.toLowerCase())) {
					this.payload.tags = [...(this.payload.tags ?? []), val];
					renderTags();
				}
				tagInput.value = '';
			};
			tagInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') addBtn.click();
			});

			// Add from dropdown
			suggestBtn.onclick = () => {
				const val = tagSelect.value;
				if (!val) return;
				const current = (this.payload.tags ?? []).map((t) => t.toLowerCase());
				if (!current.includes(val.toLowerCase())) {
					this.payload.tags = [...(this.payload.tags ?? []), val];
					renderTags();
				}
				tagSelect.value = '';
			};


		// ── Slug ──
		new Setting(contentEl)
			.setName(t('publish.slug'))
			.setDesc(t('publish.slugDesc'))
			.addText((text) =>
				text
					.setPlaceholder(t('publish.slugPlaceholder'))
					.setValue(this.payload.pathname ?? '')
					.onChange((value) => {
						this.payload.pathname = value || undefined;
					}),
			);

		// ── Pin / Top ──
		new Setting(contentEl)
			.setName(t('publish.top'))
			.setDesc(t('publish.topDesc'))
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
			.setName(t('publish.password'))
			.setDesc(t('publish.passwordDesc'))
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
			.setName(t('publish.hide'))
			.addToggle((toggle) =>
				toggle.setValue(this.payload.hidden ?? false).onChange((value) => {
					this.payload.hidden = value;
				}),
			);

		// ── Buttons ──
		const btnContainer = contentEl.createDiv({
			attr: {
				style:
					'display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;',
			},
		});

		btnContainer.createEl('button', { text: t('publish.cancel') }).onclick = () => {
			this.result.confirmed = false;
			this.close();
		};

		const publishBtn = btnContainer.createEl('button', {
			text: t('publish.publish'),
			attr: {
				style:
					'background: var(--interactive-accent); color: var(--text-on-accent);',
			},
		});
		publishBtn.onclick = () => {
			// Validate title
			if (!this.payload.title?.trim()) {
				this.payload.title = t('publish.untitled');
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

/**
 * Generate a practically unique slug for VanBlog URLs.
 *
 * Format:  `{timestamp}-{random}`
 *   - timestamp : 9‑char base‑36 milliseconds → unique across time
 *   - random    : 8‑char hex (32 bits) → unique within the same ms
 *
 * Combined space: > 2⁵⁶, collision probability is negligible for personal use.
 */
function generateSlug(): string {
	const ts = Date.now().toString(36); // base‑36 timestamp
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	let rand = '';
	for (const b of bytes) {
		rand += b.toString(16).padStart(2, '0');
	}
	return `${ts}-${rand}`;
}
