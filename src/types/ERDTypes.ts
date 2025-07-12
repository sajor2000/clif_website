/**
 * Type definitions for the Interactive ERD Component
 * @module ERDTypes
 */

/**
 * Maturity levels for database tables
 */
export type MaturityLevel = 'beta' | 'new' | 'concept';

/**
 * Database field definition
 */
export interface Field {
  name: string;
  type: string;
  isPK?: boolean;  // Primary Key
  isFK?: boolean;  // Foreign Key
  description?: string;
  nullable?: boolean;
  unique?: boolean;
}

/**
 * Position coordinates for SVG rendering
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Entity (table) definition
 */
export interface Entity {
  id: string;
  name: string;
  maturity: MaturityLevel;
  position: Position;
  fields: Field[];
  description?: string;
  color?: string;
}

/**
 * Relationship between entities
 */
export interface Relationship {
  from: string;      // Entity ID
  to: string;        // Entity ID
  field: string;     // Field name that creates the relationship
  type?: 'one-to-one' | 'one-to-many' | 'many-to-many';
  label?: string;
}

/**
 * Transform state for pan and zoom
 */
export interface Transform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Component props
 */
export interface ERDProps {
  tables?: TableDefinition[];
  width?: number;
  height?: number;
  interactive?: boolean;
  showLegend?: boolean;
  showControls?: boolean;
}

/**
 * Table definition from parent component
 */
export interface TableDefinition {
  id: string;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  notes?: string[];
  example?: string;
}

/**
 * Field definition from parent component
 */
export interface FieldDefinition {
  name: string;
  type: string;
  description?: string;
  restrictions?: string;
  values?: string[];
}

/**
 * ERD configuration options
 */
export interface ERDConfig {
  dimensions: {
    entityWidth: number;
    headerHeight: number;
    fieldHeight: number;
    padding: number;
    minScale: number;
    maxScale: number;
  };
  colors: {
    [key in MaturityLevel]: string;
  };
  animation: {
    duration: number;
    easing: string;
  };
  accessibility: {
    enableKeyboard: boolean;
    announceChanges: boolean;
    highContrast: boolean;
  };
}

/**
 * UI State for the component
 */
export interface UIState {
  selectedEntity: string | null;
  highlightedEntities: Set<string>;
  dimmedEntities: Set<string>;
  searchQuery: string;
  showRelationships: boolean;
  isPanning: boolean;
  transform: Transform;
  detailsPanelOpen: boolean;
}

/**
 * Event handlers interface
 */
export interface ERDEventHandlers {
  onEntitySelect?: (entity: Entity) => void;
  onEntityHover?: (entity: Entity | null) => void;
  onSearchChange?: (query: string) => void;
  onTransformChange?: (transform: Transform) => void;
  onError?: (error: Error) => void;
}

/**
 * Accessibility options
 */
export interface AccessibilityOptions {
  ariaLabel?: string;
  ariaDescription?: string;
  announcements?: boolean;
  keyboardShortcuts?: boolean;
  reducedMotion?: boolean;
}