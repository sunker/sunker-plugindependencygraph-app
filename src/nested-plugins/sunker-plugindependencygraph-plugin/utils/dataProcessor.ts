import { ExtensionPoint, GraphData, PanelOptions, PluginDependency, PluginNode } from '../types';

import { PanelData } from '@grafana/data';

export const processTableDataToGraph = (data: PanelData, options: PanelOptions): GraphData => {
  if (!data.series.length) {
    return createSampleData();
  }

  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  // No longer need helper functions since we get extension data directly from fields

  // Extract plugin display names (remove "grafana-" prefix and "-app" suffix for cleaner display)
  const getDisplayName = (pluginId: string) => {
    if (pluginId === 'grafana-core') {
      return 'Grafana Core';
    }
    return pluginId
      .replace(/^grafana-/, '')
      .replace(/-app$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Determine plugin type based on name patterns
  const getPluginType = (pluginId: string): PluginNode['type'] => {
    if (pluginId === 'grafana-core') {
      return 'app';
    }
    if (pluginId.includes('-panel')) {
      return 'panel';
    }
    if (pluginId.includes('-datasource')) {
      return 'datasource';
    }
    return 'app'; // Default to app
  };

  // Process each series (assuming table format)
  data.series.forEach((series) => {
    if (!series.fields || series.fields.length === 0) {
      return;
    }

    // Look for the expected field names from the new data structure
    const fromAppField = series.fields.find((field) => field.name === 'from_app');
    const relationField = series.fields.find((field) => field.name === 'relation');
    const toAppField = series.fields.find((field) => field.name === 'to_app');
    const extensionIdField = series.fields.find((field) => field.name === 'extension_id');
    const extensionTypeField = series.fields.find((field) => field.name === 'extension_type');

    if (!fromAppField || !toAppField || !relationField || !extensionIdField) {
      return; // Can't create graph without required fields
    }

    // Process each row
    for (let i = 0; i < series.length; i++) {
      const fromApp = fromAppField.values[i];
      const toApp = toAppField.values[i];
      const relation = relationField.values[i];
      const extensionId = extensionIdField.values[i];
      const extensionType = extensionTypeField?.values[i] || 'link';

      if (!fromApp || !toApp || !relation || !extensionId) {
        continue;
      }

      // Focus on "extends" relationships for now
      if (relation !== 'extends') {
        continue;
      }

      // In an "extends" relationship:
      // - fromApp provides content to extension points
      // - toApp defines the extension point (could be "grafana" for core)
      // - extensionId is the specific extension point
      const contentProvider = fromApp;
      const definingPlugin = toApp === 'grafana' ? 'grafana-core' : toApp;
      const fullExtensionId = extensionId;

      // Add content provider node
      if (!nodes.has(contentProvider)) {
        nodes.set(contentProvider, {
          id: contentProvider,
          name: getDisplayName(contentProvider),
          type: getPluginType(contentProvider),
          description: `Provides content to extension points`,
        });
      }

      // Add defining plugin node if it doesn't exist
      if (!nodes.has(definingPlugin)) {
        nodes.set(definingPlugin, {
          id: definingPlugin,
          name: getDisplayName(definingPlugin),
          type: getPluginType(definingPlugin),
          description: `Defines extension points`,
        });
      }

      // Create or update extension point
      if (!extensionPoints.has(fullExtensionId)) {
        extensionPoints.set(fullExtensionId, {
          id: fullExtensionId,
          definingPlugin,
          providers: [],
          extensionType: extensionType as 'link' | 'component',
        });
      }

      const extensionPoint = extensionPoints.get(fullExtensionId)!;
      if (!extensionPoint.providers.includes(contentProvider)) {
        extensionPoint.providers.push(contentProvider);
      }

      // Add dependency from content provider to extension point
      dependencies.push({
        source: contentProvider,
        target: fullExtensionId, // Use extension point ID as target
        type: 'extends',
        description: `${getDisplayName(contentProvider)} provides ${extensionType} to ${fullExtensionId}`,
      });
    }
  });

  return {
    nodes: Array.from(nodes.values()),
    dependencies,
    extensionPoints: Array.from(extensionPoints.values()),
  };
};

// Create sample data for demonstration that matches the new data format
export const createSampleData = (): GraphData => {
  const nodes: PluginNode[] = [
    {
      id: 'grafana-core',
      name: 'Grafana Core',
      type: 'app',
      description: 'Defines core extension points',
    },
    {
      id: 'grafana-assistant-app',
      name: 'Assistant App',
      type: 'app',
      description: 'Defines extension points',
    },
    {
      id: 'grafana-asserts-app',
      name: 'Asserts App',
      type: 'app',
      description: 'Provides content to extension points',
    },
  ];

  const extensionPoints: ExtensionPoint[] = [
    {
      id: 'grafana/alerting/home',
      definingPlugin: 'grafana-core',
      providers: ['grafana-asserts-app'],
      extensionType: 'link',
    },
    {
      id: 'link nav-landing-page/nav-id-observability/v1',
      definingPlugin: 'grafana-core',
      providers: ['grafana-asserts-app'],
      extensionType: 'link',
    },
    {
      id: 'navigateToDrilldown/v1',
      definingPlugin: 'grafana-assistant-app',
      providers: ['grafana-asserts-app'],
      extensionType: 'link',
    },
    {
      id: 'alertingrule/queryeditor',
      definingPlugin: 'grafana-assistant-app',
      providers: ['grafana-asserts-app'],
      extensionType: 'component',
    },
  ];

  const dependencies: PluginDependency[] = [
    {
      source: 'grafana-asserts-app',
      target: 'grafana/alerting/home',
      type: 'extends',
      description: 'Asserts App provides link to grafana/alerting/home extension point',
    },
    {
      source: 'grafana-asserts-app',
      target: 'link nav-landing-page/nav-id-observability/v1',
      type: 'extends',
      description: 'Asserts App provides link to nav-landing-page extension point',
    },
    {
      source: 'grafana-asserts-app',
      target: 'navigateToDrilldown/v1',
      type: 'extends',
      description: 'Asserts App provides link to navigateToDrilldown extension point',
    },
    {
      source: 'grafana-asserts-app',
      target: 'alertingrule/queryeditor',
      type: 'extends',
      description: 'Asserts App provides component to alertingrule/queryeditor extension point',
    },
  ];

  return { nodes, dependencies, extensionPoints };
};

export const getDefaultOptions = (): PanelOptions => ({
  nodeSize: 30,
  linkDistance: 100,
  charge: -200,
  showLabels: true,
  showDependencyTypes: true,
  nodeColors: {
    app: '#1f77b4',
    panel: '#ff7f0e',
    datasource: '#2ca02c',
  },
  layoutType: 'hierarchical',
  enableDrag: true,
  enableZoom: true,
  sourceColumn: 'from_app',
  targetColumn: 'to_app',
  typeColumn: 'relation',
  nameColumn: 'from_app', // Use from_app as fallback for names
  pluginTypeColumn: 'plugin_type', // This field may not exist in current data
});
