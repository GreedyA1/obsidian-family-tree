export type Gender = 'male' | 'female' | 'other' | 'unknown';

export type RelationshipType = 'spouse' | 'parent' | 'child' | 'sibling';

export interface Person {
	id: string;
	firstName: string;
	surname: string;
	gender: Gender;
	notePath: string; // Required - each person has a linked note
}

// Relationship stored in a person's note
export interface StoredRelationship {
	type: 'spouse' | 'parent-of' | 'child-of' | 'sibling';
	person: string; // Obsidian link like "[[John Doe]]"
}

// Frontmatter structure for person notes
export interface PersonFrontmatter {
	'family-tree-person': true;
	firstName: string;
	surname: string;
	gender: Gender;
	relationships?: StoredRelationship[];
}

export function getFullName(person: Person): string {
	if (person.firstName && person.surname) {
		return `${person.firstName} ${person.surname}`;
	}
	return person.firstName || person.surname || person.id;
}

export interface Relationship {
	id: string;
	type: RelationshipType;
	person1Id: string;
	person2Id: string;
	sourceFile: string;
	sourceLine: number;
}

export interface FamilyTree {
	persons: Map<string, Person>;
	relationships: Relationship[];
	lastUpdated: number;
}

export interface GraphNode {
	id: string;
	label: string;
	person: Person;
	generation?: number;
	x?: number;
	y?: number;
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	relationship: Relationship;
	style: 'solid' | 'dashed';
}

export interface FamilyGraph {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

export interface ParseResult {
	persons: Person[];
	relationships: Relationship[];
	errors: ParseError[];
}

export interface ParseError {
	message: string;
	file: string;
	line: number;
	column?: number;
}
