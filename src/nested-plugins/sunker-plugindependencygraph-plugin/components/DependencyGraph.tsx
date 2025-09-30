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

interface NodeWithPosition extends PluginNode {
  x: number;
  y: number;
  originalId?: string; // For handling multiple instances of same consumer
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ data, options, width, height }) => {
  const theme = useTheme2();
  const [nodes, setNodes] = useState<NodeWithPosition[]>([]);
  const [selectedExtensionPoint, setSelectedExtensionPoint] = useState<string | null>(null);
  const [selectedExposedComponent, setSelectedExposedComponent] = useState<string | null>(null);

  const isExposeMode = options.visualizationMode === 'expose';

  const styles = getStyles(theme, options);

  // Layout calculation for both add and expose modes
  const calculateLayout = useMemo(() => {
    if (!data.nodes.length) {
      return [];
    }

    // Responsive spacing - much tighter margins to use more space
    const margin = Math.max(20, width * 0.02); // Min 20px, or 2% of width
    const nodeSpacing = Math.max(70, height * 0.08); // Min 70px, or 8% of height
    const result: NodeWithPosition[] = [];

    if (isExposeMode) {
      // Expose mode layout: Content providers (exposing components) on left, consumers on right
      const contentProviders = new Set<string>();
      const contentConsumers = new Set<string>();

      // In expose mode, identify providers and consumers based on the actual data
      // Providers are plugins that expose components
      if (data.exposedComponents) {
        data.exposedComponents.forEach((comp) => {
          contentProviders.add(comp.providingPlugin);
        });
      }

      // Consumers are plugins that depend on exposed components (sources of dependencies)
      data.dependencies.forEach((dep) => {
        contentConsumers.add(dep.source); // Source is the consumer in expose mode
      });

      const providerNodes = data.nodes.filter((node) => contentProviders.has(node.id));

      // Calculate provider positions based on their component group layout
      if (data.exposedComponents) {
        // Group exposed components by provider (mirror the logic from getExposedComponentPositions)
        const componentGroupsByProvider = new Map<string, string[]>();
        data.exposedComponents.forEach((comp) => {
          if (!componentGroupsByProvider.has(comp.providingPlugin)) {
            componentGroupsByProvider.set(comp.providingPlugin, []);
          }
          componentGroupsByProvider.get(comp.providingPlugin)!.push(comp.id);
        });

        // Responsive component spacing - add more space between boxes
        const componentSpacing = Math.max(75, height * 0.08); // Min 75px, or 8% of height
        const groupSpacing = Math.max(40, height * 0.05); // Min 40px, or 5% of height
        let currentGroupY = margin + 20; // Account for new main heading

        Array.from(componentGroupsByProvider.entries()).forEach(([providingPlugin, componentIds]) => {
          const groupHeight = componentIds.length * componentSpacing + 70;
          const groupCenterY = currentGroupY + groupHeight / 2;

          // Find the provider node for this plugin
          const providerNode = providerNodes.find((node) => node.id === providingPlugin);
          if (providerNode) {
            // Provider positioning - ensure it fits within panel bounds
            const nodeWidth = Math.max(180, width * 0.15);
            const providerX = margin + nodeWidth / 2; // Center the box from left edge
            result.push({
              ...providerNode,
              x: providerX,
              y: groupCenterY,
            });
            console.log(`Positioned provider ${providingPlugin} at (${providerX}, ${groupCenterY})`);
          } else {
            console.log(`Provider node not found for ${providingPlugin}`);
          }

          currentGroupY += groupHeight + groupSpacing;
        });
      }

      // Place consumer apps grouped by provider level - each consumer appears at the level of components it consumes
      const nodeBoxWidth = Math.max(180, width * 0.15); // Min 180px, or 15% of width
      const rightMargin = Math.max(40, width * 0.04); // Even larger right margin for better visual spacing
      const consumerX = width - rightMargin - nodeBoxWidth / 2; // Position with generous right margin

      // Define spacing variables for consumer positioning
      const componentSpacing = Math.max(75, height * 0.08); // Same as provider section
      const groupSpacing = Math.max(40, height * 0.05); // Same as provider section

      // Group consumers by the provider whose components they consume
      if (data.exposedComponents) {
        // Create a map: provider -> set of consumers that consume from this provider
        const consumersByProvider = new Map<string, Set<string>>();

        data.exposedComponents.forEach((comp) => {
          if (!consumersByProvider.has(comp.providingPlugin)) {
            consumersByProvider.set(comp.providingPlugin, new Set());
          }
          comp.consumers.forEach((consumerId) => {
            consumersByProvider.get(comp.providingPlugin)!.add(consumerId);
          });
        });

        // Position consumer boxes at each provider level
        let currentGroupY = margin + 20; // Account for new main heading
        Array.from(consumersByProvider.entries()).forEach(([providingPlugin, consumerIds]) => {
          // Get components for this provider to calculate group height
          const providerComponents = data.exposedComponents!.filter((comp) => comp.providingPlugin === providingPlugin);
          const groupHeight = providerComponents.length * componentSpacing + 70;

          // Position consumers for this provider within the provider's group area
          const consumerArray = Array.from(consumerIds);
          consumerArray.forEach((consumerId, consumerIndex) => {
            const consumerNode = data.nodes.find((n) => n.id === consumerId);
            if (consumerNode) {
              // Distribute consumers evenly within the provider's group height
              const availableHeight = groupHeight - 120; // Leave margins
              const consumerSpacing = availableHeight / Math.max(1, consumerArray.length - 1);
              const consumerY = currentGroupY + 60 + consumerIndex * consumerSpacing;

              result.push({
                ...consumerNode,
                id: `${consumerId}-at-${providingPlugin}`, // Unique ID for multiple instances
                originalId: consumerId, // Keep original ID for matching with arrows
                x: consumerX,
                y: consumerY,
              });
            }
          });

          currentGroupY += groupHeight + groupSpacing;
        });
      }
    } else {
      // Add mode layout: Content Providers on left, Extension Points on right
      if (!data.extensionPoints) {
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

      // Place content provider apps on the left
      const providerStartY = margin + 75; // Decrease margin by 5px for better balance
      providerNodes.forEach((node, index) => {
        result.push({
          ...node,
          x: margin + 90, // Position provider boxes properly
          y: providerStartY + index * nodeSpacing,
        });
      });
    }

    return result;
  }, [data.nodes, data.dependencies, data.extensionPoints, data.exposedComponents, isExposeMode, width, height]);

  useEffect(() => {
    setNodes(calculateLayout);
  }, [calculateLayout]);

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

  // Calculate extension point or exposed component positions
  const getExtensionPointPositions = () => {
    if (isExposeMode) {
      // In expose mode, we don't use extension points, but exposed components
      return new Map();
    }

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
    // Use responsive values but keep extension points properly positioned
    const margin = Math.max(20, width * 0.02);
    const extensionPointSpacing = 65; // Keep original spacing for extension points
    const groupSpacing = 40; // Keep original group spacing
    const extensionBoxWidth = 280; // Width of extension point boxes - further reduced to ensure proper fit
    const rightSideX = width - margin - extensionBoxWidth - 10; // Position extension points with extra safety margin

    let currentGroupY = margin + 50; // Account for new main heading + space for Content Consumer header

    Array.from(extensionPointGroups.entries()).forEach(([definingPlugin, extensionPointIds]) => {
      const groupHeight = extensionPointIds.length * extensionPointSpacing + 50; // Reduced extra space for group header

      extensionPointIds.forEach((epId, index) => {
        positions.set(epId, {
          x: rightSideX,
          y: currentGroupY + 70 + index * extensionPointSpacing, // Offset to sit below Content Consumer header
          groupY: currentGroupY,
          groupHeight: groupHeight,
        });
      });

      currentGroupY += groupHeight + groupSpacing;
    });

    return positions;
  };

  const extensionPointPositions = getExtensionPointPositions();

  // Calculate exposed component positions for expose mode
  const getExposedComponentPositions = () => {
    if (!isExposeMode || !data.exposedComponents) {
      return new Map();
    }

    // Group exposed components by their providing plugin
    const exposedComponentGroups = new Map<string, string[]>();
    data.exposedComponents.forEach((comp) => {
      if (!exposedComponentGroups.has(comp.providingPlugin)) {
        exposedComponentGroups.set(comp.providingPlugin, []);
      }
      exposedComponentGroups.get(comp.providingPlugin)!.push(comp.id);
    });

    const positions = new Map<string, { x: number; y: number; groupY: number; groupHeight: number }>();
    // Responsive values matching calculateLayout
    const margin = Math.max(20, width * 0.02);
    const componentSpacing = Math.max(75, height * 0.08);
    const groupSpacing = Math.max(40, height * 0.05);
    // Responsive center position with optimized component box width
    const componentBoxWidth = Math.max(300, width * 0.2); // Smaller width, less padding
    const centerX = width / 2 - componentBoxWidth / 2; // Center the component box

    let currentGroupY = margin + 20; // Account for new main heading

    Array.from(exposedComponentGroups.entries()).forEach(([providingPlugin, componentIds]) => {
      const groupHeight = componentIds.length * componentSpacing + 70;

      componentIds.forEach((compId, index) => {
        positions.set(compId, {
          x: centerX,
          y: currentGroupY + 60 + index * componentSpacing,
          groupY: currentGroupY,
          groupHeight: groupHeight,
        });
      });

      currentGroupY += groupHeight + groupSpacing;
    });

    return positions;
  };

  const exposedComponentPositions = getExposedComponentPositions();

  // Calculate the total height needed for all content
  const calculateContentHeight = () => {
    // Use responsive values matching other functions
    const margin = Math.max(20, width * 0.02);
    const spacing = Math.max(75, height * 0.08);
    const groupSpacing = Math.max(40, height * 0.05);
    let totalHeight = margin + 135; // Start with margin + header space (including new main heading + consumer header space)

    if (isExposeMode && data.exposedComponents && data.exposedComponents.length > 0) {
      // Group exposed components by their providing plugin
      const exposedComponentGroups = new Map<string, string[]>();
      data.exposedComponents.forEach((comp) => {
        if (!exposedComponentGroups.has(comp.providingPlugin)) {
          exposedComponentGroups.set(comp.providingPlugin, []);
        }
        exposedComponentGroups.get(comp.providingPlugin)!.push(comp.id);
      });

      Array.from(exposedComponentGroups.entries()).forEach(([_, componentIds]) => {
        const groupHeight = componentIds.length * spacing + 70;
        totalHeight += groupHeight + groupSpacing;
      });
    } else if (!isExposeMode && data.extensionPoints && data.extensionPoints.length > 0) {
      // Group extension points by their defining plugin to calculate total height
      const extensionPointGroups = new Map<string, string[]>();
      data.extensionPoints.forEach((ep) => {
        if (!extensionPointGroups.has(ep.definingPlugin)) {
          extensionPointGroups.set(ep.definingPlugin, []);
        }
        extensionPointGroups.get(ep.definingPlugin)!.push(ep.id);
      });

      Array.from(extensionPointGroups.entries()).forEach(([_, extensionPointIds]) => {
        const groupHeight = extensionPointIds.length * spacing + 70;
        totalHeight += groupHeight + groupSpacing;
      });
    } else {
      return height; // Use panel height as minimum if no content
    }

    return Math.max(totalHeight, height); // Use at least the panel height
  };

  const contentHeight = calculateContentHeight();

  const renderDependencyLinks = () => {
    if (isExposeMode) {
      return renderExposeDependencyLinks();
    }

    // Group dependencies by source and defining plugin to consolidate arrows (Add mode)
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
        const groupCenterY = firstExtensionPos.groupY + firstExtensionPos.groupHeight / 2;

        // Responsive node width
        const nodeWidth = Math.max(180, width * 0.15); // Min 180px, or 15% of width
        const startX = sourceNode.x + nodeWidth / 2;
        const startY = sourceNode.y;
        const endX = firstExtensionPos.x - 20; // Point a little further left of extension boxes for optimal visibility
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

  // Render dependency links for expose mode
  const renderExposeDependencyLinks = () => {
    if (!data.exposedComponents) {
      return [];
    }

    const arrows: React.JSX.Element[] = [];

    // Calculate responsive dimensions (matching the box rendering)
    const nodeWidth = Math.max(180, width * 0.15);
    const componentBoxWidth = Math.max(300, width * 0.2);

    // For each exposed component, create two types of arrows:
    // 1. One arrow from provider to component
    // 2. Multiple arrows from component to consumers
    data.exposedComponents.forEach((exposedComponent) => {
      const componentPos = exposedComponentPositions.get(exposedComponent.id);
      if (!componentPos) {
        return;
      }

      const isHighlighted = selectedExposedComponent === exposedComponent.id;

      // Find the actual provider node on the left side (not consumer instances)
      const providerNode = nodes.find((n) => n.id === exposedComponent.providingPlugin && !n.originalId);
      if (providerNode) {
        // Arrow: Provider → Its Own Component (left to center)
        arrows.push(
          <line
            key={`provider-to-component-${exposedComponent.id}`}
            x1={providerNode.x + nodeWidth / 2} // Right edge of provider box
            y1={providerNode.y}
            x2={componentPos.x} // Left edge of component box
            y2={componentPos.y}
            stroke={isHighlighted ? theme.colors.success.main : theme.colors.primary.main}
            strokeWidth={isHighlighted ? 3 : 2}
            markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
            opacity={selectedExposedComponent && !isHighlighted ? 0.3 : 1}
          />
        );
      }

      // Arrows: Consumers → Component (right to center) - pointing to right edge of component box
      exposedComponent.consumers.forEach((consumerId) => {
        // Find ONLY consumer instances (with originalId), NOT provider boxes
        const consumerInstances = nodes.filter((n) => n.originalId === consumerId);
        consumerInstances.forEach((consumerNode) => {
          // Only draw arrow if this consumer instance is at the same provider level as this component
          if (consumerNode.id.includes(`-at-${exposedComponent.providingPlugin}`)) {
            arrows.push(
              <line
                key={`consumer-to-component-${exposedComponent.id}-${consumerNode.id}`}
                x1={consumerNode.x - nodeWidth / 2} // Left edge of consumer box
                y1={consumerNode.y}
                x2={componentPos.x + componentBoxWidth} // Right edge of component box
                y2={componentPos.y}
                stroke={isHighlighted ? theme.colors.success.main : theme.colors.primary.main}
                strokeWidth={isHighlighted ? 3 : 2}
                markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
                opacity={selectedExposedComponent && !isHighlighted ? 0.3 : 1}
              />
            );
          }
        });
      });
    });

    return arrows;
  };

  const renderNodes = () => {
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

    return nodesToRender.map((node) => {
      // Responsive node dimensions
      const nodeWidth = Math.max(180, width * 0.15); // Min 180px, or 15% of width
      const nodeHeight = Math.max(50, height * 0.05); // Min 50px, or 5% of height

      return (
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
            {node.originalId || node.id}
          </text>
        </g>
      );
    });
  };

  const renderSectionHeaders = () => {
    // Use responsive margins matching the layout
    const margin = Math.max(20, width * 0.02);

    if (isExposeMode) {
      return (
        <g>
          {/* Main mode heading - centered "Expose APIs" */}
          <text
            x={width / 2}
            y={20}
            textAnchor="middle"
            className={styles.sectionHeader}
            fill={theme.colors.text.primary}
            style={{ fontSize: '18px', fontWeight: 'bold' }}
          >
            Expose APIs
          </text>

          {/* Content Provider Header (left in expose mode) */}
          <text
            x={margin + Math.max(180, width * 0.15) / 2}
            y={55}
            textAnchor="middle"
            className={styles.sectionHeader}
            fill={theme.colors.text.primary}
          >
            Content provider
          </text>

          {/* Dashed line under Content Provider header */}
          <line
            x1={margin + 10}
            y1={65}
            x2={margin + Math.max(180, width * 0.15) - 10}
            y2={65}
            stroke={theme.colors.border.medium}
            strokeWidth={1}
            strokeDasharray="5,5"
          />

          {/* Components Header (center) */}
          <text
            x={width / 2}
            y={55}
            textAnchor="middle"
            className={styles.sectionHeader}
            fill={theme.colors.text.primary}
          >
            Components
          </text>

          {/* Dashed line under Components header */}
          <line
            x1={width / 2 - 100}
            y1={65}
            x2={width / 2 + 100}
            y2={65}
            stroke={theme.colors.border.medium}
            strokeWidth={1}
            strokeDasharray="5,5"
          />

          {/* Content Consumer Header (right in expose mode) */}
          <text
            x={width - Math.max(40, width * 0.04) - Math.max(180, width * 0.15) / 2}
            y={55}
            textAnchor="middle"
            className={styles.sectionHeader}
            fill={theme.colors.text.primary}
          >
            Content consumer
          </text>

          {/* Dashed line under Content Consumer header */}
          <line
            x1={width - Math.max(40, width * 0.04) - Math.max(180, width * 0.15) + 10}
            y1={65}
            x2={width - Math.max(40, width * 0.04) - 10}
            y2={65}
            stroke={theme.colors.border.medium}
            strokeWidth={1}
            strokeDasharray="5,5"
          />
        </g>
      );
    }

    return (
      <g>
        {/* Main mode heading - centered "Add APIs" */}
        <text
          x={width / 2}
          y={20}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          Add APIs
        </text>

        {/* Content Provider Header */}
        <text
          x={margin + 90}
          y={55}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          Content provider
        </text>

        {/* Dashed line under Content Provider header */}
        <line
          x1={margin + 90 - Math.max(180, width * 0.15) / 2} // Match left edge of provider box
          y1={65}
          x2={margin + 90 + Math.max(180, width * 0.15) / 2} // Match right edge of provider box
          y2={65}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />

        {/* Content Consumer Header */}
        <text
          x={width - margin - 150} // Center over the actual box positions (accounting for 10px safety margin)
          y={55}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          Content consumer
        </text>

        {/* Dashed line under Content Consumer header */}
        <line
          x1={width - margin - 290 - 5} // Align with left edge of boxes with small buffer
          y1={65}
          x2={width - margin - 10 + 5} // Align with right edge of boxes with small buffer
          y2={65}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />
      </g>
    );
  };

  // Render exposed components for expose mode
  const renderExposedComponents = () => {
    if (!isExposeMode || !data.exposedComponents) {
      return null;
    }

    // Render individual component boxes without grouping wrapper
    return data.exposedComponents.map((exposedComponent) => {
      const compPos = exposedComponentPositions.get(exposedComponent.id);
      if (!compPos) {
        return null;
      }

      // Responsive component box dimensions - optimized for less padding
      const componentBoxWidth = Math.max(300, width * 0.2); // Smaller width, less padding
      const componentBoxHeight = Math.max(55, height * 0.06); // Min 55px, or 6% of height

      return (
        <g key={exposedComponent.id}>
          {/* Individual exposed component box */}
          <rect
            x={compPos.x}
            y={compPos.y - componentBoxHeight / 2}
            width={componentBoxWidth}
            height={componentBoxHeight}
            fill={theme.colors.warning.main}
            stroke={
              selectedExposedComponent === exposedComponent.id
                ? theme.colors.primary.border
                : theme.colors.border.strong
            }
            strokeWidth={selectedExposedComponent === exposedComponent.id ? 3 : 2}
            rx={6}
            className={styles.extensionPointBox}
            onClick={() => {
              setSelectedExposedComponent(
                selectedExposedComponent === exposedComponent.id ? null : exposedComponent.id
              );
            }}
            style={{ cursor: 'pointer' }}
          />

          {/* Component title */}
          <text
            x={compPos.x + componentBoxWidth / 2}
            y={compPos.y - 5}
            textAnchor="middle"
            className={styles.extensionPointLabel}
            fill={theme.colors.getContrastText(theme.colors.warning.main)}
          >
            {exposedComponent.title || exposedComponent.id}
          </text>

          {/* Component ID - second line */}
          <text
            x={compPos.x + componentBoxWidth / 2}
            y={compPos.y + 15}
            textAnchor="middle"
            className={styles.extensionTypeBadge}
            fill={theme.colors.getContrastText(theme.colors.warning.main)}
          >
            {exposedComponent.id}
          </text>
        </g>
      );
    });
  };

  const renderExtensionPoints = () => {
    if (isExposeMode || !data.extensionPoints) {
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

      const groupHeight = firstEpPos.groupHeight;
      const extensionBoxWidth = 280; // Width for extension IDs - further reduced to ensure proper fit
      const extensionBoxHeight = options.showDependencyTypes ? 60 : 40; // Adjust height based on whether we show type info

      return (
        <g key={definingPlugin}>
          {/* Defining plugin group box - make it more prominent */}
          <rect
            x={firstEpPos.x - 10} // Reduced left offset since boxes are now properly positioned
            y={firstEpPos.groupY}
            width={extensionBoxWidth + 20} // Match the extension box width
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
      <svg width={width} height={contentHeight} className={styles.svg}>
        {renderArrowMarker()}
        {renderSectionHeaders()}
        {renderDependencyLinks()}
        {renderNodes()}
        {isExposeMode ? renderExposedComponents() : renderExtensionPoints()}
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
