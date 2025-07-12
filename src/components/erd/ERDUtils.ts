// Utility functions for Interactive ERD Component
import type { 
  ERDEntity, 
  ERDRelationship, 
  ERDTransform, 
  ERDConfig,
  ERDSearchOptions,
  MaturityLevel 
} from './ERDTypes';

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance-critical operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T, 
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Calculate optimal entity dimensions based on field count
 */
export function calculateEntityDimensions(
  entity: ERDEntity, 
  config: ERDConfig
): { width: number; height: number } {
  const width = config.entityWidth;
  const visibleFields = Math.min(entity.fields.length, 6); // Limit visible fields
  const height = config.entityHeaderHeight + 
                (visibleFields * config.fieldHeight) + 
                (config.padding * 2);
  
  return { width, height };
}

/**
 * Search entities based on query and options
 */
export function searchEntities(
  entities: ERDEntity[], 
  query: string, 
  options: ERDSearchOptions = {
    searchInFields: true,
    searchInDescriptions: false,
    caseSensitive: false,
    maturityFilter: ['beta', 'concept', 'future']
  }
): ERDEntity[] {
  if (!query.trim()) return entities;

  const searchQuery = options.caseSensitive ? query : query.toLowerCase();
  
  return entities.filter(entity => {
    // Filter by maturity level
    if (!options.maturityFilter.includes(entity.maturity)) {
      return false;
    }

    const entityName = options.caseSensitive ? entity.name : entity.name.toLowerCase();
    
    // Search in entity name
    if (entityName.includes(searchQuery)) {
      return true;
    }

    // Search in fields
    if (options.searchInFields) {
      const fieldMatch = entity.fields.some(field => {
        const fieldName = options.caseSensitive ? field.name : field.name.toLowerCase();
        const fieldType = options.caseSensitive ? field.type : field.type.toLowerCase();
        return fieldName.includes(searchQuery) || fieldType.includes(searchQuery);
      });
      if (fieldMatch) return true;
    }

    // Search in descriptions
    if (options.searchInDescriptions && entity.description) {
      const description = options.caseSensitive ? entity.description : entity.description.toLowerCase();
      if (description.includes(searchQuery)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Calculate connection points between entities
 */
export function calculateConnectionPoints(
  fromEntity: ERDEntity,
  toEntity: ERDEntity,
  config: ERDConfig
): { fromX: number; fromY: number; toX: number; toY: number } {
  const fromCenter = {
    x: fromEntity.position.x + config.entityWidth / 2,
    y: fromEntity.position.y + config.entityHeaderHeight / 2
  };
  
  const toCenter = {
    x: toEntity.position.x + config.entityWidth / 2,
    y: toEntity.position.y + config.entityHeaderHeight / 2
  };

  const dx = Math.abs(fromCenter.x - toCenter.x);
  const dy = Math.abs(fromCenter.y - toCenter.y);

  let fromX: number, fromY: number, toX: number, toY: number;

  if (dx > dy) {
    // Horizontal connection
    if (fromCenter.x < toCenter.x) {
      fromX = fromEntity.position.x + config.entityWidth;
      toX = toEntity.position.x;
    } else {
      fromX = fromEntity.position.x;
      toX = toEntity.position.x + config.entityWidth;
    }
    fromY = fromCenter.y;
    toY = toCenter.y;
  } else {
    // Vertical connection
    fromX = fromCenter.x;
    toX = toCenter.x;
    const entityHeight = config.entityHeaderHeight + (4 * config.fieldHeight) + (config.padding * 2);
    
    if (fromCenter.y < toCenter.y) {
      fromY = fromEntity.position.y + entityHeight;
      toY = toEntity.position.y;
    } else {
      fromY = fromEntity.position.y;
      toY = toEntity.position.y + entityHeight;
    }
  }

  return { fromX, fromY, toX, toY };
}

/**
 * Get entities related to a given entity
 */
export function getRelatedEntities(
  entityId: string,
  relationships: ERDRelationship[]
): Set<string> {
  const related = new Set<string>();
  
  relationships.forEach(rel => {
    if (rel.from === entityId) {
      related.add(rel.to);
    } else if (rel.to === entityId) {
      related.add(rel.from);
    }
  });
  
  return related;
}

/**
 * Validate entity data structure
 */
export function validateEntity(entity: any): entity is ERDEntity {
  return (
    typeof entity === 'object' &&
    typeof entity.id === 'string' &&
    typeof entity.name === 'string' &&
    ['beta', 'concept', 'future'].includes(entity.maturity) &&
    typeof entity.position === 'object' &&
    typeof entity.position.x === 'number' &&
    typeof entity.position.y === 'number' &&
    Array.isArray(entity.fields)
  );
}

/**
 * Generate SVG path for relationship lines
 */
export function generateRelationshipPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  curved: boolean = false
): string {
  if (!curved) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }
  
  // Create curved path for better visual appeal
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const controlOffset = Math.min(50, Math.abs(toX - fromX) / 4);
  
  return `M ${fromX} ${fromY} Q ${midX + controlOffset} ${midY} ${toX} ${toY}`;
}

/**
 * Check if point is inside entity bounds
 */
export function isPointInEntity(
  x: number,
  y: number,
  entity: ERDEntity,
  config: ERDConfig
): boolean {
  const dimensions = calculateEntityDimensions(entity, config);
  
  return (
    x >= entity.position.x &&
    x <= entity.position.x + dimensions.width &&
    y >= entity.position.y &&
    y <= entity.position.y + dimensions.height
  );
}

/**
 * Calculate optimal viewport bounds for all entities
 */
export function calculateViewportBounds(
  entities: ERDEntity[],
  config: ERDConfig,
  padding: number = 50
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (entities.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  entities.forEach(entity => {
    const dimensions = calculateEntityDimensions(entity, config);
    
    minX = Math.min(minX, entity.position.x);
    minY = Math.min(minY, entity.position.y);
    maxX = Math.max(maxX, entity.position.x + dimensions.width);
    maxY = Math.max(maxY, entity.position.y + dimensions.height);
  });

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: (maxX - minX) + (2 * padding),
    height: (maxY - minY) + (2 * padding)
  };
}

/**
 * Get responsive breakpoint
 */
export function getBreakpoint(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Format field name for display
 */
export function formatFieldName(fieldName: string, maxLength: number = 20): string {
  if (fieldName.length <= maxLength) return fieldName;
  return fieldName.substring(0, maxLength - 3) + '...';
}

/**
 * Generate unique ID for DOM elements
 */
export function generateId(prefix: string = 'erd'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if high contrast mode is enabled
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Check if dark mode is preferred
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Convert screen coordinates to SVG coordinates
 */
export function screenToSVG(
  screenX: number,
  screenY: number,
  svgElement: SVGSVGElement,
  transform: ERDTransform
): { x: number; y: number } {
  const rect = svgElement.getBoundingClientRect();
  const x = (screenX - rect.left - transform.x) / transform.scale;
  const y = (screenY - rect.top - transform.y) / transform.scale;
  return { x, y };
}