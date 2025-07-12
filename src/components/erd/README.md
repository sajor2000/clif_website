# Interactive ERD Component Library

A modern, accessible, and performant Interactive Entity Relationship Diagram component built for the CLIF Consortium website using TypeScript and Astro.

## Architecture

### Components

- **`ERDTypes.ts`** - Complete TypeScript type definitions
- **`ERDUtils.ts`** - Utility functions (search, calculations, validation)
- **`ERDTheme.ts`** - Theme management and responsive configuration
- **`ERDCanvas.ts`** - Core ERD rendering engine and interaction logic
- **`ERDClient.ts`** - Astro client-side integration helpers
- **`InteractiveERDOptimized.astro`** - Main Astro component

### Key Features

#### 🎨 **Visual Design**
- Matches static ERD styling exactly
- White table backgrounds with colored headers
- Clear relationship lines with arrows
- Responsive legend and controls

#### 📱 **Responsive & Mobile**
- Adaptive layouts for mobile, tablet, desktop
- Touch gestures (pinch-to-zoom, pan)
- Responsive controls that stack on mobile
- Optimized for different screen sizes

#### ♿ **Accessibility**
- Full keyboard navigation support
- Screen reader compatibility with ARIA labels
- High contrast mode support
- Reduced motion preference support
- Focus management and visual indicators

#### ⚡ **Performance**
- Debounced search (300ms delay)
- Throttled pan operations (60fps)
- Efficient DOM updates
- Lazy loading and virtualization ready
- Memoized calculations

#### 🔧 **Developer Experience**
- Full TypeScript support
- Modular architecture
- Comprehensive error handling
- Performance monitoring hooks
- Easy theming and configuration

## Usage

### Basic Implementation

```astro
---
import InteractiveERDOptimized from '../components/InteractiveERDOptimized.astro';
---

<InteractiveERDOptimized 
  tables={[...betaTables, ...conceptTables, ...futureTables]}
  height="800px"
  enableKeyboardNavigation={true}
  enableSearch={true}
  showLegend={true}
  className="shadow-xl"
/>
```

### Advanced Configuration

```typescript
import { createERD } from './erd/ERDCanvas';
import type { ERDEntity, ERDRelationship } from './erd/ERDTypes';

const erdInstance = createERD('erd-container', entities, relationships, {
  config: {
    entityWidth: 250,
    initialScale: 0.6,
    minScale: 0.3,
    maxScale: 3
  },
  theme: {
    colors: {
      beta: '#8B1538',
      concept: '#E67E22',
      future: '#95A5A6'
    }
  },
  eventHandlers: {
    onEntityClick: (entity) => console.log('Selected:', entity.name),
    onSearch: (query, results) => console.log('Search results:', results.length)
  },
  accessibilityConfig: {
    enableKeyboardNavigation: true,
    enableScreenReader: true
  }
});
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tables` | `any[]` | `[]` | Array of table data to display |
| `height` | `string` | `'800px'` | Container height (CSS value) |
| `className` | `string` | `''` | Additional CSS classes |
| `enableKeyboardNavigation` | `boolean` | `true` | Enable keyboard controls |
| `enableSearch` | `boolean` | `true` | Show search functionality |
| `showLegend` | `boolean` | `true` | Display maturity legend |
| `showFullscreenButton` | `boolean` | `true` | Show fullscreen toggle |

## Keyboard Controls

| Key | Action |
|-----|--------|
| `Tab` | Navigate between entities |
| `Enter/Space` | Select entity |
| `Escape` | Close details panel |
| `Arrow Keys` | Navigate diagram |
| `+/-` | Zoom in/out |
| `0` | Fit to view |
| `Ctrl/Cmd + F` | Focus search |

## Browser Support

- **Modern browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile**: iOS Safari 13+, Android Chrome 80+
- **Accessibility**: NVDA, JAWS, VoiceOver screen readers

## Performance Characteristics

- **Initial load**: ~33KB gzipped JavaScript bundle
- **Memory usage**: ~2-5MB for 26 entities with relationships
- **Rendering**: 60fps smooth interactions
- **Search**: <50ms response time for 26 entities

## Theming

The component automatically adapts to:
- System dark/light mode preference
- High contrast mode
- Reduced motion preference

Custom themes can be applied via the `theme` configuration option.

## Migration from Legacy Component

The new `InteractiveERDOptimized` component is a drop-in replacement for `InteractiveERDWorking`:

```diff
- <InteractiveERDWorking tables={allTables} />
+ <InteractiveERDOptimized 
+   tables={allTables}
+   height="min(800px, 80vh)"
+   className="shadow-xl"
+ />
```

## Contributing

When adding new features:

1. Add TypeScript types to `ERDTypes.ts`
2. Implement utility functions in `ERDUtils.ts`
3. Update theme configuration in `ERDTheme.ts` if needed
4. Add core logic to `ERDCanvas.ts`
5. Update the main component in `InteractiveERDOptimized.astro`
6. Test accessibility and responsive behavior

## Future Enhancements

- [ ] SVG/PNG export functionality
- [ ] Virtual scrolling for large datasets
- [ ] Collaborative editing features
- [ ] Animation improvements
- [ ] Advanced filtering options