/**
 * Revoke article confirmation modal.
 */

import { App, Modal } from 'obsidian';

export class RevokeModal extends Modal {
	private confirmed = false;
	private resolvePromise!: (value: boolean) => void;
	private promise: Promise<boolean>;

	constructor(app: App, fileName: string, articleTitle: string) {
		super(app);

		this.promise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});

		this.titleEl.setText('Revoke from VanBlog');
		this.build(fileName, articleTitle);
	}

	async waitForResult(): Promise<boolean> {
		return this.promise;
	}

	private build(fileName: string, articleTitle: string): void {
		const { contentEl } = this;

		contentEl.createEl('p', {
			text: `Are you sure you want to revoke "${articleTitle}" from VanBlog?`,
		});
		contentEl.createEl('p', {
			text: `File: ${fileName}`,
			attr: {
				style:
					'color: var(--text-muted); font-size: 0.85em; margin-bottom: 1rem;',
			},
		});

		const btnContainer = contentEl.createDiv({
			attr: {
				style: 'display: flex; gap: 0.5rem; justify-content: flex-end;',
			},
		});

		btnContainer.createEl('button', { text: 'Cancel' }).onclick = () => {
			this.confirmed = false;
			this.close();
		};

		const revokeBtn = btnContainer.createEl('button', {
			text: 'Revoke',
			attr: {
				style:
					'background: var(--background-modifier-error); color: var(--text-on-accent);',
			},
		});
		revokeBtn.onclick = () => {
			this.confirmed = true;
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolvePromise(this.confirmed);
	}
}
