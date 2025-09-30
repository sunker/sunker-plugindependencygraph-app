/**
 * Extension Renderer Component
 *
 * Renders extension points and exposed components in the dependency graph.
 */

import {
  COLOR_DEFAULTS,
  DISPLAY_NAMES,
  LAYOUT_CONSTANTS,
  VISUAL_CONSTANTS,
  getResponsiveComponentHeight,
  getResponsiveComponentWidth,
} from '../constants';
import { GraphData, PanelOptions } from '../types';

import { GrafanaTheme2 } from '@grafana/data';
import { PositionInfo } from './GraphLayout';
import React from 'react';

interface ExtensionRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  isExposeMode: boolean;
  extensionPointPositions: Map<string, PositionInfo>;
  exposedComponentPositions: Map<string, PositionInfo>;
  selectedExtensionPoint: string | null;
  selectedExposedComponent: string | null;
  onExtensionPointClick: (id: string | null) => void;
  onExposedComponentClick: (id: string | null) => void;
  styles: {
    extensionGroupBox: string;
    extensionPointBox: string;
    extensionPointLabel: string;
    extensionTypeBadge: string;
    definingPluginLabel: string;
    descriptionInlineText: string;
  };
}

export const ExtensionRenderer: React.FC<ExtensionRendererProps> = ({
  theme,
  data,
  options,
  width,
  height,
  isExposeMode,
  extensionPointPositions,
  exposedComponentPositions,
  selectedExtensionPoint,
  selectedExposedComponent,
  onExtensionPointClick,
  onExposedComponentClick,
  styles,
}) => {
  if (isExposeMode) {
    return renderExposedComponents();
  } else {
    return renderExtensionPoints();
  }

  function renderExposedComponents() {
    if (!data.exposedComponents) {
      return null;
    }

    const componentBoxWidth = getResponsiveComponentWidth(width);
    const originalComponentHeight = getResponsiveComponentHeight(height);
    let componentBoxHeight = originalComponentHeight;

    if (options.showDescriptions) {
      componentBoxHeight += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
    }

    return (
      <g>
        {data.exposedComponents.map((exposedComponent) => {
          const compPos = exposedComponentPositions.get(exposedComponent.id);
          if (!compPos) {
            return null;
          }

          return (
            <g key={exposedComponent.id}>
              {/* Individual exposed component box */}
              <rect
                x={compPos.x}
                y={compPos.y - originalComponentHeight / 2}
                width={componentBoxWidth}
                height={componentBoxHeight}
                fill={theme.colors.warning.main}
                stroke={
                  selectedExposedComponent === exposedComponent.id
                    ? theme.colors.primary.border
                    : theme.colors.border.strong
                }
                strokeWidth={
                  selectedExposedComponent === exposedComponent.id
                    ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                    : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
                }
                rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                className={styles.extensionPointBox}
                onClick={() =>
                  onExposedComponentClick(selectedExposedComponent === exposedComponent.id ? null : exposedComponent.id)
                }
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

              {/* Description text underneath component ID */}
              {options.showDescriptions &&
                exposedComponent?.description &&
                exposedComponent.description.trim() !== '' && (
                  <text
                    x={compPos.x + componentBoxWidth / 2}
                    y={compPos.y + 30}
                    textAnchor="middle"
                    className={styles.descriptionInlineText}
                    fill={theme.colors.getContrastText(theme.colors.warning.main)}
                  >
                    {exposedComponent.description}
                  </text>
                )}
            </g>
          );
        })}
      </g>
    );
  }

  function renderExtensionPoints() {
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

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const originalHeight = options.showDependencyTypes
      ? LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT
      : LAYOUT_CONSTANTS.EXTENSION_BOX_HEIGHT_NO_TYPE;
    let extensionBoxHeight = originalHeight;

    if (options.showDescriptions) {
      extensionBoxHeight += LAYOUT_CONSTANTS.DESCRIPTION_EXTRA_SPACING;
    }

    return (
      <g>
        {Array.from(extensionPointGroups.entries()).map(([definingPlugin, extensionPointIds]) => {
          const firstEpPos = extensionPointPositions.get(extensionPointIds[0]);
          if (!firstEpPos) {
            return null;
          }

          const groupHeight = firstEpPos.groupHeight;

          return (
            <g key={definingPlugin}>
              {/* Defining plugin group box */}
              <rect
                x={firstEpPos.x - 10}
                y={firstEpPos.groupY}
                width={extensionBoxWidth + 20}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                className={styles.extensionGroupBox}
              />

              {/* Extension points */}
              {extensionPointIds.map((epId) => {
                const epPos = extensionPointPositions.get(epId);
                if (!epPos) {
                  return null;
                }

                const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
                const extensionType = extensionPoint?.extensionType || 'link';
                const extensionColor = getExtensionColor(extensionType);

                return (
                  <g key={epId}>
                    {/* Extension point box with type-specific color */}
                    <rect
                      x={epPos.x}
                      y={epPos.y - originalHeight / 2}
                      width={extensionBoxWidth}
                      height={extensionBoxHeight}
                      fill={extensionColor}
                      stroke={
                        selectedExtensionPoint === epId ? theme.colors.primary.border : theme.colors.border.strong
                      }
                      strokeWidth={
                        selectedExtensionPoint === epId
                          ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                          : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
                      }
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                      className={styles.extensionPointBox}
                      onClick={() => onExtensionPointClick(selectedExtensionPoint === epId ? null : epId)}
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
                      {epId}
                    </text>

                    {/* Extension type - second line in parentheses */}
                    {options.showDependencyTypes && (
                      <g>
                        <text
                          x={epPos.x + extensionBoxWidth / 2}
                          y={epPos.y + 15}
                          textAnchor="middle"
                          className={styles.extensionTypeBadge}
                          fill={theme.colors.getContrastText(extensionColor)}
                        >
                          ({extensionType} extension)
                        </text>

                        {/* Description text underneath parentheses */}
                        {options.showDescriptions &&
                          extensionPoint?.description &&
                          extensionPoint.description.trim() !== '' && (
                            <text
                              x={epPos.x + extensionBoxWidth / 2}
                              y={epPos.y + 30}
                              textAnchor="middle"
                              className={styles.descriptionInlineText}
                              fill={theme.colors.getContrastText(extensionColor)}
                            >
                              {extensionPoint.description}
                            </text>
                          )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Defining plugin name header */}
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
        })}
      </g>
    );
  }

  function getExtensionColor(type: string): string {
    switch (type) {
      case 'component':
        return options.componentExtensionColor || COLOR_DEFAULTS.COMPONENT_EXTENSION;
      case 'function':
        return options.functionExtensionColor || COLOR_DEFAULTS.FUNCTION_EXTENSION;
      case 'link':
      default:
        return options.linkExtensionColor || COLOR_DEFAULTS.LINK_EXTENSION;
    }
  }

  function getDisplayName(pluginId: string): string {
    if (pluginId === 'grafana-core') {
      return DISPLAY_NAMES.GRAFANA_CORE;
    }
    return pluginId;
  }
};
