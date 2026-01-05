import cytoscape, { Core, ElementDefinition, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import edgehandles from 'cytoscape-edgehandles';
import '../types/cytoscape-extensions.d';
import { App, setIcon } from 'obsidian';
import { FamilyTreeStore } from '../models/FamilyTreeStore';
import { FamilyGraph, Person, RelationshipType } from '../models/types';
import { graphStyles } from './graphStyles';
import { PersonModal } from '../modals/PersonModal';
import { RelationshipModal } from '../modals/RelationshipModal';
import { AddRelativeModal } from '../modals/AddRelativeModal';
import { NoteManager } from '../sync/NoteManager';

// Register extensions
cytoscape.use(dagre);
cytoscape.use(fcose);
cytoscape.use(edgehandles);

interface EdgeHandlesInstance {
	destroy(): void;
	enable(): void;
	disable(): void;
}

export class GraphRenderer {
	private cy: Core | null = null;
	private _isHierarchical = true;
	private edgeHandlesInstance: EdgeHandlesInstance | null = null;
	private actionButtonsContainer: HTMLElement | null = null;
	private selectedNodeId: string | null = null;

	constructor(
		private container: HTMLElement,
		private store: FamilyTreeStore,
		private app: App,
		private noteManager: NoteManager
	) {}

	get isHierarchical(): boolean {
		return this._isHierarchical;
	}

	async initialize(): Promise<void> {
		const graphData = this.store.getGraph();

		this.cy = cytoscape({
			container: this.container,
			elements: this.convertToElements(graphData),
			style: graphStyles,
			layout: {
				name: 'dagre',
				rankDir: 'TB',
				nodeSep: 60,
				rankSep: 80
			} as unknown as cytoscape.LayoutOptions,
			userZoomingEnabled: true,
			userPanningEnabled: true,
			boxSelectionEnabled: false,
			minZoom: 0.1,
			maxZoom: 3
		});

		this.setupInteractions();
		this.setupEdgeHandles();
	}

	private convertToElements(graphData: FamilyGraph): ElementDefinition[] {
		const nodes: ElementDefinition[] = graphData.nodes.map(node => ({
			data: {
				id: node.id,
				label: node.label,
				person: node.person,
				gender: node.person.gender
			}
		}));

		const edges: ElementDefinition[] = graphData.edges.map(edge => ({
			data: {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				relationship: edge.relationship,
				type: edge.relationship.type
			}
		}));

		return [...nodes, ...edges];
	}

	toggleLayout(): void {
		if (!this.cy) return;

		this._isHierarchical = !this._isHierarchical;
		this.hideActionButtons();

		const layoutConfig = this._isHierarchical
			? {
				name: 'dagre',
				rankDir: 'TB',
				nodeSep: 60,
				rankSep: 80,
				animate: true,
				animationDuration: 300
			}
			: {
				name: 'fcose',
				animate: true,
				animationDuration: 500,
				nodeRepulsion: 4500,
				idealEdgeLength: 100,
				gravity: 0.25
			};

		this.cy.layout(layoutConfig as unknown as cytoscape.LayoutOptions).run();
	}

	private setupInteractions(): void {
		if (!this.cy) return;

		// Double-click to edit person
		this.cy.on('dbltap', 'node', (event) => {
			const node = event.target;
			const person = node.data('person');
			this.hideActionButtons();
			new PersonModal(this.app, this.store, this.noteManager, person).open();
		});

		// Click node to show action buttons
		this.cy.on('tap', 'node', (event) => {
			const node = event.target as NodeSingular;
			const person = node.data('person') as Person;
			this.showActionButtons(node, person);
		});

		// Click on canvas to hide action buttons
		this.cy.on('tap', (event) => {
			if (event.target === this.cy) {
				this.hideActionButtons();
			}
		});

		// Hide buttons on pan/zoom
		this.cy.on('pan zoom', () => {
			if (this.actionButtonsContainer && this.selectedNodeId) {
				this.updateActionButtonsPosition();
			}
		});

		// Right-click context menu on node
		this.cy.on('cxttap', 'node', (event) => {
			const node = event.target;
			const person = node.data('person');
			this.hideActionButtons();
			this.showNodeContextMenu(event.originalEvent as MouseEvent, person.id);
		});

		// Right-click on edge
		this.cy.on('cxttap', 'edge', (event) => {
			const edge = event.target;
			const relationship = edge.data('relationship');
			this.showEdgeContextMenu(event.originalEvent as MouseEvent, relationship.id);
		});
	}

	private showActionButtons(node: NodeSingular, person: Person): void {
		this.hideActionButtons();
		this.selectedNodeId = person.id;

		// Create container for action buttons
		this.actionButtonsContainer = document.createElement('div');
		this.actionButtonsContainer.addClass('family-tree-action-buttons');

		// Prevent clicks on container from propagating
		this.actionButtonsContainer.addEventListener('mousedown', (e) => {
			e.stopPropagation();
			e.preventDefault();
		});

		// Add Parent button (top)
		const addParentBtn = this.createActionButton('arrow-up', 'Add Parent', 'top');
		this.addButtonHandler(addParentBtn, () => {
			new AddRelativeModal(this.app, this.store, this.noteManager, person, 'parent').open();
		});

		// Add Sibling button (left)
		const addSiblingBtn = this.createActionButton('arrow-left', 'Add Sibling', 'left');
		this.addButtonHandler(addSiblingBtn, () => {
			new AddRelativeModal(this.app, this.store, this.noteManager, person, 'sibling').open();
		});

		// Add Spouse button (right)
		const addSpouseBtn = this.createActionButton('arrow-right', 'Add Spouse', 'right');
		this.addButtonHandler(addSpouseBtn, () => {
			new AddRelativeModal(this.app, this.store, this.noteManager, person, 'spouse').open();
		});

		// Add Child button (bottom)
		const addChildBtn = this.createActionButton('arrow-down', 'Add Child', 'bottom');
		this.addButtonHandler(addChildBtn, () => {
			new AddRelativeModal(this.app, this.store, this.noteManager, person, 'child').open();
		});

		this.actionButtonsContainer.appendChild(addParentBtn);
		this.actionButtonsContainer.appendChild(addSiblingBtn);
		this.actionButtonsContainer.appendChild(addSpouseBtn);
		this.actionButtonsContainer.appendChild(addChildBtn);

		// Append to document.body to avoid canvas interference
		document.body.appendChild(this.actionButtonsContainer);
		this.updateActionButtonsPosition();
	}

	private addButtonHandler(btn: HTMLElement, callback: () => void): void {
		// Use mouseup for the actual action to allow visual feedback
		btn.addEventListener('mousedown', (e: Event) => {
			e.stopPropagation();
		});
		btn.addEventListener('mouseup', (e: Event) => {
			e.stopPropagation();
			this.hideActionButtons();
			callback();
		});
		btn.addEventListener('click', (e: Event) => {
			e.stopPropagation();
		});
	}

	private createActionButton(icon: string, tooltip: string, position: string): HTMLElement {
		const btn = document.createElement('button');
		btn.addClass('family-tree-action-btn');
		btn.addClass(`family-tree-action-btn-${position}`);
		btn.setAttribute('aria-label', tooltip);
		btn.setAttribute('title', tooltip);
		setIcon(btn, icon);
		return btn;
	}

	private updateActionButtonsPosition(): void {
		if (!this.cy || !this.actionButtonsContainer || !this.selectedNodeId) return;

		const node = this.cy.getElementById(this.selectedNodeId);
		if (!node || node.length === 0) {
			this.hideActionButtons();
			return;
		}

		const pos = node.renderedPosition();
		const containerRect = this.container.getBoundingClientRect();

		// Calculate absolute position on screen
		const absoluteX = containerRect.left + pos.x;
		const absoluteY = containerRect.top + pos.y;

		// Center the action buttons container on the node
		this.actionButtonsContainer.style.left = `${absoluteX}px`;
		this.actionButtonsContainer.style.top = `${absoluteY}px`;
	}

	private hideActionButtons(): void {
		if (this.actionButtonsContainer) {
			this.actionButtonsContainer.remove();
			this.actionButtonsContainer = null;
		}
		this.selectedNodeId = null;
	}

	private setupEdgeHandles(): void {
		if (!this.cy) return;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const cy = this.cy as any;
		this.edgeHandlesInstance = cy.edgehandles({
			snap: true,
			noEdgeEventsInDraw: true,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			complete: (sourceNode: any, targetNode: any, addedEdge: any) => {
				// Edge drawn - prompt for relationship type
				addedEdge.remove();
				this.promptRelationship(sourceNode.id(), targetNode.id());
			}
		});
	}

	private promptRelationship(sourceId: string, targetId: string): void {
		const sourcePerson = this.store.getPerson(sourceId);
		const targetPerson = this.store.getPerson(targetId);

		if (sourcePerson && targetPerson) {
			new RelationshipModal(
				this.app,
				this.store,
				this.noteManager,
				sourcePerson,
				targetPerson
			).open();
		}
	}

	private showNodeContextMenu(event: MouseEvent, personId: string): void {
		const menu = document.createElement('div');
		menu.addClass('family-tree-context-menu');
		menu.style.left = `${event.clientX}px`;
		menu.style.top = `${event.clientY}px`;

		const editItem = menu.createDiv('family-tree-context-item');
		editItem.textContent = 'Edit Person';
		editItem.addEventListener('click', () => {
			const person = this.store.getPerson(personId);
			if (person) {
				new PersonModal(this.app, this.store, this.noteManager, person).open();
			}
			menu.remove();
		});

		const openNoteItem = menu.createDiv('family-tree-context-item');
		openNoteItem.textContent = 'Open Note';
		openNoteItem.addEventListener('click', () => {
			const person = this.store.getPerson(personId);
			if (person?.notePath) {
				this.app.workspace.openLinkText(person.notePath, '');
			}
			menu.remove();
		});

		const deleteItem = menu.createDiv('family-tree-context-item danger');
		deleteItem.textContent = 'Delete Person';
		deleteItem.addEventListener('click', () => {
			this.store.removePerson(personId);
			menu.remove();
		});

		document.body.appendChild(menu);

		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
			}
		};
		setTimeout(() => document.addEventListener('click', closeMenu), 0);
	}

	private showEdgeContextMenu(event: MouseEvent, relationshipId: string): void {
		const menu = document.createElement('div');
		menu.addClass('family-tree-context-menu');
		menu.style.left = `${event.clientX}px`;
		menu.style.top = `${event.clientY}px`;

		const deleteItem = menu.createDiv('family-tree-context-item danger');
		deleteItem.textContent = 'Delete Relationship';
		deleteItem.addEventListener('click', () => {
			this.store.removeRelationship(relationshipId);
			menu.remove();
		});

		document.body.appendChild(menu);

		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener('click', closeMenu);
			}
		};
		setTimeout(() => document.addEventListener('click', closeMenu), 0);
	}

	openAddPersonModal(): void {
		new PersonModal(this.app, this.store, this.noteManager, null).open();
	}

	openAddRelationshipModal(): void {
		const persons = this.store.getPersons();
		if (persons.length < 2) {
			// Need at least 2 persons
			return;
		}
		new RelationshipModal(this.app, this.store, this.noteManager, null, null).open();
	}

	refresh(): void {
		if (!this.cy) return;

		this.hideActionButtons();
		const graphData = this.store.getGraph();
		this.cy.elements().remove();
		this.cy.add(this.convertToElements(graphData));

		const layoutConfig = this._isHierarchical
			? { name: 'dagre', rankDir: 'TB', nodeSep: 60, rankSep: 80 }
			: { name: 'fcose', nodeRepulsion: 4500, idealEdgeLength: 100 };

		this.cy.layout(layoutConfig as unknown as cytoscape.LayoutOptions).run();
	}

	fitView(): void {
		this.hideActionButtons();
		this.cy?.fit(undefined, 50);
	}

	destroy(): void {
		this.hideActionButtons();
		this.edgeHandlesInstance?.destroy();
		this.cy?.destroy();
		this.cy = null;
	}
}
