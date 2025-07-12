// Main Interactive ERD Canvas Component - Client-side TypeScript
import type {
  ERDEntity,
  ERDRelationship,
  ERDTransform,
  ERDConfig,
  ERDTheme,
  ERDState,
  ERDEventHandlers,
  ERDSearchOptions,
  ERDAccessibilityConfig
} from './ERDTypes';

import {
  debounce,
  throttle,
  calculateEntityDimensions,
  searchEntities,
  calculateConnectionPoints,
  getRelatedEntities,
  generateRelationshipPath,
  isPointInEntity,
  calculateViewportBounds,
  getBreakpoint,
  formatFieldName,
  generateId,
  prefersReducedMotion,
  prefersHighContrast,
  clamp,
  screenToSVG
} from './ERDUtils';

import {
  defaultTheme,
  defaultConfig,
  getPreferredTheme,
  getResponsiveConfig,
  getAnimationCSS,
  getResponsiveFontSizes,
  getResponsiveStrokeWidth,
  applyThemeToSVG,
  createLegendHTML
} from './ERDTheme';

export class ERDCanvas {
  private container: HTMLElement;
  private svg!: SVGSVGElement;
  private entitiesGroup!: SVGGElement;
  private relationshipsGroup!: SVGGElement;
  private detailsPanel!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private legendContainer!: HTMLElement;
  private tooltip!: HTMLElement;

  private entities: ERDEntity[] = [];
  private relationships: ERDRelationship[] = [];
  private state: ERDState;
  private config: ERDConfig;
  private theme: ERDTheme;
  private eventHandlers: ERDEventHandlers;
  private accessibilityConfig: ERDAccessibilityConfig;

  private resizeObserver: ResizeObserver | null = null;
  private debouncedSearch: (query: string) => void;
  private throttledPan: (x: number, y: number) => void;
  private animationFrameId: number | null = null;

  constructor(
    containerId: string,
    entities: ERDEntity[],
    relationships: ERDRelationship[],
    options: {
      config?: Partial<ERDConfig>;
      theme?: Partial<ERDTheme>;
      eventHandlers?: ERDEventHandlers;
      accessibilityConfig?: Partial<ERDAccessibilityConfig>;
    } = {}
  ) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    this.container = container;
    this.entities = entities;
    this.relationships = relationships;
    
    // Initialize configuration
    this.config = { ...getResponsiveConfig(window.innerWidth), ...options.config };
    this.theme = { ...getPreferredTheme(), ...options.theme };
    this.eventHandlers = options.eventHandlers || {};
    this.accessibilityConfig = {
      enableKeyboardNavigation: true,
      enableScreenReader: true,
      enableHighContrast: prefersHighContrast(),
      enableReducedMotion: prefersReducedMotion(),
      ...options.accessibilityConfig
    };

    // Initialize state
    this.state = {
      selectedEntity: null,
      hoveredEntity: null,
      highlightedEntities: new Set(),
      dimmedEntities: new Set(),
      searchQuery: '',
      searchResults: [],
      showRelationships: true,
      viewportTransform: { x: 0, y: 0, scale: this.config.initialScale },
      isDetailsPanel: false,
      isDragging: false,
      isLoading: false,
      error: null
    };

    // Initialize debounced and throttled functions
    this.debouncedSearch = debounce(this.performSearch.bind(this), 300);
    this.throttledPan = throttle(this.updateTransform.bind(this), 16); // ~60fps

