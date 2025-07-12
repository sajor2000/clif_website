/**
 * Configuration constants for the Interactive ERD Component
 * @module ERDConstants
 */

import type { ERDConfig } from '../types/ERDTypes';

/**
 * Default configuration for the ERD component
 */
export const DEFAULT_CONFIG: ERDConfig = {
  dimensions: {
    entityWidth: 250,
    headerHeight: 35,
    fieldHeight: 25,
    padding: 10,
    minScale: 0.5,
    maxScale: 3
  },
  colors: {
    beta: '#E67E22',
    new: '#F39C12',
    concept: '#95A5A6'
  },
  animation: {
    duration: 300,
    easing: 'ease'
  },
  accessibility: {
    enableKeyboard: true,
    announceChanges: true,
    highContrast: false
  }
};

/**
 * SVG namespace for creating elements
 */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * CSS classes used in the component
 */
export const CSS_CLASSES = {
  entity: 'erd-entity',
  entityRect: 'erd-entity-rect',
  entityHeader: 'erd-entity-header',
  entityName: 'erd-entity-name',
  fieldText: 'erd-field-text',
  fieldType: 'erd-field-type',
  maturityBadge: 'erd-maturity-badge',
  relationship: 'erd-relationship',
  highlighted: 'erd-highlighted',
  dimmed: 'erd-dimmed',
  selected: 'erd-selected'
} as const;

/**
 * Keyboard shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  SEARCH: '/',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ZOOM_IN: '+',
  ZOOM_OUT: '-',
  RESET_VIEW: '0',
  TOGGLE_RELATIONSHIPS: 'r'
} as const;

/**
 * ARIA labels and descriptions
 */
export const ARIA_LABELS = {
  diagram: 'Interactive Entity Relationship Diagram',
  entity: (name: string) => `Table: ${name}`,
  field: (name: string, type: string) => `Field: ${name} of type ${type}`,
  relationship: (from: string, to: string) => `Relationship from ${from} to ${to}`,
  search: 'Search tables and fields',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetView: 'Reset view to default',
  toggleRelationships: 'Toggle relationship visibility',
  detailsPanel: 'Entity details panel',
  closeDetails: 'Close details panel'
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  INVALID_DATA: 'Invalid entity data provided',
  RENDER_FAILED: 'Failed to render diagram',
  SEARCH_FAILED: 'Search operation failed',
  TRANSFORM_FAILED: 'Failed to apply transformation',
  NO_ENTITIES: 'No entities to display',
  BROWSER_NOT_SUPPORTED: 'Your browser does not support required features'
} as const;

/**
 * Performance constants
 */
export const PERFORMANCE = {
  SEARCH_DEBOUNCE_MS: 300,
  RENDER_BATCH_SIZE: 50,
  ANIMATION_FRAME_RATE: 60,
  MAX_ENTITIES_WITHOUT_VIRTUALIZATION: 100
} as const;

/**
 * Default positions for automatic layout
 */
export const LAYOUT = {
  START_X: 100,
  START_Y: 100,
  HORIZONTAL_SPACING: 400,
  VERTICAL_SPACING: 350,
  COLUMNS: 4
} as const;

/**
 * Color schemes for accessibility
 */
export const COLOR_SCHEMES = {
  default: {
    background: '#f5f5f5',
    entityBg: 'white',
    entityBorder: '#ddd',
    text: '#333',
    textSecondary: '#666',
    highlight: '#841839',
    relationship: '#999'
  },
  highContrast: {
    background: '#000',
    entityBg: '#fff',
    entityBorder: '#000',
    text: '#000',
    textSecondary: '#333',
    highlight: '#ff0000',
    relationship: '#000'
  },
  darkMode: {
    background: '#1a1a1a',
    entityBg: '#2d2d2d',
    entityBorder: '#444',
    text: '#e0e0e0',
    textSecondary: '#999',
    highlight: '#ff6b6b',
    relationship: '#666'
  }
} as const;