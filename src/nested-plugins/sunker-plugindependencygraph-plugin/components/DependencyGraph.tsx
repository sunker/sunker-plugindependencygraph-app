import { GraphData, PanelOptions } from '../types';
import {
  NodeWithPosition,
  calculateContentHeight,
  calculateLayout,
  getExposedComponentPositions,
  getExtensionPointPositions,
} from './GraphLayout';
import React, { useEffect, useMemo, useState } from 'react';

import { ArrowMarkers } from './ArrowMarkers';
import { ExtensionRenderer } from './ExtensionRenderer';
import { HeaderRenderer } from './HeaderRenderer';
import { LinkRenderer } from './LinkRenderer';
import { NodeRenderer } from './NodeRenderer';
import { getGraphStyles } from './GraphStyles';
import { useTheme2 } from '@grafana/ui';

interface DependencyGraphProps {
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ data, options, width, height }) => {
  const theme = useTheme2();
  const [nodes, setNodes] = useState<NodeWithPosition[]>([]);
  const [selectedExtensionPoint, setSelectedExtensionPoint] = useState<string | null>(null);
  const [selectedExposedComponent, setSelectedExposedComponent] = useState<string | null>(null);
  const [selectedContentConsumer, setSelectedContentConsumer] = useState<string | null>(null);

  const isExposeMode = options.visualizationMode === 'expose';
  const styles = getGraphStyles(theme);

  // Memoized layout calculation
  const layoutNodes = useMemo(() => calculateLayout(data, options, width, height), [data, options, width, height]);

  // Memoized position calculations
  const extensionPointPositions = useMemo(
    () => getExtensionPointPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const exposedComponentPositions = useMemo(
    () => getExposedComponentPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const contentHeight = useMemo(
    () => calculateContentHeight(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes]);

  // Event handlers
  const handleExtensionPointClick = (id: string | null) => {
    setSelectedExtensionPoint(selectedExtensionPoint === id ? null : id);
  };

  const handleExposedComponentClick = (id: string | null) => {
    setSelectedExposedComponent(selectedExposedComponent === id ? null : id);
    // Clear consumer selection when selecting an exposed component
    if (id !== null && selectedContentConsumer !== null) {
      setSelectedContentConsumer(null);
    }
  };

  const handleContentConsumerClick = (id: string | null) => {
    setSelectedContentConsumer(selectedContentConsumer === id ? null : id);
    // Clear exposed component selection when selecting a consumer
    if (id !== null && selectedExposedComponent !== null) {
      setSelectedExposedComponent(null);
    }
  };

  // Empty state check
  if (!data.nodes.length) {
    return (
      <div className={styles.emptyState}>
        <p>No plugin dependency data available</p>
        <p>Configure your data source to provide plugin relationships</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <svg width={width} height={contentHeight} className={styles.svg}>
        <ArrowMarkers theme={theme} />

        <HeaderRenderer theme={theme} width={width} isExposeMode={isExposeMode} styles={styles} />

        <NodeRenderer
          theme={theme}
          nodes={nodes}
          data={data}
          width={width}
          height={height}
          isExposeMode={isExposeMode}
          selectedContentConsumer={selectedContentConsumer}
          onContentConsumerClick={handleContentConsumerClick}
          styles={styles}
        />

        <ExtensionRenderer
          theme={theme}
          data={data}
          options={options}
          width={width}
          height={height}
          isExposeMode={isExposeMode}
          extensionPointPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          selectedExtensionPoint={selectedExtensionPoint}
          selectedExposedComponent={selectedExposedComponent}
          onExtensionPointClick={handleExtensionPointClick}
          onExposedComponentClick={handleExposedComponentClick}
          styles={styles}
        />

        <LinkRenderer
          theme={theme}
          data={data}
          nodes={nodes}
          extensionPointPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          width={width}
          isExposeMode={isExposeMode}
          selectedExtensionPoint={selectedExtensionPoint}
          selectedExposedComponent={selectedExposedComponent}
          selectedContentConsumer={selectedContentConsumer}
          styles={styles}
        />
      </svg>
    </div>
  );
};
