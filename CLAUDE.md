# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the CLIF Consortium website - a healthcare consortium website built with Astro that showcases the Common Longitudinal ICU data Format standard for critical care data research. The project has been migrated from static markdown files to a modern Astro framework.

## Commands

### Development

```bash
npm run dev      # Start development server on http://localhost:4321
npm run build    # Build for production to ./dist
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
npm run typecheck # Run TypeScript type checking
npm test         # Run tests with Vitest
```

### Image Management

```bash
python download_png_images.py      # Download PNG images from markdown files
python test_png_references.py      # Verify PNG references in Astro files
python test_png_display.py         # Test PNG display on all pages
```

## Architecture

### Technology Stack

- **Framework**: Astro 4.16.18 with Sharp image processing
- **Styling**: Tailwind CSS 3.4.17 with custom CLIF brand colors
- **Components**: Astro components with TypeScript interfaces
- **Content**: Astro Content Collections for structured data

### Project Structure

```
src/
├── components/          # Reusable Astro components
│   ├── layout/         # Header, Footer, Navigation
│   ├── home/           # Homepage-specific components
│   ├── team/           # Team member components
│   ├── cohort/         # Cohort dashboard components
│   ├── shared/         # Button, Badge, SectionHeading
│   ├── DataTableEnhanced.astro # Enhanced data tables with search/export
│   ├── TableOfContents.astro   # Sidebar navigation for tables
│   └── OptimizedImage.astro    # Lazy-loading image component
├── content/            # Content Collections
│   ├── team/           # Team member profiles
│   ├── publications/   # Research publications
│   ├── tools/          # CLIF tools descriptions
│   └── institutions/   # Member institution data
├── pages/              # Route pages (file-based routing)
│   ├── index.astro     # Homepage
│   ├── team.astro      # Team page
│   ├── data-dictionary.astro
│   └── [others].astro
├── layouts/            # BaseLayout with SEO meta tags
└── styles/             # Global CSS with Tailwind directives
```

### Key Design Patterns

1. **Component Architecture**: All components use Astro's component model with TypeScript interfaces for props
2. **Content Collections**: Structured content with Zod schemas in `src/content/config.ts`
3. **Image Handling**: Images stored in `public/images/` with subdirectories for organization
4. **Styling**: Tailwind utility classes with custom theme colors (clif-burgundy, clif-gray scale)
5. **Layout**: BaseLayout component handles SEO, meta tags, and consistent page structure

### Data Flow

- Markdown files → Python scripts → Downloaded images → Public directory
- Content Collections → Astro pages → Static HTML output
- Component props → TypeScript validation → Rendered components

## Current Implementation Status

**Completed (100%)**:

- All 12 pages created and functional
- 24 PNG images + 86 team member photos integrated
- 15+ reusable components including enhanced features
- Responsive design with Tailwind CSS
- SEO optimization with meta tags
- Complete team page with all 46 members
- Complete data dictionary with all 9 Beta tables
- Interactive cohort dashboard with Chart.js visualizations
- Enhanced data tables with search and CSV/JSON export
- Image lazy loading and optimization
- ESLint, Prettier, TypeScript, and Vitest configured
- Placeholder system for missing images
- Enhanced contact information display for team members

**Recent Enhancements**:

- DataTableEnhanced: Sticky headers, search, export functionality
- TableOfContents: Sidebar navigation with active section highlighting
- CohortCharts: Interactive visualizations using Chart.js
- OptimizedImage: Lazy loading with fallback support
- Team member contact info: Email, GitHub, website links with icons
- Data Dictionary Color Scheme: Field types are color-coded for better readability
- Fixed Underscore Display: Variable names now display correctly without backslashes
- Sidebar Navigation: Added to all data dictionary versions with search functionality

## Important Notes

1. **Code Quality Tools**: ESLint (with new config format), Prettier, TypeScript, and Vitest are configured
2. **Image References**: All image paths use absolute paths from `/images/`
3. **Content Migration**: Original content archived in `archive/` directory
4. **Python Scripts**: Used for image management during migration (not needed for build)
5. **Deployment**: Configured for Vercel (see `vercel.json`)
6. **Missing Images**: Placeholder system handles missing team member photos gracefully
7. **Interactive Features**: Charts require JavaScript enabled, provide fallback content

## Common Tasks

### Adding a New Team Member

1. Create new file in `src/content/team/` following existing pattern
2. Add headshot image to `public/images/headshots/`
3. Follow schema in `src/content/config.ts`

### Adding a New Page

1. Create `.astro` file in `src/pages/`
2. Use `BaseLayout` component for consistency
3. Follow existing page patterns for structure

### Updating Styles

1. Use Tailwind utility classes
2. Custom colors defined in `tailwind.config.cjs`
3. Avoid inline styles; use component-level `<style>` tags if needed

### Working with Images

1. Place new images in appropriate `public/images/` subdirectory
2. Reference with absolute paths: `/images/filename.png`
3. Use `download_png_images.py` to batch download from markdown files

## Known Issues

### Institution Content Collection Errors
- Astro may show schema validation errors for institution JSON files
- These errors are non-critical and don't affect website functionality
- All institution data is valid and displays correctly

### Git Repository Issues
- If you encounter "short read while indexing" errors with git:
  ```bash
  rm -f .git/index
  git reset
  ```

### Development Server Warnings
- "No files found matching" warnings for team/publications/tools are expected
- These content collections are defined but not yet populated with content
