/**
 * SVG Renderer for the Interactive ERD Component
 * @module ERDRenderer
 */

import type { Entity, Relationship, Field } from '../types/ERDTypes';
import type { ERDState } from './ERDState';
import { SVG_NS, CSS_CLASSES, DEFAULT_CONFIG } from '../config/ERDConstants';
import { calculateRelationshipPath, sanitizeHTML, batchUpdates } from './ERDUtils';

/**
 * Handles all SVG rendering for the ERD
 */
export class ERDRenderer {
  private svg: SVGElement;
  private entities: Entity[];
  private relationships: Relationship[];
  private state: ERDState;
  private entitiesGroup: SVGGElement | null;
  private relationshipsGroup: SVGGElement | null;
  private entityElements: Map<string, SVGGElement> = new Map();
  private relationshipElements: Map<string, SVGPathElement> = new Map();
  private config = DEFAULT_CONFIG;

  constructor(
    svg: SVGElement,
    entities: Entity[],
    relationships: Relationship[],
    state: ERDState
  ) {
    this.svg = svg;
    this.entities = entities;
    this.relationships = relationships;
    this.state = state;
    
    // Get groups
    this.entitiesGroup = svg.querySelector('.erd-entities');
    this.relationshipsGroup = svg.querySelector('.erd-relationships');
    
    // Subscribe to state changes
    this.state.subscribe(() => this.updateFromState());
  }

  /**
   * Initial render of all entities and relationships
   */
  async render(): Promise<void> {
    if (!this.entitiesGroup || !this.relationshipsGroup) {
      throw new Error('SVG groups not found');
    }

    // Clear existing content
    this.clear();

    // Render in batches for performance
    const entityBatches = this.createBatches(this.entities, 10);
    
    for (const batch of entityBatches) {
      await this.renderEntityBatch(batch);
    }

    // Render relationships
    this.renderRelationships();

    // Apply initial transform
    this.updateTransform();
  }

