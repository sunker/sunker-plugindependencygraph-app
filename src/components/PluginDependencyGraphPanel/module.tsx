import { PanelOptions } from './types';
import { PanelPlugin } from '@grafana/data';
import { PluginDependencyGraphPanel } from './PluginDependencyGraphPanel';

export const plugin = new PanelPlugin<PanelOptions>(PluginDependencyGraphPanel);
