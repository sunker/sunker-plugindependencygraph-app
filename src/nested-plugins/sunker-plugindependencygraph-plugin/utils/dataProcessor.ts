import { GraphData, PanelOptions, PluginDependency, PluginNode } from '../types';

import { PanelData } from '@grafana/data';

export const processTableDataToGraph = (data: PanelData, options: PanelOptions): GraphData => {
  if (!data.series.length) {
    return createSampleData();
  }

  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];

  // Process each series (assuming table format)
  data.series.forEach((series) => {
    if (!series.fields || series.fields.length === 0) {
      return;
    }

    // Look for the expected field names from the provided data structure
    const fromAppField = series.fields.find((field) => field.name === 'from_app');
    const relationField = series.fields.find((field) => field.name === 'relation');
    const toAppField = series.fields.find((field) => field.name === 'to_app');
    const evidenceField = series.fields.find((field) => field.name === 'evidence');

    if (!fromAppField || !toAppField || !relationField) {
      return; // Can't create graph without required fields
    }

    // Process each row
    for (let i = 0; i < series.length; i++) {
      const fromApp = fromAppField.values[i];
      const toApp = toAppField.values[i];
      const relation = relationField.values[i];
      const evidence = evidenceField?.values[i];

      if (!fromApp || !toApp || !relation) {
        continue;
      }

      // Focus on "extends" relationships for now
      if (relation !== 'extends') {
        continue;
      }

      // In an "extends" relationship:
      // - fromApp is the CONSUMER (the one extending)
      // - toApp is the PROVIDER (the one being extended)
      const consumerId = fromApp;
      const providerId = toApp;

      // Extract plugin display names (remove "grafana-" prefix and "-app" suffix for cleaner display)
      const getDisplayName = (pluginId: string) => {
        return pluginId
          .replace(/^grafana-/, '')
          .replace(/-app$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
      };

      const consumerName = getDisplayName(consumerId);
      const providerName = getDisplayName(providerId);

      // Determine plugin type based on name patterns (this could be made configurable)
      const getPluginType = (pluginId: string): PluginNode['type'] => {
        if (pluginId.includes('-panel')) {
          return 'panel';
        }
        if (pluginId.includes('-datasource')) {
          return 'datasource';
        }
        return 'app'; // Default to app
      };

      // Add consumer node if not exists
      if (!nodes.has(consumerId)) {
        nodes.set(consumerId, {
          id: consumerId,
          name: consumerName,
          type: getPluginType(consumerId),
          description: evidence || undefined,
        });
      }

      // Add provider node if not exists
      if (!nodes.has(providerId)) {
        nodes.set(providerId, {
          id: providerId,
          name: providerName,
          type: getPluginType(providerId),
        });
      }

      // Add dependency (from provider to consumer to show extension flow)
      dependencies.push({
        source: providerId, // Provider is the source
        target: consumerId, // Consumer is the target
        type: 'extends',
        description: evidence || `${consumerName} extends ${providerName}`,
      });
    }
  });

  return {
    nodes: Array.from(nodes.values()),
    dependencies,
  };
};

// Create sample data for demonstration that matches the actual plugin extension use case
export const createSampleData = (): GraphData => {
  const nodes: PluginNode[] = [
    {
      id: 'grafana-extensionstest-app',
      name: 'Extensions Test App',
      type: 'app',
      description: 'Core extension provider app',
    },
    {
      id: 'grafana-extensionexample1-app',
      name: 'Extension Example 1 App',
      type: 'app',
      description: 'First extension consumer app',
    },
    {
      id: 'grafana-extensionexample2-app',
      name: 'Extension Example 2 App',
      type: 'app',
      description: 'Second extension consumer app',
    },
    {
      id: 'grafana-lokiexplore-app',
      name: 'Loki Explore App',
      type: 'app',
      description: 'Loki exploration app',
    },
    {
      id: 'grafana-adaptivelogs-app',
      name: 'Adaptive Logs App',
      type: 'app',
      description: 'Adaptive logs processing app',
    },
  ];

  const dependencies: PluginDependency[] = [
    {
      source: 'grafana-extensionstest-app',
      target: 'grafana-extensionexample1-app',
      type: 'extends',
      description: 'Extension Example 1 extends Extensions Test App functionality',
    },
    {
      source: 'grafana-extensionstest-app',
      target: 'grafana-extensionexample2-app',
      type: 'extends',
      description: 'Extension Example 2 extends Extensions Test App functionality',
    },
  ];

  return { nodes, dependencies };
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
  layoutType: 'force',
  enableDrag: true,
  enableZoom: true,
  sourceColumn: 'from_app',
  targetColumn: 'to_app',
  typeColumn: 'relation',
  nameColumn: 'from_app', // Use from_app as fallback for names
  pluginTypeColumn: 'plugin_type', // This field may not exist in current data
});
