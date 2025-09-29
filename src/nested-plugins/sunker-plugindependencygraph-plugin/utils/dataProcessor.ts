import { ExtensionPoint, GraphData, PanelOptions, PluginDependency, PluginNode } from '../types';

import { PanelData } from '@grafana/data';
import pluginData from '../data.json';

export const processPluginDataToGraph = (options: PanelOptions): GraphData => {
  console.log('processPluginDataToGraph - processing data.json:', Object.keys(pluginData).length, 'plugins');

  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  // Process each plugin from data.json
  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content provider (has addedLinks, addedComponents, or addedFunctions)
    const isContentProvider =
      (extensions.addedLinks && extensions.addedLinks.length > 0) ||
      (extensions.addedComponents && extensions.addedComponents.length > 0) ||
      (extensions.addedFunctions && extensions.addedFunctions.length > 0);

    // Check if this plugin is a content consumer (has extensionPoints)
    const isContentConsumer = extensions.extensionPoints && extensions.extensionPoints.length > 0;

    // Add plugin node if it's either a provider or consumer
    if (isContentProvider || isContentConsumer) {
      if (!nodes.has(pluginId)) {
        nodes.set(pluginId, {
          id: pluginId,
          name: getDisplayName(pluginId),
          type: getPluginType(pluginId),
          version: pluginInfo.version,
          description:
            isContentProvider && isContentConsumer
              ? 'Provides and consumes extension content'
              : isContentProvider
              ? 'Provides content to extension points'
              : 'Defines extension points',
        });
      }
    }

    // Process extension points that this plugin defines
    if (isContentConsumer) {
      extensions.extensionPoints.forEach((extensionPoint) => {
        if (!extensionPoints.has(extensionPoint.id)) {
          extensionPoints.set(extensionPoint.id, {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [],
            extensionType: 'link', // Default type, could be enhanced later
          });
        }
      });
    }

    // Process content that this plugin provides
    if (isContentProvider) {
      // Process addedLinks
      extensions.addedLinks?.forEach((link) => {
        link.targets?.forEach((target) => {
          // Create dependency from this plugin to the target extension point
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides link to ${target}`,
          });

          // Find the defining plugin for this target extension point
          const definingPlugin = findDefiningPlugin(target, pluginData);
          if (definingPlugin && !extensionPoints.has(target)) {
            // Create extension point if it doesn't exist
            extensionPoints.set(target, {
              id: target,
              definingPlugin: definingPlugin,
              providers: [],
              extensionType: 'link',
            });
          }

          // Add this plugin as a provider to the extension point
          const extensionPoint = extensionPoints.get(target);
          if (extensionPoint && !extensionPoint.providers.includes(pluginId)) {
            extensionPoint.providers.push(pluginId);
          }
        });
      });

      // Process addedComponents
      extensions.addedComponents?.forEach((component) => {
        component.targets?.forEach((target) => {
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides component to ${target}`,
          });

          const definingPlugin = findDefiningPlugin(target, pluginData);
          if (definingPlugin && !extensionPoints.has(target)) {
            extensionPoints.set(target, {
              id: target,
              definingPlugin: definingPlugin,
              providers: [],
              extensionType: 'component',
            });
          }

          const extensionPoint = extensionPoints.get(target);
          if (extensionPoint && !extensionPoint.providers.includes(pluginId)) {
            extensionPoint.providers.push(pluginId);
          }
        });
      });

      // Process addedFunctions
      extensions.addedFunctions?.forEach((func) => {
        func.targets?.forEach((target) => {
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides function to ${target}`,
          });

          const definingPlugin = findDefiningPlugin(target, pluginData);
          if (definingPlugin && !extensionPoints.has(target)) {
            extensionPoints.set(target, {
              id: target,
              definingPlugin: definingPlugin,
              providers: [],
              extensionType: 'function',
            });
          }

          const extensionPoint = extensionPoints.get(target);
          if (extensionPoint && !extensionPoint.providers.includes(pluginId)) {
            extensionPoint.providers.push(pluginId);
          }
        });
      });
    }
  });

  // Add defining plugin nodes for extension points
  extensionPoints.forEach((extensionPoint) => {
    if (!nodes.has(extensionPoint.definingPlugin)) {
      const definingPlugin = extensionPoint.definingPlugin;
      nodes.set(definingPlugin, {
        id: definingPlugin,
        name: getDisplayName(definingPlugin),
        type: getPluginType(definingPlugin),
        description: 'Defines extension points',
      });
    }
  });

  // Apply filtering logic similar to the original function
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
      .filter((ep) => ep.providers.length > 0);

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
  let consumersToShow: Set<string>;
  if (!options.selectedContentConsumers || options.selectedContentConsumers.length === 0) {
    // Default: show only consumers that have providers extending to them
    const activeConsumers = new Set<string>();
    filteredDependencies.forEach((dep) => {
      const extensionPoint = filteredExtensionPoints.find((ep) => ep.id === dep.target);
      if (extensionPoint) {
        activeConsumers.add(extensionPoint.definingPlugin);
      }
    });
    consumersToShow = activeConsumers;
  } else {
    consumersToShow = new Set(options.selectedContentConsumers);
  }

  // Filter extension points to only include those defined by selected consumers
  filteredExtensionPoints = filteredExtensionPoints.filter((ep) => consumersToShow.has(ep.definingPlugin));

  // Filter dependencies to only include those targeting remaining extension points
  const remainingExtensionPointIds = new Set(filteredExtensionPoints.map((ep) => ep.id));
  filteredDependencies = filteredDependencies.filter((dep) => remainingExtensionPointIds.has(dep.target));

  // Get set of content providers that still have valid dependencies
  const activeContentProviders = new Set(filteredDependencies.map((dep) => dep.source));

  // Filter nodes to only include selected consumers and active content providers
  filteredNodes = filteredNodes.filter((node) => consumersToShow.has(node.id) || activeContentProviders.has(node.id));

  const result = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: filteredExtensionPoints,
  };

  console.log('processPluginDataToGraph - final result:', result);

  return result;
};

// Helper function to find the defining plugin for an extension point target
const findDefiningPlugin = (target: string, pluginData: any): string => {
  // First check if any plugin explicitly defines this extension point
  for (const [pluginId, pluginInfo] of Object.entries(pluginData)) {
    const extensions = (pluginInfo as any).extensions;
    if (extensions.extensionPoints?.some((ep: any) => ep.id === target)) {
      return pluginId;
    }
  }

  // If not found, try to infer from the target ID format
  // Many extension points follow the pattern "pluginId/..." or "grafana/..."
  if (target.startsWith('grafana/')) {
    return 'grafana-core';
  }

  // Try to match plugin ID from the beginning of the target
  const targetParts = target.split('/');
  if (targetParts.length > 0) {
    const potentialPluginId = targetParts[0];
    if (pluginData[potentialPluginId]) {
      return potentialPluginId;
    }

    // Try with -app suffix
    const potentialPluginIdWithApp = `${potentialPluginId}-app`;
    if (pluginData[potentialPluginIdWithApp]) {
      return potentialPluginIdWithApp;
    }
  }

  // Default fallback
  return 'grafana-core';
};

// Helper functions for plugin display and type handling
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

// Keep the original function for backward compatibility, but it now just calls the new one
export const processTableDataToGraph = (data: PanelData, options: PanelOptions): GraphData => {
  console.log('processTableDataToGraph - redirecting to processPluginDataToGraph');
  return processPluginDataToGraph(options);
};

// Update the helper functions to work with data.json
export const getAvailableContentProviders = (): string[] => {
  const contentProviders = new Set<string>();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content provider
    const isContentProvider =
      (extensions.addedLinks && extensions.addedLinks.length > 0) ||
      (extensions.addedComponents && extensions.addedComponents.length > 0) ||
      (extensions.addedFunctions && extensions.addedFunctions.length > 0);

    if (isContentProvider) {
      contentProviders.add(pluginId);
    }
  });

  return Array.from(contentProviders).sort();
};

export const getAvailableContentConsumers = (): string[] => {
  const contentConsumers = new Set<string>();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content consumer (defines extension points)
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      contentConsumers.add(pluginId);
    }
  });

  return Array.from(contentConsumers).sort();
};

export const getActiveContentConsumers = (): string[] => {
  const activeConsumers = new Set<string>();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if any other plugin targets this plugin's extension points
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

      // Check if any other plugin targets these extension points
      const hasProviders = Object.values(pluginData).some((otherPlugin) => {
        const otherExtensions = otherPlugin.extensions;
        return [
          ...(otherExtensions.addedLinks || []),
          ...(otherExtensions.addedComponents || []),
          ...(otherExtensions.addedFunctions || []),
        ].some((item) => item.targets?.some((target: string) => extensionPointIds.includes(target)));
      });

      if (hasProviders) {
        activeConsumers.add(pluginId);
      }
    }
  });

  return Array.from(activeConsumers).sort();
};

// Create sample data for demonstration that matches the new data format
export const createSampleData = (): GraphData => {
  // This will now use the actual data from data.json
  return processPluginDataToGraph(getDefaultOptions());
};

export const getDefaultOptions = (): PanelOptions => ({
  showDependencyTypes: true,
  layoutType: 'hierarchical',

  // Filtering options
  selectedContentProviders: [], // Empty array means all providers are selected
  selectedContentConsumers: [], // Empty array means all consumers are selected

  // Color options for extension types
  linkExtensionColor: '#37872d', // Green for link extensions
  componentExtensionColor: '#ff9900', // Orange for component extensions
  functionExtensionColor: '#e02f44', // Red for function extensions
});
