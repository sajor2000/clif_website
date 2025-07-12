/**
 * Utility functions for the Interactive ERD Component
 * @module ERDUtils
 */

import type { 
  Entity, 
  Field, 
  Position, 
  Transform, 
  TableDefinition,
  FieldDefinition,
  Relationship
} from '../types/ERDTypes';
import { LAYOUT, PERFORMANCE } from '../config/ERDConstants';

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Convert table definitions to entities
 */
export function tablesToEntities(tables: TableDefinition[]): Entity[] {
  return tables.map((table, index) => ({
    id: table.id,
    name: table.name,
    maturity: 'beta', // Default maturity, could be derived from table data
    position: calculatePosition(index, tables.length),
    fields: table.fields.map(fieldToERDField),
    description: table.description
  }));
}

/**
 * Convert field definition to ERD field
 */
function fieldToERDField(field: FieldDefinition): Field {
  return {
    name: field.name,
    type: field.type,
    description: field.description,
    // Detect primary keys and foreign keys based on naming convention
    isPK: field.name.toLowerCase().endsWith('_id') && 
          field.name.toLowerCase().includes(field.name.split('_')[0]),
    isFK: field.name.toLowerCase().endsWith('_id') && 
          !field.name.toLowerCase().includes(field.name.split('_')[0])
  };
}

/**
 * Calculate automatic position for entity
 */
export function calculatePosition(index: number, total: number): Position {
  const col = index % LAYOUT.COLUMNS;
  const row = Math.floor(index / LAYOUT.COLUMNS);
  
  return {
    x: LAYOUT.START_X + (col * LAYOUT.HORIZONTAL_SPACING),
    y: LAYOUT.START_Y + (row * LAYOUT.VERTICAL_SPACING)
  };
}

/**
 * Extract relationships from entities
 */
export function extractRelationships(entities: Entity[]): Relationship[] {
  const relationships: Relationship[] = [];
  const entityMap = new Map(entities.map(e => [e.id, e]));
  
  entities.forEach(entity => {
    entity.fields.forEach(field => {
      if (field.isFK) {
        // Try to find the referenced entity
        const referencedEntityName = field.name.replace(/_id$/, '');
        const referencedEntity = Array.from(entityMap.values())
          .find(e => e.name === referencedEntityName);
        
        if (referencedEntity) {
          relationships.push({
            from: entity.id,
            to: referencedEntity.id,
            field: field.name,
            type: 'one-to-many'
          });
        }
      }
    });
  });
  
  return relationships;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate bounding box for all entities
 */
export function calculateBoundingBox(entities: Entity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (entities.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  entities.forEach(entity => {
    minX = Math.min(minX, entity.position.x);
    minY = Math.min(minY, entity.position.y);
    maxX = Math.max(maxX, entity.position.x + 250); // Entity width
    maxY = Math.max(maxY, entity.position.y + 300); // Approximate entity height
  });
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculate transform to fit all entities in view
 */
export function calculateFitTransform(
  entities: Entity[],
  viewportWidth: number,
  viewportHeight: number
): Transform {
  const bbox = calculateBoundingBox(entities);
  const padding = 50;
  
  const scaleX = (viewportWidth - padding * 2) / bbox.width;
  const scaleY = (viewportHeight - padding * 2) / bbox.height;
  const scale = Math.min(scaleX, scaleY, 1);
  
  const x = (viewportWidth - bbox.width * scale) / 2 - bbox.minX * scale;
  const y = (viewportHeight - bbox.height * scale) / 2 - bbox.minY * scale;
  
  return { x, y, scale };
}

/**
 * Search entities and fields
 */
export function searchEntities(
  entities: Entity[],
  query: string
): Set<string> {
  const normalizedQuery = query.toLowerCase().trim();
  const matchingEntities = new Set<string>();
  
  if (!normalizedQuery) return matchingEntities;
  
  entities.forEach(entity => {
    // Check entity name
    if (entity.name.toLowerCase().includes(normalizedQuery)) {
      matchingEntities.add(entity.id);
      return;
    }
    
    // Check entity description
    if (entity.description?.toLowerCase().includes(normalizedQuery)) {
      matchingEntities.add(entity.id);
      return;
    }
    
    // Check fields
    const hasMatchingField = entity.fields.some(field => 
      field.name.toLowerCase().includes(normalizedQuery) ||
      field.type.toLowerCase().includes(normalizedQuery) ||
      field.description?.toLowerCase().includes(normalizedQuery)
    );
    
    if (hasMatchingField) {
      matchingEntities.add(entity.id);
    }
  });
  
  return matchingEntities;
}

/**
 * Get related entities based on relationships
 */
export function getRelatedEntities(
  entityId: string,
  relationships: Relationship[]
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
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Format field information for display
 */
export function formatFieldInfo(field: Field): string {
  const parts = [field.name];
  
  if (field.isPK) parts.push('(PK)');
  if (field.isFK) parts.push('(FK)');
  
  return parts.join(' ');
}

/**
 * Check if browser supports required features
 */
export function checkBrowserSupport(): {
  supported: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  if (!window.SVGElement) missing.push('SVG');
  if (!window.requestAnimationFrame) missing.push('requestAnimationFrame');
  if (!Element.prototype.classList) missing.push('classList');
  if (!document.querySelector) missing.push('querySelector');
  
  return {
    supported: missing.length === 0,
    missing
  };
}

/**
 * Create a unique ID
 */
export function createUniqueId(prefix = 'erd'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Batch DOM updates for performance
 */
export function batchUpdates(updates: (() => void)[]): void {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

/**
 * Calculate relationship path
 */
export function calculateRelationshipPath(
  fromPos: Position,
  toPos: Position,
  fromWidth: number = 250,
  fromHeight: number = 100
): string {
  const startX = fromPos.x + fromWidth;
  const startY = fromPos.y + fromHeight / 2;
  const endX = toPos.x;
  const endY = toPos.y + fromHeight / 2;
  
  // Calculate control points for smooth curve
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const controlOffset = Math.abs(endX - startX) * 0.3;
  
  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}