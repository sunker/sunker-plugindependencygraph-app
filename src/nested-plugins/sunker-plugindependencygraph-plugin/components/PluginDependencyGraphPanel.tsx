import { PanelOptions } from '../types';
import { PanelProps } from '@grafana/data';
import React from 'react';

interface Props extends PanelProps<PanelOptions> {}

export const PluginDependencyGraphPanel: React.FC<Props> = ({ options, data, width, height }) => {
  return (
    <div
      style={{
        width: width,
        height: height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #ccc',
        borderRadius: '4px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h3>Plugin Dependency Graph Panel</h3>
        <p>Empty panel - ready for implementation</p>
      </div>
    </div>
  );
};
