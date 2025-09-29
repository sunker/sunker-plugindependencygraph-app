import { DataFrame, PanelData } from '@grafana/data';
import { ExtensionPoint, GraphData, PanelOptions, PluginDependency, PluginNode } from '../types';

export const processTableDataToGraph = (data: PanelData, options: PanelOptions): GraphData => {
  console.log('processTableDataToGraph - received data:', data);

  if (!data.series.length) {
    console.log('processTableDataToGraph - no series data, returning empty');
    return { nodes: [], dependencies: [], extensionPoints: [] };
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

    // Look for the actual field names from the CSV data
    const fromAppField = series.fields.find((field) => field.name === 'from_app');
    const relationField = series.fields.find((field) => field.name === 'relation');
    const toAppField = series.fields.find((field) => field.name === 'to_app');
    const extensionPointIdField = series.fields.find((field) => field.name === 'extension_point_id');
    const extensionTypeField = series.fields.find((field) => field.name === 'extension_type');

    console.log('processTableDataToGraph - fields found:', {
      fromAppField: fromAppField?.name,
      toAppField: toAppField?.name,
      relationField: relationField?.name,
      extensionPointIdField: extensionPointIdField?.name,
      extensionTypeField: extensionTypeField?.name,
      allFieldNames: series.fields.map((f) => f.name),
    });

    if (!fromAppField || !toAppField || !relationField || !extensionPointIdField) {
      console.log('processTableDataToGraph - missing required fields, skipping series');
      return; // Can't create graph without required fields
    }

    // Process each row
    for (let i = 0; i < series.length; i++) {
      const fromApp = fromAppField.values[i];
      const toApp = toAppField.values[i];
      const relation = relationField.values[i];
      const extensionPointId = extensionPointIdField.values[i];
      const extensionType = extensionTypeField?.values[i] || 'link';

      if (!fromApp || !toApp || !relation || !extensionPointId) {
        continue;
      }

      // Focus on "extends" relationships for now
      if (relation !== 'extends') {
        continue;
      }

      // In an "extends" relationship:
      // - fromApp provides content to extension points
      // - toApp defines the extension point (could be "grafana" for core)
      // - extensionPointId is the specific extension point
      const contentProvider = fromApp;
      const definingPlugin = toApp === 'grafana' ? 'grafana-core' : toApp;
      const fullExtensionId = extensionPointId;

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

  // Apply filtering based on selectedContentProviders
  let filteredDependencies = dependencies;
  let filteredExtensionPoints = Array.from(extensionPoints.values());
  let filteredNodes = Array.from(nodes.values());

  if (options.selectedContentProviders && options.selectedContentProviders.length > 0) {
    // Filter dependencies to only include selected content providers
    filteredDependencies = dependencies.filter((dep) => options.selectedContentProviders.includes(dep.source));

    // Update extension points to only include those that still have providers after filtering
    filteredExtensionPoints = filteredExtensionPoints
      .map((ep) => ({
        ...ep,
        providers: ep.providers.filter((provider) => options.selectedContentProviders.includes(provider)),
      }))
      .filter((ep) => ep.providers.length > 0); // Remove extension points with no providers

    // Get set of defining plugins that still have extension points
    const activeDefiningPlugins = new Set(filteredExtensionPoints.map((ep) => ep.definingPlugin));

    // Get set of selected content providers
    const selectedProviders = new Set(options.selectedContentProviders);

    // Filter nodes to only include selected content providers and active defining plugins
    filteredNodes = filteredNodes.filter(
      (node) => selectedProviders.has(node.id) || activeDefiningPlugins.has(node.id)
    );
  }

  // Apply filtering based on selectedContentConsumers
  if (options.selectedContentConsumers && options.selectedContentConsumers.length > 0) {
    const selectedConsumers = new Set(options.selectedContentConsumers);

    // Filter extension points to only include those defined by selected consumers
    filteredExtensionPoints = filteredExtensionPoints.filter((ep) => selectedConsumers.has(ep.definingPlugin));

    // Filter dependencies to only include those targeting remaining extension points
    const remainingExtensionPointIds = new Set(filteredExtensionPoints.map((ep) => ep.id));
    filteredDependencies = filteredDependencies.filter((dep) => remainingExtensionPointIds.has(dep.target));

    // Get set of content providers that still have valid dependencies
    const activeContentProviders = new Set(filteredDependencies.map((dep) => dep.source));

    // Filter nodes to only include selected consumers and active content providers
    filteredNodes = filteredNodes.filter(
      (node) => selectedConsumers.has(node.id) || activeContentProviders.has(node.id)
    );
  }

  const result = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: filteredExtensionPoints,
  };

  console.log('processTableDataToGraph - final result:', result);

  return result;
};

// Extract all available content providers from the data for the multiselect options
export const getAvailableContentProviders = (data: PanelData | DataFrame[]): string[] => {
  const series = Array.isArray(data) ? data : data.series;

  if (!series.length) {
    return [];
  }

  const contentProviders = new Set<string>();

  series.forEach((series) => {
    if (!series.fields || series.fields.length === 0) {
      return;
    }

    const fromAppField = series.fields.find((field) => field.name === 'from_app');
    const relationField = series.fields.find((field) => field.name === 'relation');

    if (!fromAppField || !relationField) {
      return;
    }

    // Process each row to find content providers
    for (let i = 0; i < series.length; i++) {
      const fromApp = fromAppField.values[i];
      const relation = relationField.values[i];

      if (fromApp && relation === 'extends') {
        contentProviders.add(fromApp);
      }
    }
  });

  return Array.from(contentProviders).sort();
};

// Extract all available content consumers from the data for the multiselect options
export const getAvailableContentConsumers = (data: PanelData | DataFrame[]): string[] => {
  const series = Array.isArray(data) ? data : data.series;

  if (!series.length) {
    return [];
  }

  const contentConsumers = new Set<string>();

  series.forEach((series) => {
    if (!series.fields || series.fields.length === 0) {
      return;
    }

    const toAppField = series.fields.find((field) => field.name === 'to_app');
    const relationField = series.fields.find((field) => field.name === 'relation');

    if (!toAppField || !relationField) {
      return;
    }

    for (let i = 0; i < series.length; i++) {
      const toApp = toAppField.values[i];
      const relation = relationField.values[i];

      if (toApp && relation === 'extends') {
        // Convert "grafana" to "grafana-core" for consistency
        const definingPlugin = toApp === 'grafana' ? 'grafana-core' : toApp;
        contentConsumers.add(definingPlugin);
      }
    }
  });

  return Array.from(contentConsumers).sort();
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
      id: 'landing-page/nav-id-observability/v1',
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
  showDependencyTypes: true,
  layoutType: 'hierarchical',

  // Filtering options
  selectedContentProviders: [], // Empty array means all providers are selected
  selectedContentConsumers: [], // Empty array means all consumers are selected
});
