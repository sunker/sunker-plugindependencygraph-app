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
        description: 'Column containing the content provider plugin ID',
        defaultValue: 'from_app',
      })
      .addTextInput({
        path: 'targetColumn',
        name: 'Target Column',
        description: 'Column containing the defining plugin ID',
        defaultValue: 'to_app',
      })
      .addTextInput({
        path: 'typeColumn',
        name: 'Relation Type Column',
        description: 'Column containing the relationship type (extends)',
        defaultValue: 'relation',
      })
      .addTextInput({
        path: 'nameColumn',
        name: 'Extension ID Column',
        description: 'Column containing the extension point ID',
        defaultValue: 'extension_id',
      })
      .addTextInput({
        path: 'pluginTypeColumn',
        name: 'Extension Type Column',
        description: 'Column containing the extension type (link, component)',
        defaultValue: 'extension_type',
      })
  );
});
