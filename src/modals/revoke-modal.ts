/**
 * Revoke article confirmation modal.
 */

import { App, Modal } from 'obsidian';
import { t } from '../i18n';

export class RevokeModal extends Modal {
	private confirmed = false;
	private resolvePromise!: (value: boolean) => void;
	private promise: Promise<boolean>;

	constructor(app: App, fileName: string, articleTitle: string) {
		super(app);

		this.promise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});

		this.titleEl.setText(t('revoke.title'));
		this.build(fileName, articleTitle);
	}

	async waitForResult(): Promise<boolean> {
		return this.promise;
	}

	private build(fileName: string, articleTitle: string): void {
		const { contentEl } = this;

		contentEl.createEl('p', {
			text: t('revoke.confirm') + articleTitle + t('revoke.confirmEnd'),
		});
		contentEl.createEl('p', {
			text: t('revoke.fileLabel') + fileName,
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

		btnContainer.createEl('button', { text: t('revoke.cancel') }).onclick = () => {
			this.confirmed = false;
			this.close();
		};

		const revokeBtn = btnContainer.createEl('button', {
			text: t('revoke.revoke'),
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
