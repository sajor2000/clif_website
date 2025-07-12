// Client-side ERD initialization for Astro
import { createERD } from './ERDCanvas';
import type { ERDEntity, ERDRelationship, ERDEventHandlers } from './ERDTypes';

export interface ERDClientConfig {
  containerId: string;
  entities: ERDEntity[];
  relationships: ERDRelationship[];
  enableAnalytics?: boolean;
  enableKeyboardNavigation?: boolean;
  enableSearch?: boolean;
}

export function initializeERD(config: ERDClientConfig) {
  const { 
    containerId, 
    entities, 
    relationships, 
    enableAnalytics = false,
    enableKeyboardNavigation = true,
    enableSearch = true 
  } = config;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`ERD container with id "${containerId}" not found`);
    return null;
  }

  try {
    // Remove loading state
    const loadingState = container.querySelector('.erd-loading-state');
    if (loadingState) {
      loadingState.remove();
    }

    // Event handlers for analytics and user feedback
    const eventHandlers: ERDEventHandlers = {};

    if (enableAnalytics && typeof window !== 'undefined' && 'gtag' in window) {
      eventHandlers.onEntityClick = (entity) => {
        (window as any).gtag('event', 'erd_entity_click', {
          entity_name: entity.name,
          entity_maturity: entity.maturity
        });
      };
      
      eventHandlers.onSearch = (query, results) => {
        if (query.length > 0) {
          (window as any).gtag('event', 'erd_search', {
            search_query: query,
            results_count: results.length
          });
        }
      };
      
      eventHandlers.onViewportChange = (transform) => {
        // Debounced viewport tracking
        clearTimeout((window as any).erdViewportTimeout);
        (window as any).erdViewportTimeout = setTimeout(() => {
          (window as any).gtag('event', 'erd_viewport_change', {
            scale: Math.round(transform.scale * 100) / 100,
            custom_parameters: {
              zoom_level: transform.scale > 1 ? 'zoomed_in' : 
                         transform.scale < 0.6 ? 'zoomed_out' : 'normal'
            }
          });
        }, 1000);
      };
    }

    // Configuration options
    const options = {
      eventHandlers,
      accessibilityConfig: {
        enableKeyboardNavigation,
        enableScreenReader: true,
        enableHighContrast: typeof window !== 'undefined' ? 
          window.matchMedia('(prefers-contrast: high)').matches : false,
        enableReducedMotion: typeof window !== 'undefined' ? 
          window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
      }
    } as const;

    // Create ERD instance
    const erdInstance = createERD(containerId, entities, relationships, options);
    
    // Store instance for external access
    if (typeof window !== 'undefined') {
      (window as any).erdInstance = erdInstance;
    }
    
    // Handle cleanup on page unload
    if (typeof window !== 'undefined') {
      const cleanup = () => erdInstance.destroy();
      window.addEventListener('beforeunload', cleanup);
      
      // Cleanup function for manual use
      return {
        instance: erdInstance,
        destroy: () => {
          cleanup();
          window.removeEventListener('beforeunload', cleanup);
        }
      };
    }

    return { instance: erdInstance, destroy: () => erdInstance.destroy() };

  } catch (error) {
    console.error('Failed to initialize ERD:', error);
    
    // Show error state
    container.innerHTML = `
      <div class="erd-error-state">
        <div class="erd-error-content">
          <h3>ERD Loading Error</h3>
          <p>Unable to load the interactive ERD. Please refresh the page or try again later.</p>
          <button onclick="window.location.reload()" class="erd-error-button">
            Refresh Page
          </button>
        </div>
      </div>
    `;

    // Track error for analytics
    if (enableAnalytics && typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'erd_load_error', {
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return null;
  }
}

// Auto-initialize ERDs found on the page
export function autoInitializeERDs() {
  if (typeof window === 'undefined') return;

  document.addEventListener('DOMContentLoaded', () => {
    const erdContainers = document.querySelectorAll('[data-erd-config]');
    
    erdContainers.forEach((container) => {
      try {
        const configData = container.getAttribute('data-erd-config');
        if (configData) {
          const config = JSON.parse(configData) as ERDClientConfig;
          initializeERD(config);
        }
      } catch (error) {
        console.error('Failed to auto-initialize ERD:', error);
      }
    });
  });
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).ERD = {
    initialize: initializeERD,
    autoInitialize: autoInitializeERDs
  };
}