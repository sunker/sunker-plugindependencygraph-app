import { GraphData, PanelOptions, PluginNode } from '../types';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';

interface DependencyGraphProps {
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

interface NodeWithPosition extends PluginNode {
  x: number;
  y: number;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ data, options, width, height }) => {
  const theme = useTheme2();
  const [nodes, setNodes] = useState<NodeWithPosition[]>([]);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const styles = getStyles(theme, options);

  // Simple force-directed layout algorithm
  const calculateLayout = useMemo(() => {
    if (!data.nodes.length) {
      return [];
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const nodeCount = data.nodes.length;

    return data.nodes.map((node, index) => {
      let x: number, y: number;

      switch (options.layoutType) {
        case 'circular':
          const angle = (2 * Math.PI * index) / nodeCount;
          const radius = Math.min(width, height) * 0.3;
          x = centerX + radius * Math.cos(angle);
          y = centerY + radius * Math.sin(angle);
          break;

        case 'hierarchical':
          // Arrange by plugin type in layers
          const typeOrder = ['app', 'datasource', 'panel'];
          let typeIndex = typeOrder.indexOf(node.type);
          if (typeIndex === -1) {
            typeIndex = typeOrder.length;
          }

          const nodesOfType = data.nodes.filter((n) => n.type === node.type);
          const indexInType = nodesOfType.indexOf(node);

          y = (height / (typeOrder.length + 1)) * (typeIndex + 1);
          x = (width / (nodesOfType.length + 1)) * (indexInType + 1);
          break;

        case 'force':
        default:
          // Simple grid layout as starting point for force simulation
          const cols = Math.ceil(Math.sqrt(nodeCount));
          const rows = Math.ceil(nodeCount / cols);
          const cellWidth = width / cols;
          const cellHeight = height / rows;

          x = (index % cols) * cellWidth + cellWidth / 2;
          y = Math.floor(index / cols) * cellHeight + cellHeight / 2;
          break;
      }

      return {
        ...node,
        x: Math.max(options.nodeSize, Math.min(width - options.nodeSize, x)),
        y: Math.max(options.nodeSize, Math.min(height - options.nodeSize, y)),
      };
    });
  }, [data.nodes, width, height, options.layoutType, options.nodeSize]);

  useEffect(() => {
    setNodes(calculateLayout);
  }, [calculateLayout]);

  const handleMouseDown = (nodeId: string, event: React.MouseEvent) => {
    if (!options.enableDrag) {
      return;
    }

    event.preventDefault();
    setIsDragging(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setDragOffset({
        x: event.clientX - node.x,
        y: event.clientY - node.y,
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !options.enableDrag) {
      return;
    }

    const newX = event.clientX - dragOffset.x;
    const newY = event.clientY - dragOffset.y;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === isDragging
          ? {
              ...node,
              x: Math.max(options.nodeSize, Math.min(width - options.nodeSize, newX)),
              y: Math.max(options.nodeSize, Math.min(height - options.nodeSize, newY)),
            }
          : node
      )
    );
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const getNodeColor = (type: PluginNode['type']) => {
    return options.nodeColors[type] || theme.colors.primary.main;
  };

  const renderArrowMarker = () => (
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill={theme.colors.text.secondary} />
      </marker>
    </defs>
  );

  const renderDependencyLinks = () => {
    return data.dependencies.map((dep, index) => {
      const sourceNode = nodes.find((n) => n.id === dep.source);
      const targetNode = nodes.find((n) => n.id === dep.target);

      if (!sourceNode || !targetNode) {
        return null;
      }

      // Calculate arrow position accounting for node radius
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const unitX = dx / length;
      const unitY = dy / length;

      const startX = sourceNode.x + unitX * options.nodeSize;
      const startY = sourceNode.y + unitY * options.nodeSize;
      const endX = targetNode.x - unitX * options.nodeSize;
      const endY = targetNode.y - unitY * options.nodeSize;

      return (
        <g key={`${dep.source}-${dep.target}-${index}`}>
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={theme.colors.text.secondary}
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
            className={styles.link}
          />
          {options.showDependencyTypes && (
            <text
              x={(startX + endX) / 2}
              y={(startY + endY) / 2 - 5}
              textAnchor="middle"
              className={styles.linkLabel}
              fill={theme.colors.text.secondary}
            >
              {dep.type}
            </text>
          )}
        </g>
      );
    });
  };

  const renderNodes = () => {
    return nodes.map((node) => (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onMouseDown={(e) => handleMouseDown(node.id, e)}
        style={{ cursor: options.enableDrag ? 'grab' : 'default' }}
        className={styles.node}
      >
        <circle
          r={options.nodeSize}
          fill={getNodeColor(node.type)}
          stroke={theme.colors.border.strong}
          strokeWidth={2}
          className={styles.nodeCircle}
        />
        {options.showLabels && (
          <>
            <text
              textAnchor="middle"
              dy={4}
              className={styles.nodeLabel}
              fill={theme.colors.getContrastText(getNodeColor(node.type))}
            >
              {node.name}
            </text>
            <text
              textAnchor="middle"
              dy={options.nodeSize + 15}
              className={styles.nodeType}
              fill={theme.colors.text.secondary}
            >
              {node.type}
            </text>
          </>
        )}
      </g>
    ));
  };

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
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={styles.svg}
      >
        {renderArrowMarker()}
        {renderDependencyLinks()}
        {renderNodes()}
      </svg>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, options: PanelOptions) => {
  return {
    container: css`
      width: 100%;
      height: 100%;
      background: ${theme.colors.background.primary};
      border-radius: ${theme.shape.radius.default};
      overflow: hidden;
    `,
    svg: css`
      width: 100%;
      height: 100%;
      cursor: ${options.enableDrag ? 'grab' : 'default'};

      &:active {
        cursor: ${options.enableDrag ? 'grabbing' : 'default'};
      }
    `,
    node: css`
      transition: all 0.2s ease;

      &:hover {
        filter: brightness(1.1);
      }
    `,
    nodeCircle: css`
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    `,
    nodeLabel: css`
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      user-select: none;
    `,
    nodeType: css`
      font-size: 10px;
      font-weight: 400;
      pointer-events: none;
      user-select: none;
    `,
    link: css`
      transition: stroke-width 0.2s ease;

      &:hover {
        stroke-width: 3;
      }
    `,
    linkLabel: css`
      font-size: 10px;
      font-weight: 400;
      pointer-events: none;
      user-select: none;
      background: ${theme.colors.background.primary};
    `,
    emptyState: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${theme.colors.text.secondary};
      text-align: center;

      p {
        margin: 0.5rem 0;
      }
    `,
  };
};
