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
  const [selectedExtensionPoint, setSelectedExtensionPoint] = useState<string | null>(null);

  const styles = getStyles(theme, options);

  // Extension points layout: Content Providers on left, Extension Points on right
  const calculateLayout = useMemo(() => {
    if (!data.nodes.length || !data.extensionPoints) {
      return [];
    }

    // Identify content providers (apps that provide content to extension points)
    const contentProviders = new Set<string>();
    data.dependencies.forEach((dep) => {
      // If the target is an extension point ID (check if it exists in extensionPoints)
      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === dep.target);
      if (extensionPoint) {
        contentProviders.add(dep.source);
      }
    });

    const providerNodes = data.nodes.filter((node) => contentProviders.has(node.id));
    const margin = 80;
    const nodeSpacing = 100;

    // Extension points layout: Providers on left, Extension Points on right
    const result: NodeWithPosition[] = [];

    // Place content provider apps on the left
    const providerStartY = margin + 35; // Align with first extension point box (accounting for group header)
    providerNodes.forEach((node, index) => {
      result.push({
        ...node,
        x: margin + 100, // Give more space for app boxes
        y: providerStartY + index * nodeSpacing,
      });
    });

    return result;
  }, [data.nodes, data.dependencies, data.extensionPoints]);

  useEffect(() => {
    setNodes(calculateLayout);
  }, [calculateLayout]);

  const handleMouseDown = (nodeId: string, event: React.MouseEvent) => {
    // Drag is always enabled
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
    if (!isDragging) {
      return;
    }

    const newX = event.clientX - dragOffset.x;
    const newY = event.clientY - dragOffset.y;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === isDragging
          ? {
              ...node,
              x: Math.max(50, Math.min(width - 50, newX)),
              y: Math.max(50, Math.min(height - 50, newY)),
            }
          : node
      )
    );
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const renderArrowMarker = () => (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="6"
        markerHeight="5"
        refX="5"
        refY="2.5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <polygon
          points="0 0, 6 2.5, 0 5"
          fill={theme.colors.primary.main}
          stroke={theme.colors.primary.main}
          strokeWidth="1"
        />
      </marker>
      <marker
        id="arrowhead-highlighted"
        markerWidth="6"
        markerHeight="5"
        refX="5"
        refY="2.5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <polygon
          points="0 0, 6 2.5, 0 5"
          fill={theme.colors.success.main}
          stroke={theme.colors.success.main}
          strokeWidth="1"
        />
      </marker>
    </defs>
  );

  // Calculate extension point positions
  const getExtensionPointPositions = () => {
    if (!data.extensionPoints) {
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
    const extensionPointSpacing = 65; // Decreased spacing between extension point boxes
    const groupSpacing = 40; // Much smaller distance between plugin groups
    const rightSideX = width - margin - 450; // Position on right side, adjusted for wider boxes

    let currentGroupY = margin - 5; // Very close to content consumer header

    Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, extensionPointIds]) => {
      const groupHeight = extensionPointIds.length * extensionPointSpacing + 70; // Extra space for group header

      extensionPointIds.forEach((epId, index) => {
        positions.set(epId, {
          x: rightSideX,
          y: currentGroupY + 60 + index * extensionPointSpacing, // 60px offset for group header
          groupY: currentGroupY,
          groupHeight: groupHeight,
        });
      });

      currentGroupY += groupHeight + groupSpacing;
    });

    return positions;
  };

  const extensionPointPositions = getExtensionPointPositions();

  // Calculate the total height needed for all content
  const calculateContentHeight = () => {
    if (!data.extensionPoints || data.extensionPoints.length === 0) {
      return height; // Use panel height as minimum
    }

    // Group extension points by their defining plugin to calculate total height
    const extensionPointGroups = new Map<string, string[]>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, []);
      }
      extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
    });

    const margin = 80;
    const extensionPointSpacing = 65;
    const groupSpacing = 40;
    let totalHeight = margin + 80; // Start with margin + header space

    Array.from(extensionPointGroups.entries()).forEach(([_, extensionPointIds]) => {
      const groupHeight = extensionPointIds.length * extensionPointSpacing + 70;
      totalHeight += groupHeight + groupSpacing;
    });

    return Math.max(totalHeight, height); // Use at least the panel height
  };

  const contentHeight = calculateContentHeight();

  const renderDependencyLinks = () => {
    // Group dependencies by source and defining plugin to consolidate arrows
    const groupedDeps = new Map<string, Map<string, string[]>>();

    data.dependencies.forEach((dep) => {
      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === dep.target);
      if (!extensionPoint) {
        return;
      }

      const sourceId = dep.source;
      const definingPlugin = extensionPoint.definingPlugin;

      if (!groupedDeps.has(sourceId)) {
        groupedDeps.set(sourceId, new Map());
      }
      if (!groupedDeps.get(sourceId)!.has(definingPlugin)) {
        groupedDeps.get(sourceId)!.set(definingPlugin, []);
      }
      groupedDeps.get(sourceId)!.get(definingPlugin)!.push(dep.target);
    });

    const arrows: React.JSX.Element[] = [];
    let arrowIndex = 0;

    groupedDeps.forEach((definingPluginMap, sourceId) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) {
        return;
      }

      definingPluginMap.forEach((extensionPointIds, definingPlugin) => {
        // Find the center position of this defining plugin group
        const firstExtensionId = extensionPointIds[0];
        const firstExtensionPos = extensionPointPositions.get(firstExtensionId);
        if (!firstExtensionPos) {
          return;
        }

        // Calculate group center
        const groupCenterX = firstExtensionPos.x - 30 + (320 + 20) / 2; // Center of the group box (updated for new width)
        const groupCenterY = firstExtensionPos.groupY + firstExtensionPos.groupHeight / 2;

        const nodeWidth = 220;
        const startX = sourceNode.x + nodeWidth / 2;
        const startY = sourceNode.y;
        const endX = groupCenterX - 180; // Point to left edge of group (adjusted for new width)
        const endY = groupCenterY;

        // Calculate control points for a curved path
        const midX = (startX + endX) / 2;
        const controlX1 = startX + (midX - startX) * 0.6;
        const controlX2 = endX - (endX - midX) * 0.6;

        const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

        // Check if this arrow points to the selected extension point
        const isHighlighted = selectedExtensionPoint ? extensionPointIds.includes(selectedExtensionPoint) : false;

        arrows.push(
          <g key={`${sourceId}-${definingPlugin}-${arrowIndex}`}>
            {/* Connection path */}
            <path
              d={pathData}
              fill="none"
              stroke={isHighlighted ? theme.colors.success.main : theme.colors.primary.main}
              strokeWidth={isHighlighted ? 4 : 3}
              markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
              className={isHighlighted ? styles.linkHighlighted : styles.link}
              opacity={selectedExtensionPoint && !isHighlighted ? 0.3 : 1}
            />
          </g>
        );

        arrowIndex++;
      });
    });

    return arrows;
  };

  const renderNodes = () => {
    // Render content provider apps on the left
    const contentProviders = new Set<string>();
    data.dependencies.forEach((dep) => {
      if (data.extensionPoints?.some((ep) => ep.id === dep.target)) {
        // Check if target is an actual extension point
        contentProviders.add(dep.source);
      }
    });

    return nodes
      .filter((node) => contentProviders.has(node.id))
      .map((node) => {
        const nodeWidth = 220;
        const nodeHeight = 60;

        return (
          <g
            key={node.id}
            transform={`translate(${node.x - nodeWidth / 2}, ${node.y - nodeHeight / 2})`}
            onMouseDown={(e) => handleMouseDown(node.id, e)}
            style={{ cursor: 'grab' }}
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
              y={nodeHeight / 2}
              textAnchor="middle"
              className={styles.appIdLabel}
              fill={theme.colors.getContrastText(theme.colors.primary.main)}
            >
              {node.id}
            </text>
          </g>
        );
      });
  };

  const renderSectionHeaders = () => {
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

        {/* Dashed line under Content Provider header */}
        <line
          x1={margin}
          y1={40}
          x2={margin + 200}
          y2={40}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />

        {/* Content Consumer Header */}
        <text
          x={width - margin - 225}
          y={30}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          Content Consumer
        </text>

        {/* Dashed line under Content Consumer header */}
        <line
          x1={width - margin - 450}
          y1={40}
          x2={width - margin}
          y2={40}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />
      </g>
    );
  };

  const renderExtensionPoints = () => {
    if (!data.extensionPoints) {
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
        return 'grafana core';
      }
      // Return the plugin ID as-is for consistency with the diagram
      return pluginId;
    };

    const getExtensionDisplayName = (extensionId: string) => {
      // Return the full extension ID for clarity
      return extensionId;
    };

    return Array.from(extensionPointGroups.entries()).map(([definingPlugin, extensionPointIds]) => {
      const firstEpPos = extensionPointPositions.get(extensionPointIds[0]);
      if (!firstEpPos) {
        return null;
      }

      const groupWidth = 450; // Further increased width for longer extension IDs
      const groupHeight = firstEpPos.groupHeight;
      const extensionBoxWidth = 410; // Further increased width for full extension IDs
      const extensionBoxHeight = options.showDependencyTypes ? 60 : 40; // Adjust height based on whether we show type info

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

          {/* Extension points */}
          {extensionPointIds.map((epId) => {
            const epPos = extensionPointPositions.get(epId);
            if (!epPos) {
              return null;
            }

            // Get extension point details for type-specific styling
            const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
            const extensionType = extensionPoint?.extensionType || 'link';

            // Get color based on extension type
            const getExtensionColor = (type: string) => {
              switch (type) {
                case 'component':
                  return options.componentExtensionColor || theme.colors.warning.main;
                case 'function':
                  return options.functionExtensionColor || theme.colors.error.main;
                case 'link':
                default:
                  return options.linkExtensionColor || theme.colors.success.main;
              }
            };

            const extensionColor = getExtensionColor(extensionType);

            return (
              <g key={epId}>
                {/* Extension point box with type-specific color */}
                <rect
                  x={epPos.x}
                  y={epPos.y - extensionBoxHeight / 2}
                  width={extensionBoxWidth}
                  height={extensionBoxHeight}
                  fill={extensionColor}
                  stroke={selectedExtensionPoint === epId ? theme.colors.primary.border : theme.colors.border.strong}
                  strokeWidth={selectedExtensionPoint === epId ? 3 : 2}
                  rx={6}
                  className={styles.extensionPointBox}
                  onClick={() => {
                    setSelectedExtensionPoint(selectedExtensionPoint === epId ? null : epId);
                  }}
                  style={{ cursor: 'pointer' }}
                />

                {/* Extension point ID - first line */}
                <text
                  x={epPos.x + extensionBoxWidth / 2}
                  y={options.showDependencyTypes ? epPos.y - 5 : epPos.y + 5}
                  textAnchor="middle"
                  className={styles.extensionPointLabel}
                  fill={theme.colors.getContrastText(extensionColor)}
                >
                  {getExtensionDisplayName(epId)}
                </text>

                {/* Extension type - second line in parentheses */}
                {options.showDependencyTypes && (
                  <text
                    x={epPos.x + extensionBoxWidth / 2}
                    y={epPos.y + 15}
                    textAnchor="middle"
                    className={styles.extensionTypeBadge}
                    fill={theme.colors.getContrastText(extensionColor)}
                  >
                    ({extensionType} extension)
                  </text>
                )}
              </g>
            );
          })}

          {/* Defining plugin name header - aligned with extension point boxes */}
          <text
            x={firstEpPos.x}
            y={firstEpPos.groupY + 22}
            textAnchor="start"
            className={styles.definingPluginLabel}
            fill={theme.colors.text.primary}
          >
            {getDisplayName(definingPlugin)}
          </text>
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
        height={contentHeight}
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
      overflow: auto;
    `,
    svg: css`
      width: 100%;
      min-height: 100%;
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    `,
    node: css`
      transition: filter 0.2s ease;

      &:hover {
        filter: brightness(1.05);
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
    linkHighlighted: css`
      transition: all 0.2s ease;

      &:hover {
        stroke-width: 5;
        filter: brightness(1.1);
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
      transition: filter 0.2s ease;

      &:hover {
        filter: brightness(1.05);
      }
    `,
    definingPluginLabel: css`
      font-size: 14px;
      font-weight: 700;
      pointer-events: none;
      user-select: none;
    `,
    extensionPointLabel: css`
      font-size: 12px;
      font-weight: 600;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      pointer-events: none;
      user-select: none;
    `,
    extensionTypeBadge: css`
      font-size: 10px;
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
