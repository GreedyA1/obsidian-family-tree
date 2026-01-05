import { App, Modal, Setting } from 'obsidian';
import { FamilyTreeStore } from '../models/FamilyTreeStore';
import { Person, Relationship, RelationshipType, getFullName } from '../models/types';
import { generateRelationshipId } from '../parser/syntax';
import { NoteManager } from '../sync/NoteManager';

export class RelationshipModal extends Modal {
	private store: FamilyTreeStore;
	private noteManager: NoteManager;
	private person1: Person | null;
	private person2: Person | null;
	private person1Id: string = '';
	private person2Id: string = '';
	private relationType: RelationshipType = 'parent';

	constructor(
		app: App,
		store: FamilyTreeStore,
		noteManager: NoteManager,
		person1: Person | null,
		person2: Person | null
	) {
		super(app);
		this.store = store;
		this.noteManager = noteManager;
		this.person1 = person1;
		this.person2 = person2;

		if (person1) {
			this.person1Id = person1.id;
		}
		if (person2) {
			this.person2Id = person2.id;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add Relationship' });

		const persons = this.store.getPersons();

		if (persons.length < 2) {
			contentEl.createEl('p', {
				text: 'You need at least 2 people to create a relationship.',
				cls: 'family-tree-warning'
			});
			return;
		}

		new Setting(contentEl)
			.setName('Person 1')
			.setDesc(this.relationType === 'parent' ? 'Parent' : 'First person')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'Select a person...');
				for (const person of persons) {
					dropdown.addOption(person.id, getFullName(person));
				}
				dropdown.setValue(this.person1Id);
				dropdown.onChange(value => {
					this.person1Id = value;
				});
			});

		new Setting(contentEl)
			.setName('Relationship Type')
			.addDropdown(dropdown => dropdown
				.addOption('parent', 'Parent of')
				.addOption('spouse', 'Spouse of')
				.addOption('sibling', 'Sibling of')
				.setValue(this.relationType)
				.onChange(value => {
					this.relationType = value as RelationshipType;
				}));

		new Setting(contentEl)
			.setName('Person 2')
			.setDesc(this.relationType === 'parent' ? 'Child' : 'Second person')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'Select a person...');
				for (const person of persons) {
					dropdown.addOption(person.id, getFullName(person));
				}
				dropdown.setValue(this.person2Id);
				dropdown.onChange(value => {
					this.person2Id = value;
				});
			});

		const buttonContainer = contentEl.createDiv('modal-button-container');

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Add Relationship',
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => this.save());

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});
		cancelBtn.addEventListener('click', () => this.close());
	}

	private async save(): Promise<void> {
		if (!this.person1Id || !this.person2Id) {
			return;
		}

		if (this.person1Id === this.person2Id) {
			return;
		}

		const person1 = this.store.getPerson(this.person1Id);
		const person2 = this.store.getPerson(this.person2Id);

		if (!person1 || !person2) {
			return;
		}

		const relationship: Relationship = {
			id: generateRelationshipId(this.relationType, this.person1Id, this.person2Id),
			type: this.relationType,
			person1Id: this.person1Id,
			person2Id: this.person2Id,
			sourceFile: person1.notePath,
			sourceLine: 0
		};

		// Save to both persons' notes and add to store
		await this.noteManager.saveRelationship(relationship, person1, person2);
		this.store.addRelationship(relationship);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
