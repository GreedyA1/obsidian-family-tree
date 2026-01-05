declare module 'cytoscape-dagre' {
	import { Core, Ext } from 'cytoscape';
	const ext: Ext;
	export default ext;
}

declare module 'cytoscape-fcose' {
	import { Core, Ext } from 'cytoscape';
	const ext: Ext;
	export default ext;
}

declare module 'cytoscape-edgehandles' {
	import { Core, Ext } from 'cytoscape';

	interface EdgeHandlesOptions {
		snap?: boolean;
		noEdgeEventsInDraw?: boolean;
		complete?: (sourceNode: any, targetNode: any, addedEdge: any) => void;
	}

	interface EdgeHandlesInstance {
		destroy(): void;
		enable(): void;
		disable(): void;
	}

	const ext: Ext;
	export default ext;

	declare module 'cytoscape' {
		interface Core {
			edgehandles(options?: EdgeHandlesOptions): EdgeHandlesInstance;
		}
	}
}
