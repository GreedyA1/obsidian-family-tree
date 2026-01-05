import { App, Modal, Setting } from 'obsidian';
import { FamilyTreeStore } from '../models/FamilyTreeStore';
import { Person, Gender, Relationship, RelationshipType, getFullName } from '../models/types';
import { generateRelationshipId } from '../parser/syntax';
import { NoteManager } from '../sync/NoteManager';

export type RelativeType = 'parent' | 'child' | 'spouse' | 'sibling';

export class AddRelativeModal extends Modal {
	private store: FamilyTreeStore;
	private noteManager: NoteManager;
	private basePerson: Person;
	private relativeType: RelativeType;
	private firstName: string = '';
	private surname: string = '';
	private gender: Gender = 'unknown';

	constructor(
		app: App,
		store: FamilyTreeStore,
		noteManager: NoteManager,
		basePerson: Person,
		relativeType: RelativeType
	) {
		super(app);
		this.store = store;
		this.noteManager = noteManager;
		this.basePerson = basePerson;
		this.relativeType = relativeType;

		// Pre-fill surname for family members (except spouse)
		if (relativeType !== 'spouse' && basePerson.surname) {
			this.surname = basePerson.surname;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		const basePersonName = getFullName(this.basePerson);
		const titles: Record<RelativeType, string> = {
			parent: `Add Parent of ${basePersonName}`,
			child: `Add Child of ${basePersonName}`,
			spouse: `Add Spouse of ${basePersonName}`,
			sibling: `Add Sibling of ${basePersonName}`
		};

		contentEl.createEl('h2', { text: titles[this.relativeType] });

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

		const buttonContainer = contentEl.createDiv('modal-button-container');

		const saveBtn = buttonContainer.createEl('button', {
			text: `Add ${this.capitalizeFirst(this.relativeType)}`,
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => this.save());

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => this.close());
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	private async save(): Promise<void> {
		if (!this.firstName.trim() && !this.surname.trim()) {
			return;
		}

		// Create the new person with a note
		const newPerson = await this.noteManager.createPersonNote(
			this.firstName.trim(),
			this.surname.trim(),
			this.gender
		);

		this.store.addPerson(newPerson);

		// Create the relationship based on type
		let relationship: Relationship;

		switch (this.relativeType) {
			case 'parent':
				// New person is parent OF base person
				relationship = {
					id: generateRelationshipId('parent', newPerson.id, this.basePerson.id),
					type: 'parent' as RelationshipType,
					person1Id: newPerson.id, // parent
					person2Id: this.basePerson.id, // child
					sourceFile: 'manual',
					sourceLine: 0
				};
				break;

			case 'child':
				// Base person is parent OF new person
				relationship = {
					id: generateRelationshipId('parent', this.basePerson.id, newPerson.id),
					type: 'parent' as RelationshipType,
					person1Id: this.basePerson.id, // parent
					person2Id: newPerson.id, // child
					sourceFile: 'manual',
					sourceLine: 0
				};
				break;

			case 'spouse':
				relationship = {
					id: generateRelationshipId('spouse', this.basePerson.id, newPerson.id),
					type: 'spouse' as RelationshipType,
					person1Id: this.basePerson.id,
					person2Id: newPerson.id,
					sourceFile: 'manual',
					sourceLine: 0
				};
				break;

			case 'sibling':
				relationship = {
					id: generateRelationshipId('sibling', this.basePerson.id, newPerson.id),
					type: 'sibling' as RelationshipType,
					person1Id: this.basePerson.id,
					person2Id: newPerson.id,
					sourceFile: 'manual',
					sourceLine: 0
				};
				break;
		}

		// Save relationship to both persons' notes and add to store
		await this.noteManager.saveRelationship(relationship, this.basePerson, newPerson);
		this.store.addRelationship(relationship);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
