import { App, Modal, Setting } from 'obsidian';
import { FamilyTreeStore } from '../models/FamilyTreeStore';
import { Person, Gender } from '../models/types';
import { NoteManager } from '../sync/NoteManager';

export class PersonModal extends Modal {
	private person: Person | null;
	private store: FamilyTreeStore;
	private noteManager: NoteManager;
	private firstName: string = '';
	private surname: string = '';
	private gender: Gender = 'unknown';
	private isEdit: boolean;

	constructor(app: App, store: FamilyTreeStore, noteManager: NoteManager, person: Person | null) {
		super(app);
		this.store = store;
		this.noteManager = noteManager;
		this.person = person;
		this.isEdit = person !== null;

		if (person) {
			this.firstName = person.firstName;
			this.surname = person.surname;
			this.gender = person.gender;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', {
			text: this.isEdit ? 'Edit Person' : 'Add Person'
		});

		new Setting(contentEl)
			.setName('First Name')
			.addText(text => text
				.setPlaceholder('John')
				.setValue(this.firstName)
				.onChange(value => {
					this.firstName = value;
				}));

		new Setting(contentEl)
			.setName('Surname')
			.addText(text => text
				.setPlaceholder('Doe')
				.setValue(this.surname)
				.onChange(value => {
					this.surname = value;
				}));

		new Setting(contentEl)
			.setName('Gender')
			.addDropdown(dropdown => dropdown
				.addOption('unknown', 'Unknown')
				.addOption('male', 'Male')
				.addOption('female', 'Female')
				.addOption('other', 'Other')
				.setValue(this.gender)
				.onChange(value => {
					this.gender = value as Gender;
				}));

		if (this.isEdit && this.person) {
			new Setting(contentEl)
				.setName('Linked Note')
				.setDesc(this.person.notePath)
				.addButton(btn => btn
					.setButtonText('Open Note')
					.onClick(() => {
						this.app.workspace.openLinkText(this.person!.notePath, '');
						this.close();
					}));
		}

		const buttonContainer = contentEl.createDiv('modal-button-container');

		const saveBtn = buttonContainer.createEl('button', {
			text: this.isEdit ? 'Save' : 'Add',
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => this.save());

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => this.close());
	}

	private async save(): Promise<void> {
		if (!this.firstName.trim() && !this.surname.trim()) {
			return;
		}

		if (this.isEdit && this.person) {
			// Update existing person and their note
			const updatedPerson: Person = {
				...this.person,
				firstName: this.firstName.trim(),
				surname: this.surname.trim(),
				gender: this.gender
			};

			await this.noteManager.updatePersonNote(updatedPerson);
			this.store.updatePerson(updatedPerson);
		} else {
			// Create new person with a new note
			const newPerson = await this.noteManager.createPersonNote(
				this.firstName.trim(),
				this.surname.trim(),
				this.gender
			);

			this.store.addPerson(newPerson);
		}

		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
