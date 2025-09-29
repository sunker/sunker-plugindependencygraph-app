# Plugin Dependency Graph Panel

A Grafana panel plugin that visualizes dependencies between Grafana plugins, specifically focusing on extension relationships where one plugin extends another.

## Features

- **Extension Relationship Visualization**: Displays provider-consumer relationships between plugins
- **Interactive Graph**: Drag nodes, multiple layout options (force-directed, hierarchical, circular)
- **Customizable Appearance**: Configure node sizes, colors, and labels
- **Real-time Data Processing**: Processes Grafana table data to create dependency graphs
- **Sample Data**: Includes sample data for testing when no data source is available

## Data Format

The panel expects table data with the following structure:

| Field Name | Type   | Description                                       |
| ---------- | ------ | ------------------------------------------------- |
| `from_app` | string | Plugin ID that extends another (consumer)         |
| `to_app`   | string | Plugin ID being extended (provider)               |
| `relation` | string | Type of relationship ("extends", "depends_on")    |
| `evidence` | string | Optional evidence/description of the relationship |

### Example Data

```json
{
  "from_app": ["grafana-extensionexample1-app", "grafana-extensionexample2-app"],
  "relation": ["extends", "extends"],
  "to_app": ["grafana-extensionstest-app", "grafana-extensionstest-app"],
  "evidence": [
    "plugins/grafana-extensionstest-app/actions",
    "plugins/grafana-extensionstest-app/configure-extension-component/v1"
  ]
}
```

## Panel Configuration

### Visualization Options

- **Node Size**: Size of plugin nodes (10-100px)
- **Link Distance**: Distance between connected nodes (50-300px)
- **Node Repulsion**: Force that pushes nodes apart (-500 to -50)
- **Show Labels**: Display plugin names and types
- **Show Dependency Types**: Display relationship types on connections
- **Layout Type**: Choose between force-directed, hierarchical, or circular layouts
- **Enable Drag**: Allow repositioning nodes by dragging
- **Enable Zoom**: Allow zooming and panning (future feature)

### Color Options

- **App Plugin Color**: Color for app-type plugins (default: blue)
- **Panel Plugin Color**: Color for panel-type plugins (default: orange)
- **Data Source Plugin Color**: Color for datasource-type plugins (default: green)

### Data Mapping

Configure which columns contain the required data:

- **Source Column**: Column with extending plugin ID (default: `from_app`)
- **Target Column**: Column with extended plugin ID (default: `to_app`)
- **Relation Type Column**: Column with relationship type (default: `relation`)
- **Plugin Name Column**: Column with display names (default: `from_app`)
- **Plugin Type Column**: Column with plugin types (default: `plugin_type`)

## Usage

1. **Add Panel**: Add a new panel to your dashboard and select "Plugin Dependency Graph"

2. **Configure Data Source**: Set up a data source that returns plugin relationship data in the expected format

3. **Test with Sample Data**: If no data source is available, the panel will automatically show sample data demonstrating extension relationships

4. **Customize Appearance**: Use the panel options to adjust colors, layout, and visualization preferences

5. **Interact with Graph**:
   - Drag nodes to reposition them (if enabled)
   - Hover over connections to see relationship details
   - View plugin names and types as labels

## Extension Relationships

The panel focuses on "extends" relationships where:

- **Provider**: The plugin being extended (appears as source with arrow pointing out)
- **Consumer**: The plugin doing the extending (appears as target receiving the arrow)

For example: If "Extension Example App" extends "Extensions Test App", the graph shows an arrow from "Extensions Test App" → "Extension Example App", indicating that the test app provides functionality that the example app consumes.

## Development

The panel is built with:

- React and TypeScript
- SVG-based visualization (custom implementation)
- Grafana plugin SDK
- CSS-in-JS styling with Emotion

### Key Components

- `PluginDependencyGraphPanel`: Main panel component
- `DependencyGraph`: SVG visualization component
- `dataProcessor`: Transforms Grafana table data into graph format
- `types`: TypeScript interfaces for data structures
