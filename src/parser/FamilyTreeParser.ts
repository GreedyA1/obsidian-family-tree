import { Vault } from 'obsidian';
import { Relationship, ParseResult, ParseError, RelationshipType } from '../models/types';
import { SYNTAX_PATTERNS, generateRelationshipId } from './syntax';

/**
 * Parser for family-tree code blocks.
 * Now only parses RELATIONSHIPS - person data comes from note frontmatter.
 */
export class FamilyTreeParser {
	constructor(private vault: Vault) {}

	async parseVault(): Promise<ParseResult> {
		const allRelationships: Relationship[] = [];
		const allErrors: ParseError[] = [];

		const markdownFiles = this.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			const content = await this.vault.cachedRead(file);
			const result = this.parseFile(content, file.path);

			allRelationships.push(...result.relationships);
			allErrors.push(...result.errors);
		}

		return {
			persons: [], // Persons come from note frontmatter, not code blocks
			relationships: allRelationships,
			errors: allErrors
		};
	}

	parseFile(content: string, filePath: string): ParseResult {
		const relationships: Relationship[] = [];
		const errors: ParseError[] = [];

		const codeBlockRegex = new RegExp(SYNTAX_PATTERNS.CODE_BLOCK.source, 'g');
		let match;

		while ((match = codeBlockRegex.exec(content)) !== null) {
			const blockContent = match[1];
			if (!blockContent) continue;

			const blockStartLine = content.slice(0, match.index).split('\n').length;

			const result = this.parseBlock(blockContent, filePath, blockStartLine);
			relationships.push(...result.relationships);
			errors.push(...result.errors);
		}

		return { persons: [], relationships, errors };
	}

	private parseBlock(
		content: string,
		filePath: string,
		startLine: number
	): ParseResult {
		const relationships: Relationship[] = [];
		const errors: ParseError[] = [];

		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? '';
			const lineNum = startLine + i + 1;

			// Skip comments, empty lines, and person definitions (handled by frontmatter)
			if (SYNTAX_PATTERNS.COMMENT.test(line) || line.trim() === '') {
				continue;
			}

			// Skip person definitions and their properties
			if (SYNTAX_PATTERNS.PERSON_START.test(line) || line.startsWith('  ')) {
				continue;
			}

			// Relationship definitions
			const rel = this.parseRelationship(line, filePath, lineNum);
			if (rel) {
				relationships.push(rel);
			}
		}

		return { persons: [], relationships, errors };
	}

	private parseRelationship(
		line: string,
		filePath: string,
		lineNum: number
	): Relationship | null {
		// Spouse relationship
		const spouseMatch = line.match(SYNTAX_PATTERNS.SPOUSE);
		if (spouseMatch && spouseMatch[1] && spouseMatch[2]) {
			return {
				id: generateRelationshipId('spouse', spouseMatch[1], spouseMatch[2]),
				type: 'spouse' as RelationshipType,
				person1Id: spouseMatch[1],
				person2Id: spouseMatch[2],
				sourceFile: filePath,
				sourceLine: lineNum
			};
		}

		// Parent relationship
		const parentMatch = line.match(SYNTAX_PATTERNS.PARENT);
		if (parentMatch && parentMatch[1] && parentMatch[2]) {
			return {
				id: generateRelationshipId('parent', parentMatch[1], parentMatch[2]),
				type: 'parent' as RelationshipType,
				person1Id: parentMatch[1],
				person2Id: parentMatch[2],
				sourceFile: filePath,
				sourceLine: lineNum
			};
		}

		// Sibling relationship
		const siblingMatch = line.match(SYNTAX_PATTERNS.SIBLING);
		if (siblingMatch && siblingMatch[1] && siblingMatch[2]) {
			return {
				id: generateRelationshipId('sibling', siblingMatch[1], siblingMatch[2]),
				type: 'sibling' as RelationshipType,
				person1Id: siblingMatch[1],
				person2Id: siblingMatch[2],
				sourceFile: filePath,
				sourceLine: lineNum
			};
		}

		return null;
	}
}
