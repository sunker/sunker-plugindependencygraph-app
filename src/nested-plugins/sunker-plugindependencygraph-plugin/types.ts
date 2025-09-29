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

export interface ExtensionPoint {
  id: string; // extension point ID (e.g., "grafana/alerting/home")
  definingPlugin: string; // plugin that defines this extension point
  providers: string[]; // apps that provide content to this extension point
  extensionType?: 'link' | 'component' | 'function'; // type of extension
}

export interface GraphData {
  nodes: PluginNode[];
  dependencies: PluginDependency[];
  extensionPoints: ExtensionPoint[];
}

export interface PanelOptions {
  // Visualization options
  showDependencyTypes: boolean;

  // Layout options
  layoutType: 'hierarchical';

  // Filtering options
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
}
