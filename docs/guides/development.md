# Development Guide

## Getting Started

This guide covers the development workflow for the CLIF Consortium website.

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sajor2000/clif_website.git
   cd clif_website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # Opens http://localhost:4321
   ```

## Development Workflow

### 1. Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use Tailwind CSS utility classes
- Avoid inline styles

### 2. Component Development

Components are located in `src/components/`:

```typescript
// Example component structure
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
```

### 3. Adding Pages

Pages use file-based routing in `src/pages/`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Page Title">
  <!-- Page content -->
</BaseLayout>
```

### 4. Content Management

#### Team Members
- Add photos to `public/images/headshots/`
- Update team data in page files

#### Institutions
- Add logos to `public/images/institutions/`
- Update JSON in `src/content/institutions/`

### 5. Data Dictionary Updates

The data dictionary uses custom markdown rendering:

```javascript
// Color coding for field types
- Primary/Foreign Keys (_id) → Burgundy
- Datetime fields (_dttm) → Blue
- Category fields (_category) → Emerald
- Name fields (_name) → Gray
```

## Testing

### Linting
```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

### Type Checking
```bash
npm run typecheck
```

### Formatting
```bash
npm run format
```

## Building for Production

```bash
npm run build
npm run preview  # Test production build
```

## Common Issues

### Build Errors
- Run `npm run typecheck` to identify TypeScript issues
- Check for missing dependencies

### Image Issues
- Use absolute paths: `/images/filename.png`
- Ensure images are in `public/images/`

### Style Issues
- Check for Tailwind class conflicts
- Verify custom colors in `tailwind.config.cjs`

## Best Practices

1. **Performance**
   - Use `OptimizedImage` component for images
   - Lazy load non-critical content
   - Minimize JavaScript bundles

2. **Accessibility**
   - Add proper ARIA labels
   - Ensure keyboard navigation
   - Test with screen readers

3. **SEO**
   - Use semantic HTML
   - Add meta descriptions
   - Implement structured data

## Resources

- [Astro Documentation](https://docs.astro.build)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)