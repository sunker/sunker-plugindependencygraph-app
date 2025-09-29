import React, { useMemo } from 'react';
import { getDefaultOptions, processTableDataToGraph } from '../utils/dataProcessor';

import { DependencyGraph } from './DependencyGraph';
import { PanelOptions } from '../types';
import { PanelProps } from '@grafana/data';

interface Props extends PanelProps<PanelOptions> {}

export const PluginDependencyGraphPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  timeZone,
}) => {
  // Merge user options with defaults
  const mergedOptions = useMemo(
    () => ({
      ...getDefaultOptions(),
      ...options,
    }),
    [options]
  );

  // Process the data into graph format
  const graphData = useMemo(() => {
    return processTableDataToGraph(data, mergedOptions);
  }, [data, mergedOptions]);

  return <DependencyGraph data={graphData} options={mergedOptions} width={width} height={height} />;
};
