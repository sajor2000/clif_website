/**
 * State management for the Interactive ERD Component
 * @module ERDState
 */

import type { 
  UIState, 
  Transform, 
  Entity, 
  Relationship,
  ERDEventHandlers 
} from '../types/ERDTypes';
import { getRelatedEntities } from './ERDUtils';

/**
 * State management class for ERD component
 */
export class ERDState {
  private state: UIState;
  private listeners: Set<(state: UIState) => void> = new Set();
  private eventHandlers: ERDEventHandlers;
  private entities: Entity[] = [];
  private relationships: Relationship[] = [];

  constructor(
    initialState?: Partial<UIState>,
    eventHandlers?: ERDEventHandlers
  ) {
    this.state = {
      selectedEntity: null,
      highlightedEntities: new Set(),
      dimmedEntities: new Set(),
      searchQuery: '',
      showRelationships: true,
      isPanning: false,
      transform: { x: 0, y: 0, scale: 0.8 },
      detailsPanelOpen: false,
      ...initialState
    };
    
    this.eventHandlers = eventHandlers || {};
  }

  /**
   * Get current state
   */
  getState(): Readonly<UIState> {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: UIState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<UIState>): void {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify listeners
    this.listeners.forEach(listener => listener(this.state));
    
    // Call event handlers if applicable
    if (updates.transform && this.eventHandlers.onTransformChange) {
      this.eventHandlers.onTransformChange(this.state.transform);
    }
    
    if (updates.searchQuery !== undefined && this.eventHandlers.onSearchChange) {
      this.eventHandlers.onSearchChange(this.state.searchQuery);
    }
  }

  /**
   * Set entities and relationships
   */
  setData(entities: Entity[], relationships: Relationship[]): void {
    this.entities = entities;
    this.relationships = relationships;
  }

  /**
   * Select an entity
   */
  selectEntity(entityId: string | null): void {
    if (!entityId) {
      this.updateState({
        selectedEntity: null,
        highlightedEntities: new Set(),
        dimmedEntities: new Set(),
        detailsPanelOpen: false
      });
      return;
    }

    const entity = this.entities.find(e => e.id === entityId);
    if (!entity) return;

    // Get related entities
    const relatedIds = getRelatedEntities(entityId, this.relationships);
    
    // Create sets for highlighting
    const highlightedEntities = new Set([entityId]);
    const dimmedEntities = new Set<string>();
    
    this.entities.forEach(e => {
      if (e.id !== entityId && !relatedIds.has(e.id)) {
        dimmedEntities.add(e.id);
      }
    });

    this.updateState({
      selectedEntity: entityId,
      highlightedEntities,
      dimmedEntities,
      detailsPanelOpen: true
    });

    // Call event handler
    if (this.eventHandlers.onEntitySelect) {
      this.eventHandlers.onEntitySelect(entity);
    }
  }

  /**
   * Update search query
   */
  setSearchQuery(query: string): void {
    this.updateState({ searchQuery: query });
  }

  /**
   * Update highlighted entities based on search
   */
  updateHighlightedEntities(entityIds: Set<string>): void {
    const dimmedEntities = new Set<string>();
    
    if (entityIds.size > 0) {
      this.entities.forEach(entity => {
        if (!entityIds.has(entity.id)) {
          dimmedEntities.add(entity.id);
        }
      });
    }

    this.updateState({
      highlightedEntities: entityIds,
      dimmedEntities
    });
  }

  /**
   * Toggle relationship visibility
   */
  toggleRelationships(): void {
    this.updateState({
      showRelationships: !this.state.showRelationships
    });
  }

  /**
   * Update transform
   */
  setTransform(transform: Partial<Transform>): void {
    this.updateState({
      transform: { ...this.state.transform, ...transform }
    });
  }

  /**
   * Start panning
   */
  startPanning(): void {
    this.updateState({ isPanning: true });
  }

  /**
   * Stop panning
   */
  stopPanning(): void {
    this.updateState({ isPanning: false });
  }

  /**
   * Close details panel
   */
  closeDetailsPanel(): void {
    this.updateState({
      detailsPanelOpen: false,
      selectedEntity: null,
      highlightedEntities: new Set(),
      dimmedEntities: new Set()
    });
  }

  /**
   * Reset view
   */
  resetView(): void {
    this.updateState({
      transform: { x: 0, y: 0, scale: 0.8 },
      selectedEntity: null,
      highlightedEntities: new Set(),
      dimmedEntities: new Set(),
      searchQuery: '',
      detailsPanelOpen: false
    });
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.updateState({
      searchQuery: '',
      highlightedEntities: new Set(),
      dimmedEntities: new Set()
    });
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(key: string): void {
    const { selectedEntity, highlightedEntities } = this.state;
    
    switch (key) {
      case 'Escape':
        if (this.state.detailsPanelOpen) {
          this.closeDetailsPanel();
        } else if (this.state.searchQuery) {
          this.clearSearch();
        }
        break;
        
      case 'Tab':
        // Navigate through entities
        if (this.entities.length > 0) {
          const currentIndex = selectedEntity 
            ? this.entities.findIndex(e => e.id === selectedEntity)
            : -1;
          const nextIndex = (currentIndex + 1) % this.entities.length;
          this.selectEntity(this.entities[nextIndex].id);
        }
        break;
        
      case 'Enter':
        // Select first highlighted entity if any
        if (highlightedEntities.size > 0 && !selectedEntity) {
          const firstHighlighted = Array.from(highlightedEntities)[0];
          this.selectEntity(firstHighlighted);
        }
        break;
    }
  }

  /**
   * Get entity by ID
   */
  getEntity(entityId: string): Entity | undefined {
    return this.entities.find(e => e.id === entityId);
  }

  /**
   * Get selected entity
   */
  getSelectedEntity(): Entity | null {
    return this.state.selectedEntity 
      ? this.getEntity(this.state.selectedEntity) || null
      : null;
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.listeners.clear();
    this.entities = [];
    this.relationships = [];
  }
}