    this.initialize();
  }

  private initialize(): void {
    try {
      this.state.isLoading = true;
      this.createDOMStructure();
      this.setupEventListeners();
      this.renderEntities();
      this.renderRelationships();
      this.setupAccessibility();
      this.updateLegend();
      this.fitToView();
      this.state.isLoading = false;
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Failed to initialize ERD';
      this.showError();
    }
  }

  private createDOMStructure(): void {
    this.container.innerHTML = `
      <div class="erd-container" style="position: relative; height: 100%; background: #f5f5f5; border-radius: 8px; overflow: hidden;">
        <!-- Controls -->
        <div class="erd-controls" style="position: absolute; top: 20px; left: 20px; z-index: 10; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; gap: 10px; align-items: center;">
          <input type="search" id="erd-search" placeholder="Search entities or fields..." style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; width: 250px; font-size: 14px;" aria-label="Search entities or fields">
          <button id="erd-reset-view" class="erd-btn" aria-label="Reset view">Reset View</button>
          <button id="erd-toggle-relationships" class="erd-btn" aria-label="Toggle relationships">Toggle Relationships</button>
          <button id="erd-fullscreen" class="erd-btn" aria-label="Toggle fullscreen">Fullscreen</button>
        </div>

        <!-- Main SVG Canvas -->
        <div class="erd-canvas-wrapper" style="width: 100%; height: 100%; overflow: hidden; cursor: grab;" tabindex="0" role="application" aria-label="Interactive Entity Relationship Diagram">
          <svg id="erd-svg" viewBox="0 0 4000 2500" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; transition: transform 0.3s ease;">
            <defs>
              <marker id="erd-arrow" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,12 L12,6 z" fill="var(--erd-color-relationship, #333)" />
              </marker>
              <filter id="erd-drop-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.2"/>
              </filter>
            </defs>
            <g id="erd-relationships"></g>
            <g id="erd-entities"></g>
          </svg>
        </div>

        <!-- Details Panel -->
        <aside id="erd-details-panel" class="erd-details-panel" style="position: absolute; right: -400px; top: 0; width: 400px; height: 100%; background: white; box-shadow: -2px 0 10px rgba(0,0,0,0.1); transition: right 0.3s ease; overflow-y: auto; z-index: 9;" role="complementary" aria-hidden="true">
          <div class="erd-panel-header" style="padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
            <h2 id="erd-entity-name" style="margin: 0;">Entity Details</h2>
            <button id="erd-close-details" class="erd-close-btn" aria-label="Close details panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d;">&times;</button>
          </div>
          <div class="erd-panel-content" style="padding: 20px;">
            <h3>Fields</h3>
            <ul id="erd-field-list" class="erd-field-list" style="list-style: none; margin-top: 10px; padding: 0;"></ul>
            <h3 style="margin-top: 20px;">Relationships</h3>
            <ul id="erd-relationship-list" class="erd-field-list" style="list-style: none; margin-top: 10px; padding: 0;"></ul>
          </div>
        </aside>

        <!-- Legend -->
        <div id="erd-legend" class="erd-legend" style="position: absolute; bottom: 20px; left: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"></div>

        <!-- Zoom Controls -->
        <div class="erd-zoom-controls" style="position: absolute; bottom: 20px; right: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
          <button id="erd-zoom-in" class="erd-zoom-btn" aria-label="Zoom in" style="background: none; border: none; width: 40px; height: 40px; font-size: 20px; cursor: pointer; transition: background 0.3s;">+</button>
          <button id="erd-zoom-out" class="erd-zoom-btn" aria-label="Zoom out" style="background: none; border: none; width: 40px; height: 40px; font-size: 20px; cursor: pointer; transition: background 0.3s;">−</button>
          <button id="erd-zoom-fit" class="erd-zoom-btn" aria-label="Fit to view" style="background: none; border: none; width: 40px; height: 40px; font-size: 20px; cursor: pointer; transition: background 0.3s;">⊡</button>
        </div>

        <!-- Tooltip -->
        <div id="erd-tooltip" class="erd-tooltip" style="position: absolute; background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 14px; pointer-events: none; opacity: 0; transition: opacity 0.3s; z-index: 11;"></div>

        <!-- Loading Indicator -->
        <div id="erd-loading" class="erd-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: none;">
          <div style="text-align: center;">Loading ERD...</div>
        </div>

        <!-- Error Message -->
        <div id="erd-error" class="erd-error" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; border: 1px solid #f5c6cb; display: none; max-width: 400px;">
          <strong>Error:</strong> <span id="erd-error-message"></span>
        </div>
      </div>
    `;

    // Apply theme styles
    const style = document.createElement('style');
    style.textContent = this.generateCSS();
    this.container.appendChild(style);

    // Get references to elements
    this.svg = this.container.querySelector('#erd-svg') as SVGSVGElement;
    this.entitiesGroup = this.container.querySelector('#erd-entities') as SVGGElement;
    this.relationshipsGroup = this.container.querySelector('#erd-relationships') as SVGGElement;
    this.detailsPanel = this.container.querySelector('#erd-details-panel') as HTMLElement;
    this.searchInput = this.container.querySelector('#erd-search') as HTMLInputElement;
    this.legendContainer = this.container.querySelector('#erd-legend') as HTMLElement;
    this.tooltip = this.container.querySelector('#erd-tooltip') as HTMLElement;

    // Apply theme to SVG
    applyThemeToSVG(this.svg, this.theme);
  }

  private generateCSS(): string {
    return `
      ${getAnimationCSS(this.accessibilityConfig.enableReducedMotion)}
      
      .erd-btn {
        padding: 8px 16px;
        background: var(--erd-color-beta, #841839);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.3s;
      }
      
      .erd-btn:hover {
        background: var(--erd-color-beta, #6d1430);
      }
      
      .erd-btn:focus {
        outline: 2px solid var(--erd-color-beta, #841839);
        outline-offset: 2px;
      }
      
      .erd-zoom-btn:hover {
        background: #f8f9fa;
      }
      
      .erd-zoom-btn:focus {
        outline: 2px solid var(--erd-color-beta, #841839);
        outline-offset: 2px;
      }
      
      .erd-field-item {
        padding: 8px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .erd-field-name {
        font-weight: 500;
      }
      
      .erd-field-type {
        color: #6c757d;
        font-size: 0.9em;
      }
      
      .erd-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75em;
        font-weight: 500;
        margin-left: 8px;
      }
      
      .erd-badge-pk {
        background: var(--erd-color-beta, #841839);
        color: white;
      }
      
      .erd-badge-fk {
        background: #6c757d;
        color: white;
      }
      
      .erd-legend-title {
        margin: 0 0 10px 0;
        font-size: 14px;
        font-weight: 600;
      }
      
      .erd-legend-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .erd-legend-item:last-child {
        margin-bottom: 0;
      }
      
      .erd-legend-color {
        width: 20px;
        height: 20px;
        border-radius: 2px;
        margin-right: 10px;
        border: 1px solid #ddd;
      }
      
      @media (max-width: 768px) {
        .erd-controls {
          flex-direction: column;
          align-items: stretch;
          max-width: calc(100vw - 40px);
        }
        
        .erd-controls input {
          width: 100% !important;
          margin-bottom: 10px;
        }
        
        .erd-details-panel {
          width: 100% !important;
          right: -100% !important;
        }
        
        .erd-legend {
          display: none;
        }
      }
      
      @media (prefers-contrast: high) {
        .erd-btn {
          border: 2px solid black;
        }
        
        .erd-zoom-btn {
          border: 1px solid black;
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    `;
  }

  private setupEventListeners(): void {
    // Search functionality
    this.searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.state.searchQuery = query;
      this.debouncedSearch(query);
    });

    // Control buttons
    const resetBtn = this.container.querySelector('#erd-reset-view') as HTMLButtonElement;
    const toggleRelBtn = this.container.querySelector('#erd-toggle-relationships') as HTMLButtonElement;
    const fullscreenBtn = this.container.querySelector('#erd-fullscreen') as HTMLButtonElement;
    
    resetBtn.addEventListener('click', () => this.resetView());
    toggleRelBtn.addEventListener('click', () => this.toggleRelationships());
    fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    // Zoom controls
    const zoomInBtn = this.container.querySelector('#erd-zoom-in') as HTMLButtonElement;
    const zoomOutBtn = this.container.querySelector('#erd-zoom-out') as HTMLButtonElement;
    const zoomFitBtn = this.container.querySelector('#erd-zoom-fit') as HTMLButtonElement;
    
    zoomInBtn.addEventListener('click', () => this.zoomIn());
    zoomOutBtn.addEventListener('click', () => this.zoomOut());
    zoomFitBtn.addEventListener('click', () => this.fitToView());

    // Details panel
    const closeDetailsBtn = this.container.querySelector('#erd-close-details') as HTMLButtonElement;
    closeDetailsBtn.addEventListener('click', () => this.closeDetailsPanel());

    // Canvas interactions
    const canvasWrapper = this.container.querySelector('.erd-canvas-wrapper') as HTMLElement;
    this.setupCanvasInteractions(canvasWrapper);

    // Keyboard navigation
    if (this.accessibilityConfig.enableKeyboardNavigation) {
      this.setupKeyboardNavigation();
    }

    // Resize observer for responsive behavior
    this.setupResizeObserver();

    // Theme change listeners
    this.setupThemeListeners();
  }

  private setupCanvasInteractions(canvasWrapper: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    
    // Mouse/touch events for pan and zoom
    canvasWrapper.addEventListener('mousedown', (e) => {
      if (e.target === canvasWrapper || e.target === this.svg) {
        this.state.isDragging = true;
        startX = e.clientX - this.state.viewportTransform.x;
        startY = e.clientY - this.state.viewportTransform.y;
        canvasWrapper.style.cursor = 'grabbing';
      }
    });

    canvasWrapper.addEventListener('mousemove', (e) => {
      if (this.state.isDragging) {
        const newX = e.clientX - startX;
        const newY = e.clientY - startY;
        this.throttledPan(newX, newY);
      }
    });

    canvasWrapper.addEventListener('mouseup', () => {
      this.state.isDragging = false;
      canvasWrapper.style.cursor = 'grab';
    });

    canvasWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(delta, e.clientX, e.clientY);
    });

    // Touch events for mobile
    let lastTouchDistance = 0;
    canvasWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      }
    });

    canvasWrapper.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        if (lastTouchDistance > 0) {
          const scale = currentDistance / lastTouchDistance;
          const centerX = (touch1.clientX + touch2.clientX) / 2;
          const centerY = (touch1.clientY + touch2.clientY) / 2;
          this.zoom(scale, centerX, centerY);
        }
        
        lastTouchDistance = currentDistance;
      }
    });
  }

  private setupKeyboardNavigation(): void {
    const canvasWrapper = this.container.querySelector('.erd-canvas-wrapper') as HTMLElement;
    
    canvasWrapper.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this.closeDetailsPanel();
          this.clearSelection();
          break;
        case 'Enter':
        case ' ':
          if (this.state.hoveredEntity) {
            e.preventDefault();
            this.selectEntity(this.state.hoveredEntity);
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          this.navigateWithKeyboard(e.key);
          break;
        case '+':
        case '=':
          e.preventDefault();
          this.zoomIn();
          break;
        case '-':
          e.preventDefault();
          this.zoomOut();
          break;
        case '0':
          e.preventDefault();
          this.fitToView();
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.searchInput.focus();
          }
          break;
      }
    });
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const newConfig = getResponsiveConfig(width);
        
        if (JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
          this.config = newConfig;
          this.handleResize();
        }
      }
    });
    
    this.resizeObserver.observe(this.container);
  }

  private setupThemeListeners(): void {
    // Listen for system theme changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    const updateTheme = () => {
      this.theme = getPreferredTheme();
      applyThemeToSVG(this.svg, this.theme);
      this.updateLegend();
    };
    
    darkModeQuery.addEventListener('change', updateTheme);
    highContrastQuery.addEventListener('change', updateTheme);
  }

  private performSearch(query: string): void {
    const searchOptions: ERDSearchOptions = {
      searchInFields: true,
      searchInDescriptions: true,
      caseSensitive: false,
      maturityFilter: ['beta', 'concept', 'future']
    };
    
    const results = searchEntities(this.entities, query, searchOptions);
    this.state.searchResults = results;
    
    if (query.length === 0) {
      this.clearHighlights();
    } else {
      this.highlightSearchResults(results);
    }
    
    this.eventHandlers.onSearch?.(query, results);
  }

  private renderEntities(): void {
    this.entitiesGroup.innerHTML = '';
    
    this.entities.forEach(entity => {
      const entityElement = this.createEntityElement(entity);
      this.entitiesGroup.appendChild(entityElement);
    });
  }

  private createEntityElement(entity: ERDEntity): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('erd-entity');
    g.classList.add(`erd-maturity-${entity.maturity}`);
    g.setAttribute('data-entity', entity.id);
    g.setAttribute('transform', `translate(${entity.position.x}, ${entity.position.y})`);
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Entity: ${entity.name}`);
    g.setAttribute('tabindex', '0');

    const dimensions = calculateEntityDimensions(entity, this.config);
    
    // Entity background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('erd-entity-rect');
    rect.setAttribute('width', dimensions.width.toString());
    rect.setAttribute('height', dimensions.height.toString());
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', this.theme.colors.entityBackground);
    rect.setAttribute('stroke', this.theme.colors.entityBorder);
    rect.setAttribute('stroke-width', '2');
    g.appendChild(rect);

    // Header background
    const headerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    headerRect.classList.add('erd-entity-header');
    headerRect.setAttribute('width', dimensions.width.toString());
    headerRect.setAttribute('height', this.config.entityHeaderHeight.toString());
    headerRect.setAttribute('rx', '4');
    headerRect.setAttribute('fill', this.theme.colors[entity.maturity]);
    g.appendChild(headerRect);

    // Entity name
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.classList.add('erd-entity-name');
    nameText.setAttribute('x', '10');
    nameText.setAttribute('y', (this.config.entityHeaderHeight / 2 + 5).toString());
    nameText.setAttribute('fill', 'white');
    nameText.setAttribute('font-family', this.theme.fonts.entityName);
    nameText.setAttribute('font-weight', 'bold');
    nameText.setAttribute('font-size', '12');
    nameText.textContent = entity.name;
    g.appendChild(nameText);

    // Maturity badge
    const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badgeText.classList.add('erd-maturity-badge');
    badgeText.setAttribute('x', (dimensions.width - 10).toString());
    badgeText.setAttribute('y', (this.config.entityHeaderHeight / 2 + 4).toString());
    badgeText.setAttribute('text-anchor', 'end');
    badgeText.setAttribute('fill', 'white');
    badgeText.setAttribute('font-size', '10');
    badgeText.textContent = entity.maturity.toUpperCase();
    g.appendChild(badgeText);

    // Fields (show first 4)
    const fieldsToShow = entity.fields.slice(0, 4);
    fieldsToShow.forEach((field, index) => {
      const yPos = this.config.entityHeaderHeight + this.config.padding + 
                   (index * this.config.fieldHeight) + this.config.fieldHeight/2;

      // Field name
      const fieldText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      fieldText.classList.add('erd-field-text');
      fieldText.setAttribute('x', '8');
      fieldText.setAttribute('y', (yPos + 3).toString());
      fieldText.setAttribute('fill', this.theme.colors.text);
      fieldText.setAttribute('font-family', this.theme.fonts.fieldText);
      fieldText.setAttribute('font-size', '11');
      fieldText.textContent = formatFieldName(field.name, 20);
      if (field.isPK || field.isFK) {
        fieldText.setAttribute('font-weight', 'bold');
      }
      g.appendChild(fieldText);

      // Field type
      const typeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      typeText.classList.add('erd-field-type');
      typeText.setAttribute('x', (dimensions.width - 8).toString());
      typeText.setAttribute('y', (yPos + 3).toString());
      typeText.setAttribute('text-anchor', 'end');
      typeText.setAttribute('fill', this.theme.colors.textSecondary);
      typeText.setAttribute('font-family', this.theme.fonts.fieldType);
      typeText.setAttribute('font-size', '10');
      typeText.textContent = field.type;
      g.appendChild(typeText);
    });

    // Event listeners
    g.addEventListener('click', () => this.selectEntity(entity));
    g.addEventListener('mouseenter', () => this.showEntityTooltip(entity, g));
    g.addEventListener('mouseleave', () => this.hideTooltip());
    g.addEventListener('focus', () => this.state.hoveredEntity = entity);
    g.addEventListener('blur', () => this.state.hoveredEntity = null);

    return g;
  }

  private renderRelationships(): void {
    this.relationshipsGroup.innerHTML = '';
    
    if (!this.state.showRelationships) return;
    
    this.relationships.forEach(rel => {
      const pathElement = this.createRelationshipElement(rel);
      this.relationshipsGroup.appendChild(pathElement);
    });
  }

  private createRelationshipElement(relationship: ERDRelationship): SVGPathElement {
    const fromEntity = this.entities.find(e => e.id === relationship.from);
    const toEntity = this.entities.find(e => e.id === relationship.to);
    
    if (!fromEntity || !toEntity) {
      throw new Error(`Entity not found for relationship: ${relationship.from} -> ${relationship.to}`);
    }

    const connectionPoints = calculateConnectionPoints(fromEntity, toEntity, this.config);
    const pathData = generateRelationshipPath(
      connectionPoints.fromX,
      connectionPoints.fromY,
      connectionPoints.toX,
      connectionPoints.toY
    );

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('erd-relationship');
    path.setAttribute('data-from', relationship.from);
    path.setAttribute('data-to', relationship.to);
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', this.theme.colors.relationshipLine);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('marker-end', 'url(#erd-arrow)');

    return path;
  }

  private selectEntity(entity: ERDEntity): void {
    this.state.selectedEntity = entity;
    this.showDetailsPanel(entity);
    this.highlightRelatedEntities(entity.id);
    this.eventHandlers.onEntityClick?.(entity);
  }

  private showDetailsPanel(entity: ERDEntity): void {
    const entityNameEl = this.container.querySelector('#erd-entity-name') as HTMLElement;
    const fieldListEl = this.container.querySelector('#erd-field-list') as HTMLElement;
    const relationshipListEl = this.container.querySelector('#erd-relationship-list') as HTMLElement;

    entityNameEl.textContent = entity.name.toUpperCase();
    
    // Populate fields
    fieldListEl.innerHTML = '';
    entity.fields.forEach(field => {
      const li = document.createElement('li');
      li.className = 'erd-field-item';
      li.innerHTML = `
        <span class="erd-field-name">${field.name}</span>
        <span>
          <span class="erd-field-type">${field.type}</span>
          ${field.isPK ? '<span class="erd-badge erd-badge-pk">PK</span>' : ''}
          ${field.isFK ? '<span class="erd-badge erd-badge-fk">FK</span>' : ''}
        </span>
      `;
      fieldListEl.appendChild(li);
    });

    // Populate relationships
    relationshipListEl.innerHTML = '';
    const entityRels = this.relationships.filter(r => r.from === entity.id || r.to === entity.id);
    entityRels.forEach(rel => {
      const li = document.createElement('li');
      li.className = 'erd-field-item';
      const isFrom = rel.from === entity.id;
      li.innerHTML = `
        <span>${isFrom ? 'References' : 'Referenced by'}</span>
        <span class="erd-field-type">${isFrom ? rel.to : rel.from}</span>
      `;
      relationshipListEl.appendChild(li);
    });

    this.detailsPanel.style.right = '0';
    this.detailsPanel.setAttribute('aria-hidden', 'false');
    this.state.isDetailsPanel = true;
  }

  private closeDetailsPanel(): void {
    this.detailsPanel.style.right = '-400px';
    this.detailsPanel.setAttribute('aria-hidden', 'true');
    this.state.isDetailsPanel = false;
    this.state.selectedEntity = null;
    this.clearHighlights();
  }

  private highlightRelatedEntities(entityId: string): void {
    const relatedIds = getRelatedEntities(entityId, this.relationships);
    
    // Clear previous highlights
    this.clearHighlights();
    
    // Highlight related entities
    this.container.querySelectorAll('.erd-entity').forEach(el => {
      const id = el.getAttribute('data-entity');
      if (id === entityId || relatedIds.has(id!)) {
        el.classList.remove('erd-dimmed');
        if (id === entityId) {
          el.classList.add('erd-highlighted');
        }
      } else {
        el.classList.add('erd-dimmed');
      }
    });

    // Highlight related relationships
    this.container.querySelectorAll('.erd-relationship').forEach(el => {
      const from = el.getAttribute('data-from');
      const to = el.getAttribute('data-to');
      if (from === entityId || to === entityId) {
        el.classList.add('erd-highlighted');
        el.classList.remove('erd-dimmed');
      } else {
        el.classList.add('erd-dimmed');
      }
    });
  }

  private clearHighlights(): void {
    this.container.querySelectorAll('.erd-entity, .erd-relationship').forEach(el => {
      el.classList.remove('erd-highlighted', 'erd-dimmed');
    });
  }

  private highlightSearchResults(results: ERDEntity[]): void {
    const resultIds = new Set(results.map(e => e.id));
    
    this.container.querySelectorAll('.erd-entity').forEach(el => {
      const id = el.getAttribute('data-entity');
      if (resultIds.has(id!)) {
        el.classList.add('erd-highlighted');
        el.classList.remove('erd-dimmed');
      } else {
        el.classList.add('erd-dimmed');
        el.classList.remove('erd-highlighted');
      }
    });
  }

  private showEntityTooltip(entity: ERDEntity, element: SVGGElement): void {
    const rect = element.getBoundingClientRect();
    this.tooltip.textContent = `${entity.name} (${entity.fields.length} fields)`;
    this.tooltip.style.left = rect.left + rect.width / 2 + 'px';
    this.tooltip.style.top = rect.top - 10 + 'px';
    this.tooltip.style.opacity = '1';
  }

  private hideTooltip(): void {
    this.tooltip.style.opacity = '0';
  }

  private updateTransform(): void {
    this.svg.style.transform = 
      `translate(${this.state.viewportTransform.x}px, ${this.state.viewportTransform.y}px) scale(${this.state.viewportTransform.scale})`;
    
    this.eventHandlers.onViewportChange?.(this.state.viewportTransform);
  }

  private zoom(factor: number, centerX?: number, centerY?: number): void {
    const newScale = clamp(
      this.state.viewportTransform.scale * factor,
      this.config.minScale,
      this.config.maxScale
    );
    
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom towards point
      const scaleDiff = newScale - this.state.viewportTransform.scale;
      this.state.viewportTransform.x -= (centerX - this.state.viewportTransform.x) * scaleDiff / this.state.viewportTransform.scale;
      this.state.viewportTransform.y -= (centerY - this.state.viewportTransform.y) * scaleDiff / this.state.viewportTransform.scale;
    }
    
    this.state.viewportTransform.scale = newScale;
    this.updateTransform();
  }

  private zoomIn(): void {
    this.zoom(1.2);
  }

  private zoomOut(): void {
    this.zoom(0.8);
  }

  private resetView(): void {
    this.state.viewportTransform = { x: 0, y: 0, scale: this.config.initialScale };
    this.updateTransform();
  }

  private fitToView(): void {
    const bounds = calculateViewportBounds(this.entities, this.config);
    const containerRect = this.container.getBoundingClientRect();
    
    const scaleX = containerRect.width / bounds.width;
    const scaleY = containerRect.height / bounds.height;
    const scale = Math.min(scaleX, scaleY, this.config.maxScale);
    
    this.state.viewportTransform = {
      x: (containerRect.width - bounds.width * scale) / 2 - bounds.minX * scale,
      y: (containerRect.height - bounds.height * scale) / 2 - bounds.minY * scale,
      scale
    };
    
    this.updateTransform();
  }

  private toggleRelationships(): void {
    this.state.showRelationships = !this.state.showRelationships;
    this.relationshipsGroup.style.display = this.state.showRelationships ? 'block' : 'none';
    
    const toggleBtn = this.container.querySelector('#erd-toggle-relationships') as HTMLButtonElement;
    toggleBtn.textContent = this.state.showRelationships ? 'Hide Relationships' : 'Show Relationships';
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  private navigateWithKeyboard(direction: string): void {
    // Implement keyboard navigation between entities
    // This would cycle through entities based on arrow key direction
  }

  private handleResize(): void {
    // Recalculate entity dimensions and rerender
    this.renderEntities();
    this.renderRelationships();
  }

  private clearSelection(): void {
    this.state.selectedEntity = null;
    this.clearHighlights();
  }

  private updateLegend(): void {
    this.legendContainer.innerHTML = createLegendHTML(this.theme);
  }

  private showError(): void {
    const errorEl = this.container.querySelector('#erd-error') as HTMLElement;
    const errorMessageEl = this.container.querySelector('#erd-error-message') as HTMLElement;
    
    errorMessageEl.textContent = this.state.error || 'Unknown error occurred';
    errorEl.style.display = 'block';
  }

  private setupAccessibility(): void {
    // Set up ARIA live regions for screen reader announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    this.container.appendChild(liveRegion);
  }

  // Public API methods
  public updateEntities(entities: ERDEntity[]): void {
    this.entities = entities;
    this.renderEntities();
    this.renderRelationships();
  }

  public updateRelationships(relationships: ERDRelationship[]): void {
    this.relationships = relationships;
    this.renderRelationships();
  }

  public getSelectedEntity(): ERDEntity | null {
    return this.state.selectedEntity;
  }

  public setTheme(theme: Partial<ERDTheme>): void {
    this.theme = { ...this.theme, ...theme };
    applyThemeToSVG(this.svg, this.theme);
    this.updateLegend();
    this.renderEntities();
    this.renderRelationships();
  }

  public exportSVG(): string {
    return new XMLSerializer().serializeToString(this.svg);
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Remove all event listeners and clear state
    this.state = {} as ERDState;
  }
}

// Export factory function for easier instantiation
export function createERD(
  containerId: string,
  entities: ERDEntity[],
  relationships: ERDRelationship[],
  options?: {
    config?: Partial<ERDConfig>;
    theme?: Partial<ERDTheme>;
    eventHandlers?: ERDEventHandlers;
    accessibilityConfig?: Partial<ERDAccessibilityConfig>;
  }
): ERDCanvas {
  return new ERDCanvas(containerId, entities, relationships, options);
}