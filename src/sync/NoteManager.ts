import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { Person, Gender, PersonFrontmatter, Relationship, StoredRelationship, getFullName } from '../models/types';
import { generatePersonId } from '../parser/syntax';

export class NoteManager {
	constructor(
		private app: App,
		private peopleFolder: string
	) {}

	setPeopleFolder(folder: string): void {
		this.peopleFolder = folder;
	}

	async createPersonNote(
		firstName: string,
		surname: string,
		gender: Gender
	): Promise<Person> {
		const fullName = `${firstName} ${surname}`.trim();
		const id = generatePersonId(fullName);
		const notePath = await this.generateNotePath(fullName);

		// Create frontmatter
		const frontmatter: PersonFrontmatter = {
			'family-tree-person': true,
			firstName: firstName.trim(),
			surname: surname.trim(),
			gender
		};

		const content = this.createNoteContent(frontmatter);

		// Ensure folder exists
		await this.ensureFolderExists(this.peopleFolder);

		// Create the note
		await this.app.vault.create(notePath, content);

		return {
			id,
			firstName: firstName.trim(),
			surname: surname.trim(),
			gender,
			notePath
		};
	}

	async updatePersonNote(person: Person): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(person.notePath);
		if (!(file instanceof TFile)) {
			console.warn(`Note not found for person: ${person.notePath}`);
			return;
		}

		const content = await this.app.vault.read(file);
		const updatedContent = this.updateFrontmatter(content, {
			'family-tree-person': true,
			firstName: person.firstName,
			surname: person.surname,
			gender: person.gender
		});

		await this.app.vault.modify(file, updatedContent);
	}

	parsePersonFromNote(file: TFile, frontmatter: Record<string, unknown>): Person | null {
		// Check if this is a family tree person note
		if (!frontmatter['family-tree-person']) {
			return null;
		}

		const firstName = String(frontmatter.firstName || '');
		const surname = String(frontmatter.surname || '');
		const gender = (frontmatter.gender as Gender) || 'unknown';

		if (!firstName && !surname) {
			return null;
		}

		const fullName = `${firstName} ${surname}`.trim();
		const id = generatePersonId(fullName);

		return {
			id,
			firstName,
			surname,
			gender,
			notePath: file.path
		};
	}

	private async generateNotePath(fullName: string): Promise<string> {
		const baseName = fullName.replace(/[\\/:*?"<>|]/g, '').trim();
		let notePath = normalizePath(`${this.peopleFolder}/${baseName}.md`);

		// Handle duplicates by adding a number suffix
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(notePath)) {
			notePath = normalizePath(`${this.peopleFolder}/${baseName} ${counter}.md`);
			counter++;
		}

		return notePath;
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) return;

		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		}
	}

	private createNoteContent(frontmatter: PersonFrontmatter): string {
		const yaml = [
			'---',
			`family-tree-person: true`,
			`firstName: "${frontmatter.firstName}"`,
			`surname: "${frontmatter.surname}"`,
			`gender: ${frontmatter.gender}`,
			'---',
			'',
			`# ${frontmatter.firstName} ${frontmatter.surname}`.trim(),
			''
		].join('\n');

		return yaml;
	}

	private updateFrontmatter(content: string, frontmatter: PersonFrontmatter): string {
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		const newFrontmatter = [
			'---',
			`family-tree-person: true`,
			`firstName: "${frontmatter.firstName}"`,
			`surname: "${frontmatter.surname}"`,
			`gender: ${frontmatter.gender}`,
			'---'
		].join('\n');

		if (match) {
			return content.replace(frontmatterRegex, newFrontmatter);
		} else {
			return newFrontmatter + '\n\n' + content;
		}
	}

	/**
	 * Save a relationship to both persons' notes
	 */
	async saveRelationship(relationship: Relationship, person1: Person, person2: Person): Promise<void> {
		// Determine relationship types for each person
		const { type } = relationship;

		// Add relationship to person1's note
		const rel1: StoredRelationship = {
			type: this.getStoredRelationType(type, true),
			person: `[[${this.getNoteBasename(person2.notePath)}]]`
		};
		await this.addRelationshipToNote(person1.notePath, rel1);

		// Add reciprocal relationship to person2's note
		const rel2: StoredRelationship = {
			type: this.getStoredRelationType(type, false),
			person: `[[${this.getNoteBasename(person1.notePath)}]]`
		};
		await this.addRelationshipToNote(person2.notePath, rel2);
	}

	private getStoredRelationType(type: string, isPerson1: boolean): StoredRelationship['type'] {
		switch (type) {
			case 'spouse':
				return 'spouse';
			case 'parent':
				// person1 is parent, person2 is child
				return isPerson1 ? 'parent-of' : 'child-of';
			case 'sibling':
				return 'sibling';
			default:
				return 'spouse';
		}
	}

	private getNoteBasename(notePath: string): string {
		// Remove .md extension and folder path
		return notePath.replace(/\.md$/, '').split('/').pop() || notePath;
	}

	private async addRelationshipToNote(notePath: string, rel: StoredRelationship): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) {
			console.warn(`Note not found: ${notePath}`);
			return;
		}

		const content = await this.app.vault.read(file);
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			console.warn(`No frontmatter found in: ${notePath}`);
			return;
		}

		// Parse existing relationships from frontmatter
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter || {};
		const existingRels: StoredRelationship[] = frontmatter.relationships || [];

		// Check if relationship already exists
		const exists = existingRels.some(
			r => r.type === rel.type && r.person === rel.person
		);
		if (exists) return;

		// Add new relationship
		const newRels = [...existingRels, rel];

		// Rebuild frontmatter with relationships
		const updatedContent = this.updateFrontmatterWithRelationships(
			content,
			{
				'family-tree-person': true,
				firstName: frontmatter.firstName || '',
				surname: frontmatter.surname || '',
				gender: frontmatter.gender || 'unknown',
				relationships: newRels
			}
		);

		await this.app.vault.modify(file, updatedContent);
	}

	private updateFrontmatterWithRelationships(content: string, frontmatter: PersonFrontmatter): string {
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;

		const relsYaml = frontmatter.relationships && frontmatter.relationships.length > 0
			? `relationships:\n${frontmatter.relationships.map(r =>
				`  - type: ${r.type}\n    person: "${r.person}"`
			).join('\n')}`
			: '';

		const newFrontmatter = [
			'---',
			`family-tree-person: true`,
			`firstName: "${frontmatter.firstName}"`,
			`surname: "${frontmatter.surname}"`,
			`gender: ${frontmatter.gender}`,
			relsYaml,
			'---'
		].filter(line => line !== '').join('\n');

		const match = content.match(frontmatterRegex);
		if (match) {
			return content.replace(frontmatterRegex, newFrontmatter);
		} else {
			return newFrontmatter + '\n\n' + content;
		}
	}
}
