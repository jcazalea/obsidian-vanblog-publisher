/**
 * Input modal – a minimal dialog with a text field and OK / Cancel buttons.
 * Used instead of the browser's `prompt()` which may be blocked in Obsidian.
 */

import { App, Modal, Setting } from 'obsidian';

export class InputModal extends Modal {
	private result: string | null = null;
	private resolvePromise!: (value: string | null) => void;
	private promise: Promise<string | null>;

	constructor(
		app: App,
		private titleText: string,
		private placeholder: string,
		private defaultValue: string = '',
	) {
		super(app);
		this.titleEl.setText(titleText);
		this.promise = new Promise((res) => (this.resolvePromise = res));
		this.build();
	}

	async waitForResult(): Promise<string | null> {
		return this.promise;
	}

	private build(): void {
		const { contentEl } = this;

		const setting = new Setting(contentEl);
		let inputValue = this.defaultValue;

		setting.addText((text) =>
			text
				.setPlaceholder(this.placeholder)
				.setValue(this.defaultValue)
				.onChange((v) => (inputValue = v)),
		);

		// Ensure the input gets focus
		setting.controlEl.querySelector('input')?.focus();
		setting.controlEl.querySelector('input')?.select();

		const btnContainer = contentEl.createDiv({
			attr: {
				style: 'display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;',
			},
		});

		btnContainer.createEl('button', { text: 'Cancel' }).onclick = () => {
			this.result = null;
			this.close();
		};

		const okBtn = btnContainer.createEl('button', {
			text: 'OK',
			attr: {
				style:
					'background: var(--interactive-accent); color: var(--text-on-accent);',
			},
		});
		okBtn.onclick = () => {
			this.result = inputValue;
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolvePromise(this.result);
	}
}

/**
 * Confirm modal – a simple yes/no dialog.
 * Used instead of the browser's `confirm()` which may be blocked in Obsidian.
 */
export class ConfirmModal extends Modal {
	private confirmed = false;
	private resolvePromise!: (value: boolean) => void;
	private promise: Promise<boolean>;

	constructor(app: App, private message: string) {
		super(app);
		this.titleEl.setText('Confirm');
		this.promise = new Promise((res) => (this.resolvePromise = res));
		this.build();
	}

	async waitForResult(): Promise<boolean> {
		return this.promise;
	}

	private build(): void {
		const { contentEl } = this;

		contentEl.createEl('p', { text: this.message });

		const btnContainer = contentEl.createDiv({
			attr: {
				style: 'display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;',
			},
		});

		btnContainer.createEl('button', { text: 'Cancel' }).onclick = () => {
			this.confirmed = false;
			this.close();
		};

		btnContainer.createEl('button', {
			text: 'Delete',
			attr: {
				style:
					'background: var(--background-modifier-error); color: var(--text-on-accent);',
			},
		}).onclick = () => {
			this.confirmed = true;
			this.close();
		};
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolvePromise(this.confirmed);
	}
}
