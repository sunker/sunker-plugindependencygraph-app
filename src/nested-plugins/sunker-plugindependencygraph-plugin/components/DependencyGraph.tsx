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

  // Extension points layout: Content Providers on left, Extension Points on right
  const calculateLayout = useMemo(() => {
    if (!data.nodes.length || !data.extensionPoints) {
      return [];
    }

    // Identify content providers (apps that provide content to extension points)
    const contentProviders = new Set<string>();
    data.dependencies.forEach((dep) => {
      // If the target is an extension point ID (starts with "plugins/")
      if (dep.target.startsWith('plugins/')) {
        contentProviders.add(dep.source);
      }
    });

    const providerNodes = data.nodes.filter((node) => contentProviders.has(node.id));
    const margin = 80;
    const nodeSpacing = 100;

    switch (options.layoutType) {
      case 'circular':
        // Circular layout for all nodes
        const totalNodes = data.nodes.length;
        const centerX = width / 2;
        const centerY = height / 2;

        return data.nodes.map((node, index) => {
          const angle = (2 * Math.PI * index) / totalNodes;
          const radius = Math.min(width, height) * 0.3;
          return {
            ...node,
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          };
        });

      case 'hierarchical':
      default:
        // Extension points layout: Providers on left, Extension Points on right
        const result: NodeWithPosition[] = [];

        // Place content provider apps on the left
        const providerStartY = Math.max(margin + 50, (height - providerNodes.length * nodeSpacing) / 2);
        providerNodes.forEach((node, index) => {
          result.push({
            ...node,
            x: margin + 100, // Give more space for app boxes
            y: providerStartY + index * nodeSpacing,
          });
        });

        return result;

      case 'force':
        // Grid layout
        const nodeCount = data.nodes.length;
        const cols = Math.ceil(Math.sqrt(nodeCount));
        const rows = Math.ceil(nodeCount / cols);
        const cellWidth = width / cols;
        const cellHeight = height / rows;

        return data.nodes.map((node, index) => ({
          ...node,
          x: (index % cols) * cellWidth + cellWidth / 2,
          y: Math.floor(index / cols) * cellHeight + cellHeight / 2,
        }));
    }
  }, [data.nodes, data.dependencies, data.extensionPoints, width, height, options.layoutType]);

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
      <marker
        id="arrowhead"
        markerWidth="12"
        markerHeight="10"
        refX="11"
        refY="5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <polygon
          points="0 0, 12 5, 0 10"
          fill={theme.colors.primary.main}
          stroke={theme.colors.primary.main}
          strokeWidth="1"
        />
      </marker>
    </defs>
  );

  // Calculate extension point positions
  const getExtensionPointPositions = () => {
    if (!data.extensionPoints || options.layoutType !== 'hierarchical') {
      return new Map();
    }

    // Group extension points by their defining plugin
    const extensionPointGroups = new Map<string, string[]>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, []);
      }
      extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
    });

    const positions = new Map<string, { x: number; y: number; groupY: number; groupHeight: number }>();
    const margin = 80;
    const extensionPointSpacing = 40;
    const groupSpacing = 80;
    const rightSideX = width - margin - 200; // Position on right side

    let currentGroupY = margin + 50; // Account for section headers

    Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, extensionPointIds]) => {
      const groupHeight = extensionPointIds.length * extensionPointSpacing + 40; // Extra space for group header

      extensionPointIds.forEach((epId, index) => {
        positions.set(epId, {
          x: rightSideX,
          y: currentGroupY + 30 + index * extensionPointSpacing, // 30px offset for group header
          groupY: currentGroupY,
          groupHeight: groupHeight,
        });
      });

      currentGroupY += groupHeight + groupSpacing;
    });

    return positions;
  };

  const extensionPointPositions = getExtensionPointPositions();

  const renderDependencyLinks = () => {
    return data.dependencies.map((dep, index) => {
      const sourceNode = nodes.find((n) => n.id === dep.source);

      if (!sourceNode) {
        return null;
      }

      // Check if target is an extension point
      const extensionPointPos = extensionPointPositions.get(dep.target);
      if (!extensionPointPos) {
        return null;
      }

      // Calculate connection path from provider to extension point
      const nodeWidth = 180;

      const startX = sourceNode.x + nodeWidth / 2;
      const startY = sourceNode.y;
      const endX = extensionPointPos.x - 10;
      const endY = extensionPointPos.y;

      // Calculate control points for a curved path
      const midX = (startX + endX) / 2;
      const controlX1 = startX + (midX - startX) * 0.6;
      const controlX2 = endX - (endX - midX) * 0.6;

      const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

      return (
        <g key={`${dep.source}-${dep.target}-${index}`}>
          {/* Connection path */}
          <path
            d={pathData}
            fill="none"
            stroke={theme.colors.primary.main}
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
            className={styles.link}
          />

          {/* Connection label */}
          {options.showDependencyTypes && (
            <text
              x={midX}
              y={(startY + endY) / 2 - 8}
              textAnchor="middle"
              className={styles.linkLabel}
              fill={theme.colors.text.secondary}
            >
              provides content
            </text>
          )}
        </g>
      );
    });
  };

  const renderNodes = () => {
    if (options.layoutType !== 'hierarchical') {
      // For non-hierarchical layouts, render nodes normally
      return nodes.map((node, index) => {
        const nodeWidth = 120;
        const nodeHeight = 60;

        return (
          <g
            key={node.id}
            transform={`translate(${node.x - nodeWidth / 2}, ${node.y - nodeHeight / 2})`}
            onMouseDown={(e) => handleMouseDown(node.id, e)}
            style={{ cursor: options.enableDrag ? 'grab' : 'default' }}
            className={styles.node}
          >
            <rect
              width={nodeWidth}
              height={nodeHeight}
              fill={getNodeColor(node.type)}
              stroke={theme.colors.border.strong}
              strokeWidth={2}
              rx={8}
              className={styles.nodeBox}
            />
            {options.showLabels && (
              <text
                x={nodeWidth / 2}
                y={nodeHeight / 2 + 4}
                textAnchor="middle"
                className={styles.nodeLabel}
                fill={theme.colors.getContrastText(getNodeColor(node.type))}
              >
                {node.name}
              </text>
            )}
          </g>
        );
      });
    }

    // For hierarchical layout: render content provider apps on the left
    const contentProviders = new Set<string>();
    data.dependencies.forEach((dep) => {
      if (dep.target.startsWith('plugins/')) {
        contentProviders.add(dep.source);
      }
    });

    return nodes
      .filter((node) => contentProviders.has(node.id))
      .map((node) => {
        const nodeWidth = 180;
        const nodeHeight = 60;

        return (
          <g
            key={node.id}
            transform={`translate(${node.x - nodeWidth / 2}, ${node.y - nodeHeight / 2})`}
            onMouseDown={(e) => handleMouseDown(node.id, e)}
            style={{ cursor: options.enableDrag ? 'grab' : 'default' }}
            className={styles.node}
          >
            {/* Main app box */}
            <rect
              width={nodeWidth}
              height={nodeHeight}
              fill={theme.colors.primary.main}
              stroke={theme.colors.border.strong}
              strokeWidth={2}
              rx={8}
              className={styles.nodeBox}
            />

            {/* App ID label */}
            <text
              x={nodeWidth / 2}
              y={nodeHeight / 2 - 8}
              textAnchor="middle"
              className={styles.appIdLabel}
              fill={theme.colors.getContrastText(theme.colors.primary.main)}
            >
              {node.id}
            </text>

            {/* Role label */}
            <text
              x={nodeWidth / 2}
              y={nodeHeight / 2 + 8}
              textAnchor="middle"
              className={styles.roleLabel}
              fill={theme.colors.getContrastText(theme.colors.primary.main)}
            >
              Content Provider
            </text>
          </g>
        );
      });
  };

  const renderSectionHeaders = () => {
    if (options.layoutType !== 'hierarchical') {
      return null;
    }

    const margin = 80;

    return (
      <g>
        {/* Content Provider Header */}
        <text
          x={margin + 100}
          y={30}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          Content Provider
        </text>

        {/* Content Consumer Header */}
        <text
          x={width - margin - 100}
          y={30}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          Content Consumer
        </text>
      </g>
    );
  };

  const renderExtensionPoints = () => {
    if (options.layoutType !== 'hierarchical' || !data.extensionPoints) {
      return null;
    }

    // Group extension points by their defining plugin
    const extensionPointGroups = new Map<string, string[]>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, []);
      }
      extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
    });

    const getDisplayName = (pluginId: string) => {
      if (pluginId === 'grafana-core') {
        return 'Grafana Core';
      }
      return pluginId
        .replace(/^grafana-/, '')
        .replace(/-app$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const getShortExtensionName = (extensionId: string) => {
      // Extract just the last part: "plugins/grafana-extensionstest-app/actions" -> "actions"
      const parts = extensionId.split('/');
      return parts[parts.length - 1];
    };

    return Array.from(extensionPointGroups.entries()).map(([definingPlugin, extensionPointIds]) => {
      const firstEpPos = extensionPointPositions.get(extensionPointIds[0]);
      if (!firstEpPos) {
        return null;
      }

      const groupWidth = 240;
      const groupHeight = firstEpPos.groupHeight;
      const extensionBoxWidth = 200;
      const extensionBoxHeight = 30;

      return (
        <g key={definingPlugin}>
          {/* Defining plugin group box - make it more prominent */}
          <rect
            x={firstEpPos.x - 30}
            y={firstEpPos.groupY}
            width={groupWidth + 20}
            height={groupHeight}
            fill={theme.colors.background.secondary}
            stroke={theme.colors.border.strong}
            strokeWidth={3}
            rx={12}
            className={styles.extensionGroupBox}
          />

          {/* Defining plugin name header */}
          <text
            x={firstEpPos.x + groupWidth / 2 - 20}
            y={firstEpPos.groupY + 22}
            textAnchor="middle"
            className={styles.definingPluginLabel}
            fill={theme.colors.text.primary}
          >
            {getDisplayName(definingPlugin)}
          </text>

          {/* Extension points */}
          {extensionPointIds.map((epId) => {
            const epPos = extensionPointPositions.get(epId);
            if (!epPos) {
              return null;
            }

            // Get extension point details for type-specific styling
            const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
            const extensionType = extensionPoint?.extensionType || 'link';
            const isComponent = extensionType === 'component';

            return (
              <g key={epId}>
                {/* Extension point box with type-specific color */}
                <rect
                  x={epPos.x}
                  y={epPos.y - extensionBoxHeight / 2}
                  width={extensionBoxWidth}
                  height={extensionBoxHeight}
                  fill={isComponent ? theme.colors.warning.main : theme.colors.success.main}
                  stroke={theme.colors.border.strong}
                  strokeWidth={2}
                  rx={6}
                  className={styles.extensionPointBox}
                />

                {/* Extension type badge */}
                <rect
                  x={epPos.x + 5}
                  y={epPos.y - extensionBoxHeight / 2 + 3}
                  width={60}
                  height={14}
                  fill={theme.colors.background.primary}
                  stroke={theme.colors.border.weak}
                  strokeWidth={1}
                  rx={7}
                />
                <text
                  x={epPos.x + 35}
                  y={epPos.y - extensionBoxHeight / 2 + 13}
                  textAnchor="middle"
                  className={styles.extensionTypeBadge}
                  fill={theme.colors.text.secondary}
                >
                  {extensionType.toUpperCase()}
                </text>

                {/* Extension point ID */}
                <text
                  x={epPos.x + extensionBoxWidth / 2}
                  y={epPos.y + 8}
                  textAnchor="middle"
                  className={styles.extensionPointLabel}
                  fill={theme.colors.getContrastText(
                    isComponent ? theme.colors.warning.main : theme.colors.success.main
                  )}
                >
                  {getShortExtensionName(epId)}
                </text>
              </g>
            );
          })}
        </g>
      );
    });
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
        {renderSectionHeaders()}
        {renderDependencyLinks()}
        {renderNodes()}
        {renderExtensionPoints()}
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
        transform: scale(1.02);
      }
    `,
    nodeBox: css`
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
      transition: all 0.2s ease;
    `,
    nodeLabel: css`
      font-size: 14px;
      font-weight: 600;
      pointer-events: none;
      user-select: none;
    `,
    nodeTypeBadge: css`
      font-size: 8px;
      font-weight: 700;
      pointer-events: none;
      user-select: none;
    `,
    nodeRole: css`
      font-size: 10px;
      font-weight: 500;
      pointer-events: none;
      user-select: none;
    `,
    contentIndicator: css`
      font-size: 8px;
      font-weight: 700;
      pointer-events: none;
      user-select: none;
    `,
    apiLabel: css`
      transition: all 0.2s ease;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    `,
    apiLabelText: css`
      font-size: 10px;
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      pointer-events: none;
      user-select: none;
    `,
    link: css`
      transition: all 0.2s ease;

      &:hover {
        stroke-width: 4;
        filter: brightness(1.2);
      }
    `,
    linkLabel: css`
      font-size: 12px;
      font-weight: 600;
      pointer-events: none;
      user-select: none;
      background: ${theme.colors.background.primary};
    `,
    appIdLabel: css`
      font-size: 12px;
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      pointer-events: none;
      user-select: none;
    `,
    roleLabel: css`
      font-size: 10px;
      font-weight: 500;
      pointer-events: none;
      user-select: none;
    `,
    extensionGroupBox: css`
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
      transition: all 0.2s ease;

      &:hover {
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
      }
    `,
    extensionPointBox: css`
      transition: all 0.2s ease;

      &:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
    `,
    definingPluginLabel: css`
      font-size: 14px;
      font-weight: 700;
      pointer-events: none;
      user-select: none;
    `,
    extensionPointLabel: css`
      font-size: 11px;
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      pointer-events: none;
      user-select: none;
    `,
    extensionTypeBadge: css`
      font-size: 8px;
      font-weight: 700;
      pointer-events: none;
      user-select: none;
    `,
    sectionHeader: css`
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      pointer-events: none;
      user-select: none;
      fill: ${theme.colors.text.primary};
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