  /**
   * Create batches for rendering
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Render a batch of entities
   */
  private async renderEntityBatch(entities: Entity[]): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        batchUpdates(entities.map(entity => () => {
          const element = this.createEntityElement(entity);
          this.entitiesGroup!.appendChild(element);
          this.entityElements.set(entity.id, element);
        }));
        resolve();
      });
    });
  }

  /**
   * Create SVG element for an entity
   */
  private createEntityElement(entity: Entity): SVGGElement {
    const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    g.classList.add(CSS_CLASSES.entity, `maturity-${entity.maturity}`);
    g.setAttribute('data-entity', entity.id);
    g.setAttribute('transform', `translate(${entity.position.x}, ${entity.position.y})`);
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', `Table ${entity.name}`);

    const { dimensions, colors } = this.config;
    const width = dimensions.entityWidth;
    const headerHeight = dimensions.headerHeight;
    const fieldHeight = dimensions.fieldHeight;
    const padding = dimensions.padding;
    const height = headerHeight + (entity.fields.length * fieldHeight) + padding * 2;

    // Background rectangle
    const bgRect = this.createRect({
      class: CSS_CLASSES.entityRect,
      width,
      height,
      rx: 4,
      fill: 'white',
      stroke: '#ddd',
      'stroke-width': 1
    });
    g.appendChild(bgRect);

    // Header rectangle
    const headerRect = this.createRect({
      class: CSS_CLASSES.entityHeader,
      width,
      height: headerHeight,
      rx: 4,
      fill: colors[entity.maturity] || colors.beta
    });
    g.appendChild(headerRect);

    // Entity name
    const nameText = this.createText({
      class: CSS_CLASSES.entityName,
      x: 10,
      y: headerHeight / 2 + 5,
      fill: 'white',
      'font-weight': 'bold',
      'font-size': 14
    }, entity.name.toUpperCase());
    g.appendChild(nameText);

    // Maturity badge
    if (entity.maturity) {
      const badgeText = this.createText({
        class: CSS_CLASSES.maturityBadge,
        x: width - 10,
        y: headerHeight / 2 + 4,
        'text-anchor': 'end',
        fill: 'white',
        'font-size': 10,
        'font-weight': 'bold'
      }, entity.maturity.toUpperCase());
      g.appendChild(badgeText);
    }

    // Render fields
    entity.fields.forEach((field, index) => {
      const yPos = headerHeight + padding + (index * fieldHeight) + fieldHeight / 2;
      
      // Field name
      const fieldText = this.createText({
        class: CSS_CLASSES.fieldText,
        x: 10,
        y: yPos + 3,
        fill: '#333',
        'font-size': 12,
        'font-weight': field.isPK || field.isFK ? 'bold' : 'normal'
      }, field.name);
      g.appendChild(fieldText);

      // Field type
      const typeText = this.createText({
        class: CSS_CLASSES.fieldType,
        x: width - 10,
        y: yPos + 3,
        'text-anchor': 'end',
        fill: '#666',
        'font-size': 11,
        'font-family': 'monospace'
      }, field.type);
      g.appendChild(typeText);

      // Add PK/FK indicators
      if (field.isPK || field.isFK) {
        const indicator = this.createText({
          x: width - 50,
          y: yPos + 3,
          'text-anchor': 'end',
          fill: '#999',
          'font-size': 10,
          'font-weight': 'bold'
        }, field.isPK ? 'PK' : 'FK');
        g.appendChild(indicator);
      }
    });

    // Add event listeners
    this.addEntityEventListeners(g, entity);

    return g;
  }

  /**
   * Create SVG rect element
   */
  private createRect(attrs: Record<string, any>): SVGRectElement {
    const rect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') {
        rect.classList.add(value);
      } else {
        rect.setAttribute(key, String(value));
      }
    });
    return rect;
  }

  /**
   * Create SVG text element
   */
  private createText(attrs: Record<string, any>, content: string): SVGTextElement {
    const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') {
        text.classList.add(value);
      } else {
        text.setAttribute(key, String(value));
      }
    });
    text.textContent = content;
    return text;
  }

  /**
   * Add event listeners to entity
   */
  private addEntityEventListeners(element: SVGGElement, entity: Entity): void {
    // Click handler
    element.addEventListener('click', () => {
      this.state.selectEntity(entity.id);
    });

    // Keyboard handler
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.state.selectEntity(entity.id);
      }
    });

    // Hover handlers
    element.addEventListener('mouseenter', () => {
      if (!this.state.getState().selectedEntity) {
        element.classList.add('hover');
      }
    });

    element.addEventListener('mouseleave', () => {
      element.classList.remove('hover');
    });
  }

  /**
   * Render all relationships
   */
  private renderRelationships(): void {
    if (!this.relationshipsGroup) return;

    this.relationships.forEach(rel => {
      const fromEntity = this.entities.find(e => e.id === rel.from);
      const toEntity = this.entities.find(e => e.id === rel.to);
      
      if (!fromEntity || !toEntity) return;

      const path = document.createElementNS(SVG_NS, 'path') as SVGPathElement;
      path.classList.add(CSS_CLASSES.relationship);
      path.setAttribute('data-from', rel.from);
      path.setAttribute('data-to', rel.to);
      
      const d = calculateRelationshipPath(
        fromEntity.position,
        toEntity.position,
        this.config.dimensions.entityWidth,
        100 // Approximate entity height
      );
      
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#999');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('marker-end', `url(#${this.getMarkerId()})`);
      
      this.relationshipsGroup.appendChild(path);
      this.relationshipElements.set(`${rel.from}-${rel.to}`, path);
    });
  }

  /**
   * Get marker ID from SVG
   */
  private getMarkerId(): string {
    const marker = this.svg.querySelector('marker');
    return marker?.id || 'arrow';
  }

  /**
   * Update visual state based on application state
   */
  private updateFromState(): void {
    const state = this.state.getState();
    
    // Update entity highlights
    this.entityElements.forEach((element, id) => {
      element.classList.toggle(CSS_CLASSES.highlighted, 
        id === state.selectedEntity || state.highlightedEntities.has(id));
      element.classList.toggle(CSS_CLASSES.dimmed, 
        state.dimmedEntities.has(id));
      element.classList.toggle(CSS_CLASSES.selected, 
        id === state.selectedEntity);
    });

    // Update relationship highlights
    this.relationshipElements.forEach((element, key) => {
      const [from, to] = key.split('-');
      const isRelated = state.selectedEntity === from || state.selectedEntity === to;
      element.classList.toggle(CSS_CLASSES.highlighted, isRelated);
      element.classList.toggle(CSS_CLASSES.dimmed, 
        state.selectedEntity !== null && !isRelated);
    });
  }

  /**
   * Update transform based on state
   */
  updateTransform(): void {
    const { x, y, scale } = this.state.getState().transform;
    this.svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  /**
   * Toggle relationship visibility
   */
  toggleRelationships(): void {
    if (this.relationshipsGroup) {
      const show = this.state.getState().showRelationships;
      this.relationshipsGroup.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Update highlights (called from parent)
   */
  updateHighlights(): void {
    this.updateFromState();
  }

  /**
   * Clear all rendered content
   */
  private clear(): void {
    if (this.entitiesGroup) {
      this.entitiesGroup.innerHTML = '';
    }
    if (this.relationshipsGroup) {
      this.relationshipsGroup.innerHTML = '';
    }
    this.entityElements.clear();
    this.relationshipElements.clear();
  }

  /**
   * Destroy renderer and clean up
   */
  destroy(): void {
    this.clear();
    // Remove event listeners if needed
  }
}