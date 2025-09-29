export interface PluginNode {
  id: string;
  name: string;
  type: 'app' | 'panel' | 'datasource';
  version?: string;
  description?: string;
  dependencies?: string[];
  x?: number;
  y?: number;
}

export interface PluginDependency {
  source: string; // plugin ID that provides content/functionality
  target: string; // plugin ID that consumes content/functionality
  type: 'extends' | 'depends' | 'integrates';
  description?: string;
}

export interface GraphData {
  nodes: PluginNode[];
  dependencies: PluginDependency[];
}

export interface PanelOptions {
  // Visualization options
  nodeSize: number;
  linkDistance: number;
  charge: number;
  showLabels: boolean;
  showDependencyTypes: boolean;

  // Color options
  nodeColors: {
    app: string;
    panel: string;
    datasource: string;
  };

  // Layout options
  layoutType: 'force' | 'hierarchical' | 'circular';
  enableDrag: boolean;
  enableZoom: boolean;

  // Data options
  sourceColumn: string;
  targetColumn: string;
  typeColumn: string;
  nameColumn: string;
  pluginTypeColumn: string;
}
