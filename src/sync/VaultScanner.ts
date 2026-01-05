import { App, TFile, Events, EventRef } from 'obsidian';
import { FamilyTreeStore } from '../models/FamilyTreeStore';
import { NoteManager } from './NoteManager';
import { Person, Relationship, StoredRelationship } from '../models/types';
import { generatePersonId, generateRelationshipId } from '../parser/syntax';

export class VaultScanner extends Events {
	private noteManager: NoteManager;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private eventRefs: EventRef[] = [];

	constructor(
		private app: App,
		private store: FamilyTreeStore,
		peopleFolder: string
	) {
		super();
		this.noteManager = new NoteManager(app, peopleFolder);
	}

	getNoteManager(): NoteManager {
		return this.noteManager;
	}

	setPeopleFolder(folder: string): void {
		this.noteManager.setPeopleFolder(folder);
	}

	async initialScan(): Promise<void> {
		// First pass: scan all notes for person data
		const { persons, personsByNotePath } = await this.scanPersonNotes();

		// Second pass: parse relationships from frontmatter
		const relationships = await this.parseRelationshipsFromNotes(personsByNotePath);

		// Load data into store
		this.store.loadData(persons, relationships);
	}

	private async scanPersonNotes(): Promise<{
		persons: Person[];
		personsByNotePath: Map<string, Person>;
	}> {
		const persons: Person[] = [];
		const personsByNotePath = new Map<string, Person>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const person = this.parsePersonFromFile(file);
			if (person) {
				persons.push(person);
				personsByNotePath.set(file.path, person);
			}
		}

		return { persons, personsByNotePath };
	}

	private parsePersonFromFile(file: TFile): Person | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}

		return this.noteManager.parsePersonFromNote(file, cache.frontmatter);
	}

	private async parseRelationshipsFromNotes(
		personsByNotePath: Map<string, Person>
	): Promise<Relationship[]> {
		const relationships: Relationship[] = [];
		const seenIds = new Set<string>();

		for (const [notePath, person] of personsByNotePath) {
			const file = this.app.vault.getAbstractFileByPath(notePath);
			if (!(file instanceof TFile)) continue;

			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;
			if (!frontmatter?.relationships) continue;

			const storedRels = frontmatter.relationships as StoredRelationship[];

			for (const rel of storedRels) {
				// Parse the Obsidian link to get the target person
				const linkMatch = rel.person.match(/\[\[([^\]]+)\]\]/);
				if (!linkMatch || !linkMatch[1]) continue;

				const linkedNoteName = linkMatch[1];
				const targetPerson = this.findPersonByNoteName(linkedNoteName, personsByNotePath);
				if (!targetPerson) continue;

				// Convert stored relationship type to graph relationship
				const graphRel = this.convertToGraphRelationship(rel, person, targetPerson);
				if (!graphRel) continue;

				// Avoid duplicates (relationships are stored in both notes)
				if (seenIds.has(graphRel.id)) continue;
				seenIds.add(graphRel.id);

				relationships.push(graphRel);
			}
		}

		return relationships;
	}

	private findPersonByNoteName(
		noteName: string,
		personsByNotePath: Map<string, Person>
	): Person | null {
		for (const [path, person] of personsByNotePath) {
			const basename = path.replace(/\.md$/, '').split('/').pop();
			if (basename === noteName) {
				return person;
			}
		}
		return null;
	}

	private convertToGraphRelationship(
		rel: StoredRelationship,
		sourcePerson: Person,
		targetPerson: Person
	): Relationship | null {
		let type: 'spouse' | 'parent' | 'sibling';
		let person1Id: string;
		let person2Id: string;

		switch (rel.type) {
			case 'spouse':
				type = 'spouse';
				// Sort IDs to ensure consistent relationship ID
				if (sourcePerson.id < targetPerson.id) {
					person1Id = sourcePerson.id;
					person2Id = targetPerson.id;
				} else {
					person1Id = targetPerson.id;
					person2Id = sourcePerson.id;
				}
				break;
			case 'sibling':
				type = 'sibling';
				if (sourcePerson.id < targetPerson.id) {
					person1Id = sourcePerson.id;
					person2Id = targetPerson.id;
				} else {
					person1Id = targetPerson.id;
					person2Id = sourcePerson.id;
				}
				break;
			case 'parent-of':
				type = 'parent';
				person1Id = sourcePerson.id; // parent
				person2Id = targetPerson.id; // child
				break;
			case 'child-of':
				type = 'parent';
				person1Id = targetPerson.id; // parent
				person2Id = sourcePerson.id; // child
				break;
			default:
				return null;
		}

		return {
			id: generateRelationshipId(type, person1Id, person2Id),
			type,
			person1Id,
			person2Id,
			sourceFile: sourcePerson.notePath,
			sourceLine: 0
		};
	}

	registerWatchers(): void {
		// Watch for file modifications
		const modifyRef = this.app.vault.on('modify', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.debouncedRescan(file);
			}
		});
		this.eventRefs.push(modifyRef);

		// Watch for file deletion
		const deleteRef = this.app.vault.on('delete', (file) => {
			if (file instanceof TFile) {
				// Remove person linked to this note
				this.store.removePersonByNotePath(file.path);
				// Remove relationships from this file
				this.store.removeRelationshipsBySource(file.path);
			}
		});
		this.eventRefs.push(deleteRef);

		// Watch for file rename
		const renameRef = this.app.vault.on('rename', (file, oldPath) => {
			if (file instanceof TFile) {
				// Update person's notePath
				this.store.updatePersonNotePath(oldPath, file.path);
				// Update relationship sources
				this.store.updateRelationshipSourcePath(oldPath, file.path);
			}
		});
		this.eventRefs.push(renameRef);

		// Watch for file creation
		const createRef = this.app.vault.on('create', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.debouncedRescan(file);
			}
		});
		this.eventRefs.push(createRef);
	}

	unregisterWatchers(): void {
		for (const ref of this.eventRefs) {
			this.app.vault.offref(ref);
		}
		this.eventRefs = [];
	}

	private debouncedRescan(file: TFile): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(async () => {
			// Check for person data in frontmatter
			const person = this.parsePersonFromFile(file);
			if (person) {
				this.store.updatePerson(person);
			}

			// Re-scan all relationships since they're stored in person notes
			// and a change in one note affects relationships
			await this.rescanRelationships();
		}, 300);
	}

	private async rescanRelationships(): Promise<void> {
		const { personsByNotePath } = await this.scanPersonNotes();
		const relationships = await this.parseRelationshipsFromNotes(personsByNotePath);

		// Clear and reload relationships
		this.store.loadRelationships(relationships);
	}
}
