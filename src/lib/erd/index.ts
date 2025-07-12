// ERD Component Library - Main Export File
export type * from './ERDTypes';
export * from './ERDUtils';
export * from './ERDTheme';
export { ERDCanvas, createERD } from './ERDCanvas';
export { initializeERD, autoInitializeERDs } from './ERDClient';

// Re-export commonly used types for convenience
export type {
  ERDEntity,
  ERDRelationship,
  ERDTransform,
  ERDConfig,
  ERDTheme,
  ERDState,
  ERDEventHandlers,
  MaturityLevel
} from './ERDTypes';

// Re-export utility functions
export {
  debounce,
  throttle,
  searchEntities,
  calculateConnectionPoints,
  getRelatedEntities,
  validateEntity,
  clamp,
  getBreakpoint
} from './ERDUtils';

// Re-export theme functions
export {
  defaultTheme,
  darkTheme,
  highContrastTheme,
  defaultConfig,
  mobileConfig,
  tabletConfig,
  getPreferredTheme,
  getResponsiveConfig
} from './ERDTheme';

// Version information
export const ERD_VERSION = '1.0.0';
export const ERD_BUILD_DATE = new Date().toISOString();

// Default configuration for quick setup
export const ERD_DEFAULTS = {
  theme: 'auto', // 'light' | 'dark' | 'high-contrast' | 'auto'
  responsive: true,
  accessibility: {
    enableKeyboardNavigation: true,
    enableScreenReader: true,
    enableHighContrast: false, // Will be auto-detected
    enableReducedMotion: false  // Will be auto-detected
  },
  performance: {
    enableVirtualization: false, // For future use with large datasets
    debounceSearchMs: 300,
    throttlePanMs: 16
  },
  features: {
    enableSearch: true,
    enableDetailsPanel: true,
    enableRelationshipToggle: true,
    enableFullscreen: true,
    enableExport: false // Future feature
  }
} as const;