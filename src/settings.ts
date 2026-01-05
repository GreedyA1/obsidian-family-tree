import { App, PluginSettingTab, Setting } from 'obsidian';
import FamilyTreePlugin from './main';

export interface FamilyTreeSettings {
	defaultLayout: 'hierarchical' | 'force-directed';
	peopleFolder: string;
}

export const DEFAULT_SETTINGS: FamilyTreeSettings = {
	defaultLayout: 'hierarchical',
	peopleFolder: 'People'
};

export class FamilyTreeSettingTab extends PluginSettingTab {
	plugin: FamilyTreePlugin;

	constructor(app: App, plugin: FamilyTreePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		;

		new Setting(containerEl)
			.setName('Default Layout')
			.setDesc('Choose the default graph layout when opening the view')
			.addDropdown(dropdown => dropdown
				.addOption('hierarchical', 'Hierarchical (Tree)')
				.addOption('force-directed', 'Force-Directed (Graph)')
				.setValue(this.plugin.settings.defaultLayout)
				.onChange(async (value) => {
					this.plugin.settings.defaultLayout = value as 'hierarchical' | 'force-directed';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('People Folder')
			.setDesc('Folder where person notes are stored')
			.addText(text => text
				.setPlaceholder('People')
				.setValue(this.plugin.settings.peopleFolder)
				.onChange(async (value) => {
					this.plugin.settings.peopleFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName("How It Works").setHeading();

		const syntaxEl = containerEl.createDiv('family-tree-syntax-reference');
		syntaxEl.innerHTML = `
			<h4>Person Notes</h4>
			<p>Each person is stored as a note with frontmatter. Relationships are stored in the note and use Obsidian links:</p>
			<pre><code>---
family-tree-person: true
firstName: "John"
surname: "Doe"
gender: male
relationships:
  - type: spouse
    person: "[[Jane Doe]]"
  - type: parent-of
    person: "[[Alice Doe]]"
---

# John Doe</code></pre>

			<h4>Relationship Types</h4>
			<ul>
				<li><code>spouse</code> - Marriage/partnership</li>
				<li><code>parent-of</code> - Parent to child</li>
				<li><code>child-of</code> - Child to parent</li>
				<li><code>sibling</code> - Brothers/sisters</li>
			</ul>
			<p><strong>Tip:</strong> Add people and relationships via the graph view - everything is saved automatically!</p>
		`;
	}
}
