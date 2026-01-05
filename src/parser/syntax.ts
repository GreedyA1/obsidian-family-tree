export const SYNTAX_PATTERNS = {
	// Matches: person john_doe:
	PERSON_START: /^person\s+([a-zA-Z_][a-zA-Z0-9_]*):\s*$/,

	// Property patterns (indented with 2 spaces)
	FIRST_NAME: /^\s{2}firstName:\s*(.+)$/,
	SURNAME: /^\s{2}surname:\s*(.+)$/,
	// Legacy support for 'name' field (will be parsed as firstName)
	NAME: /^\s{2}name:\s*(.+)$/,
	GENDER: /^\s{2}gender:\s*(male|female|other)$/,
	NOTE: /^\s{2}note:\s*\[\[(.+)\]\]$/,

	// Relationship patterns
	// spouse: john_doe -- jane_doe
	SPOUSE: /^spouse:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*--\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/,

	// parent: john_doe -> alice_doe
	PARENT: /^parent:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/,

	// sibling: alice_doe -- bob_doe
	SIBLING: /^sibling:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*--\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/,

	// Code block pattern
	CODE_BLOCK: /```family-tree\n([\s\S]*?)```/g,

	// Comment pattern
	COMMENT: /^\s*#/,
};

export function generatePersonId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

export function generateRelationshipId(type: string, person1: string, person2: string): string {
	return `${type}_${person1}_${person2}`;
}
