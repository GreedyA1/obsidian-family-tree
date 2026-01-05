import { ItemView, WorkspaceLeaf, App, setIcon } from 'obsidian';
import { FamilyTreeStore } from '../models/FamilyTreeStore';
import { GraphRenderer } from '../graph/GraphRenderer';
import { NoteManager } from '../sync/NoteManager';

export const VIEW_TYPE_FAMILY_TREE = 'family-tree-view';

export class FamilyTreeView extends ItemView {
	private graphRenderer: GraphRenderer | null = null;
	private store: FamilyTreeStore;
	private noteManager: NoteManager;
	private toolbarEl: HTMLElement | null = null;
	private graphContainerEl: HTMLElement | null = null;
	private layoutBtn: HTMLButtonElement | null = null;

	constructor(leaf: WorkspaceLeaf, store: FamilyTreeStore, noteManager: NoteManager) {
		super(leaf);
		this.store = store;
		this.noteManager = noteManager;
	}

	getViewType(): string {
		return VIEW_TYPE_FAMILY_TREE;
	}

	getDisplayText(): string {
		return 'Family Tree';
	}

	getIcon(): string {
		return 'git-fork';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('family-tree-container');

		// Create toolbar
		this.toolbarEl = container.createDiv('family-tree-toolbar');
		this.buildToolbar();

		// Create graph container
		this.graphContainerEl = container.createDiv('family-tree-graph');

		// Initialize graph renderer
		this.graphRenderer = new GraphRenderer(
			this.graphContainerEl,
			this.store,
			this.app,
			this.noteManager
		);

		// Subscribe to store updates
		this.registerEvent(
			this.store.on('update', () => {
				this.graphRenderer?.refresh();
			})
		);

		// Initial render
		await this.graphRenderer.initialize();
	}

	async onClose(): Promise<void> {
		this.graphRenderer?.destroy();
		this.graphRenderer = null;
	}

	private buildToolbar(): void {
		if (!this.toolbarEl) return;

		// Layout toggle button
		this.layoutBtn = this.toolbarEl.createEl('button', {
			cls: 'family-tree-toolbar-btn',
			attr: { 'aria-label': 'Toggle layout' }
		});
		setIcon(this.layoutBtn, 'layout-grid');
		const layoutText = this.layoutBtn.createSpan({ text: 'Hierarchical' });
		this.layoutBtn.addEventListener('click', () => {
			if (this.graphRenderer) {
				this.graphRenderer.toggleLayout();
				layoutText.textContent = this.graphRenderer.isHierarchical
					? 'Hierarchical'
					: 'Force';
			}
		});

		// Add person button
		const addPersonBtn = this.toolbarEl.createEl('button', {
			cls: 'family-tree-toolbar-btn',
			attr: { 'aria-label': 'Add person' }
		});
		setIcon(addPersonBtn, 'user-plus');
		addPersonBtn.createSpan({ text: 'Add Person' });
		addPersonBtn.addEventListener('click', () => {
			this.graphRenderer?.openAddPersonModal();
		});

		// Add relationship button
		const addRelBtn = this.toolbarEl.createEl('button', {
			cls: 'family-tree-toolbar-btn',
			attr: { 'aria-label': 'Add relationship' }
		});
		setIcon(addRelBtn, 'link');
		addRelBtn.createSpan({ text: 'Add Relationship' });
		addRelBtn.addEventListener('click', () => {
			this.graphRenderer?.openAddRelationshipModal();
		});

		// Fit view button
		const fitBtn = this.toolbarEl.createEl('button', {
			cls: 'family-tree-toolbar-btn',
			attr: { 'aria-label': 'Fit view' }
		});
		setIcon(fitBtn, 'maximize');
		fitBtn.createSpan({ text: 'Fit' });
		fitBtn.addEventListener('click', () => {
			this.graphRenderer?.fitView();
		});
	}
}
