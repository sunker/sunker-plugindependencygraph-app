import { PanelOptions } from './types';
import { PanelPlugin } from '@grafana/data';
import { PluginDependencyGraphPanel } from './components/PluginDependencyGraphPanel';

export const plugin = new PanelPlugin<PanelOptions>(PluginDependencyGraphPanel).setPanelOptions((builder) => {
  return (
    builder
      .addNumberInput({
        path: 'nodeSize',
        name: 'Node Size',
        description: 'Size of the plugin nodes in pixels',
        defaultValue: 30,
        settings: {
          min: 10,
          max: 100,
        },
      })
      .addNumberInput({
        path: 'linkDistance',
        name: 'Link Distance',
        description: 'Distance between connected nodes',
        defaultValue: 100,
        settings: {
          min: 50,
          max: 300,
        },
      })
      .addNumberInput({
        path: 'charge',
        name: 'Node Repulsion',
        description: 'Force that pushes nodes apart',
        defaultValue: -200,
        settings: {
          min: -500,
          max: -50,
        },
      })
      .addBooleanSwitch({
        path: 'showLabels',
        name: 'Show Labels',
        description: 'Display plugin names and types',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showDependencyTypes',
        name: 'Show Dependency Types',
        description: 'Display the type of dependency on links',
        defaultValue: true,
      })
      .addSelect({
        path: 'layoutType',
        name: 'Layout Type',
        description: 'How to arrange the nodes',
        defaultValue: 'force',
        settings: {
          options: [
            { value: 'force', label: 'Force Directed' },
            { value: 'hierarchical', label: 'Hierarchical' },
            { value: 'circular', label: 'Circular' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'enableDrag',
        name: 'Enable Drag',
        description: 'Allow dragging nodes to reposition them',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'enableZoom',
        name: 'Enable Zoom',
        description: 'Allow zooming and panning the graph',
        defaultValue: true,
      })

      // Color options
      .addColorPicker({
        path: 'nodeColors.app',
        name: 'App Plugin Color',
        description: 'Color for app plugins',
        defaultValue: '#1f77b4',
      })
      .addColorPicker({
        path: 'nodeColors.panel',
        name: 'Panel Plugin Color',
        description: 'Color for panel plugins',
        defaultValue: '#ff7f0e',
      })
      .addColorPicker({
        path: 'nodeColors.datasource',
        name: 'Data Source Plugin Color',
        description: 'Color for datasource plugins',
        defaultValue: '#2ca02c',
      })

      // Data mapping options
      .addTextInput({
        path: 'sourceColumn',
        name: 'Source Column',
        description: 'Column containing the source plugin ID (extends from)',
        defaultValue: 'from_app',
      })
      .addTextInput({
        path: 'targetColumn',
        name: 'Target Column',
        description: 'Column containing the target plugin ID (extends to)',
        defaultValue: 'to_app',
      })
      .addTextInput({
        path: 'typeColumn',
        name: 'Relation Type Column',
        description: 'Column containing the relationship type (extends, depends_on)',
        defaultValue: 'relation',
      })
      .addTextInput({
        path: 'nameColumn',
        name: 'Plugin Name Column',
        description: 'Column containing the plugin display name (fallback to from_app)',
        defaultValue: 'from_app',
      })
      .addTextInput({
        path: 'pluginTypeColumn',
        name: 'Plugin Type Column',
        description: 'Column containing the plugin type (app, panel, datasource)',
        defaultValue: 'plugin_type',
      })
  );
});
