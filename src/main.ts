import { Plugin } from 'obsidian';
import { FamilyTreeView, VIEW_TYPE_FAMILY_TREE } from './views/FamilyTreeView';
import { FamilyTreeStore } from './models/FamilyTreeStore';
import { VaultScanner } from './sync/VaultScanner';
import { FamilyTreeSettings, DEFAULT_SETTINGS, FamilyTreeSettingTab } from './settings';

export default class FamilyTreePlugin extends Plugin {
	settings: FamilyTreeSettings;
	store: FamilyTreeStore;
	scanner: VaultScanner;

	async onload() {
		await this.loadSettings();

		// Initialize store
		this.store = new FamilyTreeStore();

		// Initialize scanner with settings
		this.scanner = new VaultScanner(
			this.app,
			this.store,
			this.settings.peopleFolder
		);

		// Register the view
		this.registerView(
			VIEW_TYPE_FAMILY_TREE,
			(leaf) => new FamilyTreeView(leaf, this.store, this.scanner.getNoteManager())
		);

		// Register code block processor for preview
		this.registerMarkdownCodeBlockProcessor('family-tree', (source, el, ctx) => {
			const container = el.createDiv('family-tree-preview');

			// Count persons and relationships in this block
			const personMatches = source.match(/^person\s+\w+:/gm) || [];
			const relMatches = source.match(/^(spouse|parent|sibling):/gm) || [];

			container.createDiv('family-tree-preview-info').innerHTML =
				`<strong>Family Tree Block</strong><br>` +
				`${personMatches.length} person(s), ${relMatches.length} relationship(s)`;

			const openBtn = container.createEl('button', {
				text: 'Open Family Tree View',
				cls: 'family-tree-preview-btn'
			});
			openBtn.addEventListener('click', () => this.activateView());
		});

		// Add ribbon icon
		this.addRibbonIcon('git-fork', 'Open Family Tree', () => {
			this.activateView();
		});

		// Add command to open view
		this.addCommand({
			id: 'open-family-tree',
			name: 'Open Family Tree View',
			callback: () => this.activateView()
		});

		// Add command to refresh data
		this.addCommand({
			id: 'refresh-family-tree',
			name: 'Refresh Family Tree Data',
			callback: async () => {
				await this.scanner.initialScan();
			}
		});

		// Add settings tab
		this.addSettingTab(new FamilyTreeSettingTab(this.app, this));

		// Perform initial vault scan after layout is ready
		this.app.workspace.onLayoutReady(async () => {
			await this.scanner.initialScan();
			this.scanner.registerWatchers();
		});
	}

	onunload() {
		this.scanner?.unregisterWatchers();
		
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_FAMILY_TREE)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_FAMILY_TREE,
					active: true
				});
				leaf = rightLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
