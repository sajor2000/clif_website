// Type definitions for Interactive ERD Component

export interface ERDField {
  name: string;
  type: string;
  description?: string;
  isPK?: boolean;
  isFK?: boolean;
  restrictions?: string;
  values?: string[];
}

export interface ERDEntity {
  id: string;
  name: string;
  maturity: 'beta' | 'concept' | 'future';
  position: { x: number; y: number };
  fields: ERDField[];
  description?: string;
  notes?: string[];
}

export interface ERDRelationship {
  from: string;
  to: string;
  field: string;
  type?: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface ERDTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ERDConfig {
  entityWidth: number;
  entityHeaderHeight: number;
  fieldHeight: number;
  padding: number;
  minScale: number;
  maxScale: number;
  initialScale: number;
}

export interface ERDTheme {
  colors: {
    beta: string;
    concept: string;
    future: string;
    entityBackground: string;
    entityBorder: string;
    relationshipLine: string;
    relationshipHighlight: string;
    text: string;
    textSecondary: string;
  };
  fonts: {
    entityName: string;
    fieldText: string;
    fieldType: string;
  };
}

export interface ERDEventHandlers {
  onEntityClick?: (entity: ERDEntity) => void;
  onEntityHover?: (entity: ERDEntity | null) => void;
  onRelationshipClick?: (relationship: ERDRelationship) => void;
  onViewportChange?: (transform: ERDTransform) => void;
  onSearch?: (query: string, results: ERDEntity[]) => void;
}

export interface ERDState {
  selectedEntity: ERDEntity | null;
  hoveredEntity: ERDEntity | null;
  highlightedEntities: Set<string>;
  dimmedEntities: Set<string>;
  searchQuery: string;
  searchResults: ERDEntity[];
  showRelationships: boolean;
  viewportTransform: ERDTransform;
  isDetailsPanel: boolean;
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ERDSearchOptions {
  searchInFields: boolean;
  searchInDescriptions: boolean;
  caseSensitive: boolean;
  maturityFilter: Array<'beta' | 'concept' | 'future'>;
}

export interface ERDExportOptions {
  format: 'svg' | 'png' | 'pdf';
  includeBackground: boolean;
  scale: number;
  width?: number;
  height?: number;
}

export interface ERDResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface ERDAccessibilityConfig {
  enableKeyboardNavigation: boolean;
  enableScreenReader: boolean;
  enableHighContrast: boolean;
  enableReducedMotion: boolean;
}

// Utility types
export type MaturityLevel = 'beta' | 'concept' | 'future';
export type ERDMode = 'view' | 'edit' | 'fullscreen';
export type ERDLayout = 'grid' | 'hierarchical' | 'circular' | 'custom';

// Event types
export interface ERDMouseEvent extends MouseEvent {
  erdEntity?: ERDEntity;
  erdRelationship?: ERDRelationship;
}

export interface ERDKeyboardEvent extends KeyboardEvent {
  erdAction?: 'select' | 'zoom-in' | 'zoom-out' | 'reset' | 'search' | 'close';
}

// Performance monitoring
export interface ERDPerformanceMetrics {
  renderTime: number;
  entityCount: number;
  relationshipCount: number;
  searchTime: number;
  memoryUsage: number;
}