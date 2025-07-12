// Theme configuration for Interactive ERD Component
import type { ERDTheme, ERDConfig } from './ERDTypes';

/**
 * Default ERD theme configuration
 */
export const defaultTheme: ERDTheme = {
  colors: {
    beta: '#8B1538',
    concept: '#E67E22',
    future: '#95A5A6',
    entityBackground: '#ffffff',
    entityBorder: '#333333',
    relationshipLine: '#333333',
    relationshipHighlight: '#841839',
    text: '#333333',
    textSecondary: '#666666'
  },
  fonts: {
    entityName: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fieldText: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fieldType: '"Courier New", Courier, monospace'
  }
};

/**
 * Dark theme configuration
 */
export const darkTheme: ERDTheme = {
  colors: {
    beta: '#A62838',
    concept: '#F39C12',
    future: '#BDC3C7',
    entityBackground: '#2c3e50',
    entityBorder: '#ecf0f1',
    relationshipLine: '#bdc3c7',
    relationshipHighlight: '#e74c3c',
    text: '#ecf0f1',
    textSecondary: '#95a5a6'
  },
  fonts: {
    entityName: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fieldText: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fieldType: '"Courier New", Courier, monospace'
  }
};

/**
 * High contrast theme for accessibility
 */
export const highContrastTheme: ERDTheme = {
  colors: {
    beta: '#000000',
    concept: '#000000',
    future: '#000000',
    entityBackground: '#ffffff',
    entityBorder: '#000000',
    relationshipLine: '#000000',
    relationshipHighlight: '#000000',
    text: '#000000',
    textSecondary: '#000000'
  },
  fonts: {
    entityName: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fieldText: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fieldType: '"Courier New", Courier, monospace'
  }
};

/**
 * Default ERD configuration
 */
export const defaultConfig: ERDConfig = {
  entityWidth: 250,
  entityHeaderHeight: 35,
  fieldHeight: 20,
  padding: 8,
  minScale: 0.3,
  maxScale: 3,
  initialScale: 0.6
};

/**
 * Mobile-optimized configuration
 */
export const mobileConfig: ERDConfig = {
  entityWidth: 200,
  entityHeaderHeight: 40,
  fieldHeight: 24,
  padding: 12,
  minScale: 0.2,
  maxScale: 2,
  initialScale: 0.4
};

/**
 * Tablet-optimized configuration
 */
export const tabletConfig: ERDConfig = {
  entityWidth: 220,
  entityHeaderHeight: 38,
  fieldHeight: 22,
  padding: 10,
  minScale: 0.25,
  maxScale: 2.5,
  initialScale: 0.5
};

/**
 * CSS custom properties for theme integration
 */
export function generateCSSCustomProperties(theme: ERDTheme): string {
  return `
    --erd-color-beta: ${theme.colors.beta};
    --erd-color-concept: ${theme.colors.concept};
    --erd-color-future: ${theme.colors.future};
    --erd-color-entity-bg: ${theme.colors.entityBackground};
    --erd-color-entity-border: ${theme.colors.entityBorder};
    --erd-color-relationship: ${theme.colors.relationshipLine};
    --erd-color-relationship-highlight: ${theme.colors.relationshipHighlight};
    --erd-color-text: ${theme.colors.text};
    --erd-color-text-secondary: ${theme.colors.textSecondary};
    --erd-font-entity-name: ${theme.fonts.entityName};
    --erd-font-field-text: ${theme.fonts.fieldText};
    --erd-font-field-type: ${theme.fonts.fieldType};
  `;
}

/**
 * Get theme based on user preferences
 */
export function getPreferredTheme(): ERDTheme {
  // Check for high contrast preference first
  if (window.matchMedia('(prefers-contrast: high)').matches) {
    return highContrastTheme;
  }
  
  // Check for dark mode preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return darkTheme;
  }
  
  return defaultTheme;
}

/**
 * Get configuration based on screen size
 */
export function getResponsiveConfig(width: number): ERDConfig {
  if (width < 768) {
    return mobileConfig;
  } else if (width < 1024) {
    return tabletConfig;
  }
  return defaultConfig;
}

/**
 * Generate CSS animations for reduced motion
 */
export function getAnimationCSS(respectReducedMotion: boolean = true): string {
  const duration = respectReducedMotion && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '0ms' : '300ms';
  
  return `
    .erd-entity {
      transition: all ${duration} ease;
    }
    
    .erd-relationship {
      transition: all ${duration} ease;
    }
    
    .erd-details-panel {
      transition: transform ${duration} ease;
    }
    
    .erd-tooltip {
      transition: opacity ${duration} ease;
    }
    
    .erd-zoom-animation {
      transition: transform ${duration} ease;
    }
  `;
}

/**
 * Responsive font sizes based on zoom level and screen size
 */
export function getResponsiveFontSizes(scale: number, screenWidth: number): {
  entityName: number;
  fieldText: number;
  fieldType: number;
} {
  const baseMultiplier = screenWidth < 768 ? 1.2 : 1;
  
  return {
    entityName: Math.max(10, 12 * scale * baseMultiplier),
    fieldText: Math.max(9, 11 * scale * baseMultiplier),
    fieldType: Math.max(8, 10 * scale * baseMultiplier)
  };
}

/**
 * Calculate optimal stroke width based on zoom level
 */
export function getResponsiveStrokeWidth(scale: number): {
  entityBorder: number;
  relationshipLine: number;
  relationshipHighlight: number;
} {
  return {
    entityBorder: Math.max(1, 2 / scale),
    relationshipLine: Math.max(1, 2.5 / scale),
    relationshipHighlight: Math.max(1.5, 3.5 / scale)
  };
}

/**
 * Apply theme to SVG elements
 */
export function applyThemeToSVG(svgElement: SVGSVGElement, theme: ERDTheme): void {
  // Update CSS custom properties
  const style = document.createElement('style');
  style.textContent = `
    :root {
      ${generateCSSCustomProperties(theme)}
    }
  `;
  
  // Remove existing theme style if present
  const existingStyle = svgElement.querySelector('style[data-erd-theme]');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  style.setAttribute('data-erd-theme', 'true');
  svgElement.appendChild(style);
}

/**
 * Create theme-aware legend
 */
export function createLegendHTML(theme: ERDTheme): string {
  return `
    <div class="erd-legend">
      <h4 class="erd-legend-title">Maturity Levels</h4>
      <div class="erd-legend-item">
        <div class="erd-legend-color" style="background-color: ${theme.colors.beta}"></div>
        <span>Beta</span>
      </div>
      <div class="erd-legend-item">
        <div class="erd-legend-color" style="background-color: ${theme.colors.concept}"></div>
        <span>Concept</span>
      </div>
      <div class="erd-legend-item">
        <div class="erd-legend-color" style="background-color: ${theme.colors.future}"></div>
        <span>Future</span>
      </div>
    </div>
  `;
}