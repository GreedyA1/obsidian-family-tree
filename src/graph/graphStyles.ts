import cytoscape from 'cytoscape';

type CytoscapeStylesheet = cytoscape.StylesheetStyle | cytoscape.StylesheetCSS;

export const graphStyles: CytoscapeStylesheet[] = [
	{
		selector: 'node',
		style: {
			'background-color': '#7c3aed',
			'label': 'data(label)',
			'color': '#ffffff',
			'text-valign': 'center',
			'text-halign': 'center',
			'font-size': '12px',
			'font-weight': 'bold',
			'width': '80px',
			'height': '40px',
			'shape': 'round-rectangle',
			'text-wrap': 'wrap',
			'text-max-width': '70px',
			'border-width': 2,
			'border-color': '#5b21b6'
		}
	},
	{
		selector: 'node[gender = "male"]',
		style: {
			'background-color': '#3b82f6',
			'border-color': '#1d4ed8'
		}
	},
	{
		selector: 'node[gender = "female"]',
		style: {
			'background-color': '#ec4899',
			'border-color': '#be185d'
		}
	},
	{
		selector: 'node:selected',
		style: {
			'border-width': 4,
			'border-color': '#fbbf24'
		}
	},
	{
		selector: 'node:active',
		style: {
			'overlay-opacity': 0.2,
			'overlay-color': '#fbbf24'
		}
	},
	{
		selector: 'edge',
		style: {
			'width': 2,
			'line-color': '#6b7280',
			'curve-style': 'bezier',
			'target-arrow-shape': 'triangle',
			'target-arrow-color': '#6b7280'
		}
	},
	{
		selector: 'edge[type = "spouse"]',
		style: {
			'line-style': 'dashed',
			'line-color': '#f59e0b',
			'target-arrow-shape': 'none',
			'source-arrow-shape': 'none'
		}
	},
	{
		selector: 'edge[type = "parent"]',
		style: {
			'line-color': '#10b981',
			'target-arrow-color': '#10b981'
		}
	},
	{
		selector: 'edge[type = "sibling"]',
		style: {
			'line-style': 'dotted',
			'line-color': '#8b5cf6',
			'target-arrow-shape': 'none'
		}
	},
	{
		selector: 'edge:selected',
		style: {
			'width': 4,
			'line-color': '#fbbf24'
		}
	},
	{
		selector: '.eh-handle',
		style: {
			'background-color': '#ef4444',
			'width': 12,
			'height': 12,
			'shape': 'ellipse',
			'overlay-opacity': 0,
			'border-width': 12,
			'border-opacity': 0
		}
	},
	{
		selector: '.eh-hover',
		style: {
			'background-color': '#ef4444'
		}
	},
	{
		selector: '.eh-source',
		style: {
			'border-width': 2,
			'border-color': '#ef4444'
		}
	},
	{
		selector: '.eh-target',
		style: {
			'border-width': 2,
			'border-color': '#ef4444'
		}
	},
	{
		selector: '.eh-preview, .eh-ghost-edge',
		style: {
			'line-color': '#ef4444',
			'target-arrow-color': '#ef4444',
			'source-arrow-color': '#ef4444'
		}
	}
];
