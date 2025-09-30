/**
 * Link Renderer Component
 *
 * Renders dependency links/arrows between nodes in the dependency graph.
 */

import { NodeWithPosition, PositionInfo } from './GraphLayout';
import { VISUAL_CONSTANTS, getResponsiveComponentWidth, getResponsiveNodeWidth } from '../constants';

import { GrafanaTheme2 } from '@grafana/data';
import { GraphData } from '../types';
import React from 'react';

interface LinkRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  nodes: NodeWithPosition[];
  extensionPointPositions: Map<string, PositionInfo>;
  exposedComponentPositions: Map<string, PositionInfo>;
  width: number;
  isExposeMode: boolean;
  selectedExtensionPoint: string | null;
  selectedExposedComponent: string | null;
  styles: {
    link: string;
    linkHighlighted: string;
  };
}

export const LinkRenderer: React.FC<LinkRendererProps> = ({
  theme,
  data,
  nodes,
  extensionPointPositions,
  exposedComponentPositions,
  width,
  isExposeMode,
  selectedExtensionPoint,
  selectedExposedComponent,
  styles,
}) => {
  if (isExposeMode) {
    return renderExposeDependencyLinks();
  }

  return renderAddDependencyLinks();

  function renderAddDependencyLinks() {
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
        const groupCenterY = firstExtensionPos.groupY + firstExtensionPos.groupHeight / 2;

        const nodeWidth = getResponsiveNodeWidth(width);
        const startX = sourceNode.x + nodeWidth / 2;
        const startY = sourceNode.y;
        const endX = firstExtensionPos.x - 20;
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
              strokeWidth={isHighlighted ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH : VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
              markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
              className={isHighlighted ? styles.linkHighlighted : styles.link}
              opacity={
                selectedExtensionPoint && !isHighlighted
                  ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                  : VISUAL_CONSTANTS.SELECTED_OPACITY
              }
            />
          </g>
        );

        arrowIndex++;
      });
    });

    return <g>{arrows}</g>;
  }

  function renderExposeDependencyLinks() {
    if (!data.exposedComponents) {
      return <g></g>;
    }

    const arrows: React.JSX.Element[] = [];
    const nodeWidth = getResponsiveNodeWidth(width);
    const componentBoxWidth = getResponsiveComponentWidth(width);

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
            strokeWidth={isHighlighted ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
            markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
            opacity={
              selectedExposedComponent && !isHighlighted
                ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                : VISUAL_CONSTANTS.SELECTED_OPACITY
            }
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
                strokeWidth={
                  isHighlighted ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
                }
                markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
                opacity={
                  selectedExposedComponent && !isHighlighted
                    ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                    : VISUAL_CONSTANTS.SELECTED_OPACITY
                }
              />
            );
          }
        });
      });
    });

    return <g>{arrows}</g>;
  }
};
