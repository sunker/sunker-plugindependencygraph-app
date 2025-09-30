/**
 * Node Renderer Component
 *
 * Renders plugin nodes (boxes) in the dependency graph.
 */

import { VISUAL_CONSTANTS, getResponsiveNodeHeight, getResponsiveNodeWidth } from '../constants';

import { GrafanaTheme2 } from '@grafana/data';
import { GraphData } from '../types';
import { NodeWithPosition } from './GraphLayout';
import React from 'react';

interface NodeRendererProps {
  theme: GrafanaTheme2;
  nodes: NodeWithPosition[];
  data: GraphData;
  width: number;
  height: number;
  isExposeMode: boolean;
  styles: {
    node: string;
    nodeBox: string;
    appIdLabel: string;
  };
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({
  theme,
  nodes,
  data,
  width,
  height,
  isExposeMode,
  styles,
}) => {
  let nodesToRender: NodeWithPosition[];

  if (isExposeMode) {
    // In expose mode, render all nodes (both providers and consumers)
    nodesToRender = nodes;
  } else {
    // In add mode, render only content provider apps on the left
    const contentProviders = new Set<string>();
    data.dependencies.forEach((dep) => {
      if (data.extensionPoints?.some((ep) => ep.id === dep.target)) {
        // Check if target is an actual extension point
        contentProviders.add(dep.source);
      }
    });
    nodesToRender = nodes.filter((node) => contentProviders.has(node.id));
  }

  const nodeWidth = getResponsiveNodeWidth(width);
  const nodeHeight = getResponsiveNodeHeight(height);

  return (
    <g>
      {nodesToRender.map((node) => (
        <g
          key={node.id}
          transform={`translate(${node.x - nodeWidth / 2}, ${node.y - nodeHeight / 2})`}
          className={styles.node}
        >
          {/* Main app box */}
          <rect
            width={nodeWidth}
            height={nodeHeight}
            fill={theme.colors.primary.main}
            stroke={theme.colors.border.strong}
            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
            rx={VISUAL_CONSTANTS.NODE_BORDER_RADIUS}
            className={styles.nodeBox}
          />

          {/* App ID label */}
          <text
            x={nodeWidth / 2}
            y={nodeHeight / 2}
            textAnchor="middle"
            className={styles.appIdLabel}
            fill={theme.colors.getContrastText(theme.colors.primary.main)}
          >
            {node.originalId || node.id}
          </text>
        </g>
      ))}
    </g>
  );
};
