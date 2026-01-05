import { Events } from 'obsidian';
import { Person, Relationship, FamilyGraph, GraphNode, GraphEdge, getFullName } from './types';

export class FamilyTreeStore extends Events {
	private persons: Map<string, Person> = new Map();
	private relationships: Relationship[] = [];

	loadData(persons: Person[], relationships: Relationship[]): void {
		this.persons.clear();
		this.relationships = [];

		for (const person of persons) {
			this.persons.set(person.id, person);
		}
		this.relationships = relationships;

		this.trigger('update');
	}

	loadRelationships(relationships: Relationship[]): void {
		this.relationships = relationships;
		this.trigger('update');
	}

	getPersons(): Person[] {
		return Array.from(this.persons.values());
	}

	getPerson(id: string): Person | undefined {
		return this.persons.get(id);
	}

	getRelationships(): Relationship[] {
		return this.relationships;
	}

	addPerson(person: Person): void {
		this.persons.set(person.id, person);
		this.trigger('update');
	}

	updatePerson(person: Person): void {
		this.persons.set(person.id, person);
		this.trigger('update');
	}

	getPersonByNotePath(notePath: string): Person | undefined {
		for (const person of this.persons.values()) {
			if (person.notePath === notePath) {
				return person;
			}
		}
		return undefined;
	}

	removePersonByNotePath(notePath: string): void {
		for (const [id, person] of this.persons) {
			if (person.notePath === notePath) {
				this.persons.delete(id);
				// Also remove relationships involving this person
				this.relationships = this.relationships.filter(
					r => r.person1Id !== id && r.person2Id !== id
				);
				break;
			}
		}
		this.trigger('update');
	}

	updatePersonNotePath(oldPath: string, newPath: string): void {
		for (const person of this.persons.values()) {
			if (person.notePath === oldPath) {
				person.notePath = newPath;
				break;
			}
		}
		this.trigger('update');
	}

	removePerson(id: string): void {
		this.persons.delete(id);
		this.relationships = this.relationships.filter(
			r => r.person1Id !== id && r.person2Id !== id
		);
		this.trigger('update');
	}

	addRelationship(relationship: Relationship): void {
		this.relationships.push(relationship);
		this.trigger('update');
	}

	removeRelationship(id: string): void {
		this.relationships = this.relationships.filter(r => r.id !== id);
		this.trigger('update');
	}

	removeRelationshipsBySource(filePath: string): void {
		this.relationships = this.relationships.filter(
			r => r.sourceFile !== filePath
		);
		this.trigger('update');
	}

	updateRelationshipSourcePath(oldPath: string, newPath: string): void {
		for (const rel of this.relationships) {
			if (rel.sourceFile === oldPath) {
				rel.sourceFile = newPath;
			}
		}
		this.trigger('update');
	}

	updateRelationshipsFromFile(filePath: string, relationships: Relationship[]): void {
		// Remove old relationships from this file
		this.relationships = this.relationships.filter(
			r => r.sourceFile !== filePath
		);
		// Add new relationships
		this.relationships.push(...relationships);
		this.trigger('update');
	}



	getGraph(): FamilyGraph {
		const nodes: GraphNode[] = [];
		const edges: GraphEdge[] = [];

		for (const person of this.persons.values()) {
			nodes.push({
				id: person.id,
				label: getFullName(person),
				person: person
			});
		}

		for (const rel of this.relationships) {
			if (this.persons.has(rel.person1Id) && this.persons.has(rel.person2Id)) {
				edges.push({
					id: rel.id,
					source: rel.person1Id,
					target: rel.person2Id,
					relationship: rel,
					style: rel.type === 'spouse' ? 'dashed' : 'solid'
				});
			}
		}

		return { nodes, edges };
	}

	clear(): void {
		this.persons.clear();
		this.relationships = [];
		this.trigger('update');
	}
}
