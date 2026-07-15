/**
 * Publish article modal – shows a preview of what will be published and
 * lets the user adjust tags / category before confirming.
 */

import { App, Modal, Setting } from 'obsidian';
import type { ArticlePayload } from './api/types';

export interface PublishResult {
	confirmed: boolean;
	payload: ArticlePayload;
}

export class PublishModal extends Modal {
	private result: PublishResult;
	private payload: ArticlePayload;
	private resolvePromise!: (value: PublishResult) => void;
	private promise: Promise<PublishResult>;

	constructor(
		app: App,
		fileName: string,
		initialPayload: ArticlePayload,
	) {
		super(app);
		this.payload = { ...initialPayload };

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

		// ── Category ──
		new Setting(contentEl)
			.setName('Category')
			.addText((text) =>
				text
					.setPlaceholder('Category')
					.setValue(this.payload.category ?? '')
					.onChange((value) => {
						this.payload.category = value || undefined;
					}),
			);

		// ── Tags ──
		new Setting(contentEl)
			.setName('Tags')
			.setDesc('Comma-separated')
			.addText((text) =>
				text
					.setPlaceholder('tag1, tag2')
					.setValue((this.payload.tags ?? []).join(', '))
					.onChange((value) => {
						this.payload.tags = value
							.split(',')
							.map((t) => t.trim())
							.filter(Boolean);
					}),
			);

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
