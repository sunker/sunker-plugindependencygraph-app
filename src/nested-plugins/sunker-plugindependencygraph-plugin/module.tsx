import { PanelPlugin, StandardEditorProps } from '@grafana/data';

import { MultiSelect } from '@grafana/ui';
import { PanelOptions } from './types';
import { PluginDependencyGraphPanel } from './components/PluginDependencyGraphPanel';
import React from 'react';
import { getAvailableContentProviders } from './utils/dataProcessor';

// Custom multiselect editor for content providers
const ContentProviderMultiSelect: React.FC<StandardEditorProps<string[]>> = ({ value, onChange, context }) => {
  const availableProviders = getAvailableContentProviders(context.data);

  const options = availableProviders.map((provider) => ({
    label: provider,
    value: provider,
  }));

  // If no value is set (empty array) or value is not defined, default to all providers selected
  const selectedValues = !value || value.length === 0 ? availableProviders : value;

  return (
    <MultiSelect
      options={options}
      value={selectedValues}
      onChange={(selected) => {
        // Extract values from SelectableValue objects
        const selectedValues = selected.map((item) => item.value).filter(Boolean) as string[];
        // If all providers are selected, store empty array to indicate "show all"
        const newValue = selectedValues.length === availableProviders.length ? [] : selectedValues;
        onChange(newValue);
      }}
      placeholder="Select content providers to display"
    />
  );
};

export const plugin = new PanelPlugin<PanelOptions>(PluginDependencyGraphPanel).setPanelOptions((builder) => {
  return (
    builder
      .addBooleanSwitch({
        path: 'showDependencyTypes',
        name: 'Show Dependency Types',
        description: 'Display the type of dependency on links',
        defaultValue: true,
      })

      // Filtering options
      .addCustomEditor({
        id: 'contentProviderFilter',
        path: 'selectedContentProviders',
        name: 'Content Providers',
        description: 'Select which content provider apps to display',
        editor: ContentProviderMultiSelect,
        category: ['Filtering'],
      })
  );
});
