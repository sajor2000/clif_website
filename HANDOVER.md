# CLIF Consortium Website - Project Handover Documentation

**Date**: July 18, 2025  
**Prepared for**: Next Development Team

## Project Overview

The CLIF Consortium website is a modern Astro-based healthcare consortium website showcasing the Common Longitudinal ICU data Format standard for critical care data research.

## Recent Changes and Fixes

### 1. Data Dictionary Improvements (July 18, 2025)

#### Fixed Underscore Escaping Issue
- **Problem**: Variable names with underscores (e.g., `location_category`) were displaying with backslashes (`location\_category`)
- **Solution**: Modified the `applyColorScheme` function in data dictionary Astro files to properly handle field names
- **Files Modified**:
  - `src/pages/data-dictionary/data-dictionary-2.0.0.astro` (lines 176-197)

#### Added Color Coding for Field Types
- Primary/Foreign Keys (_id) → Burgundy
- Datetime fields (_dttm, _date, _time) → Blue
- Category fields (_category) → Emerald
- Name/source fields (_name) → Gray
- Numeric values → Cyan
- Type/status/code fields → Purple

#### Added Sidebar Navigation
- Added collapsible sidebar with search functionality to data dictionary pages
- Implemented for versions 1.0.0, 2.0.0, and 2.1.0
- Includes Beta and Concept table sections

### 2. Removed "[Anchor]" Text from Headings
- Custom renderer removes all "[Anchor]" links from markdown headings
- Provides cleaner visual presentation

## Known Issues and Workarounds

### 1. Institution Content Collection Errors
- **Issue**: Astro shows schema validation errors for institution JSON files
- **Impact**: Non-critical - doesn't affect website functionality
- **Workaround**: Errors can be safely ignored; all institution data is valid

### 2. Git Index Corruption (CRITICAL)
- **Issue**: Git repository has severe index corruption
- **Symptoms**: 
  - "short read while indexing" errors
  - Commands timeout after 2+ minutes
  - Unable to stage files
- **Solution**: 
  ```bash
  # Option 1: Try to rebuild index
  rm -f .git/index
  rm -f .git/index.lock
  git reset --hard HEAD
  
  # Option 2: If that fails, clone fresh and copy changes
  cd ..
  git clone [repository-url] clif_web_markdown_fresh
  cp -r clif_web_markdown/src clif_web_markdown_fresh/
  cp clif_web_markdown/*.md clif_web_markdown_fresh/
  ```
- **Files to manually commit**:
  - `src/pages/data-dictionary/data-dictionary-*.astro` (all 3 files)
  - `CLAUDE.md` (updated documentation)
  - `HANDOVER.md` (this file)
  - `CHANGES_SUMMARY.md` (detailed changes)

### 3. Missing Content Files
- **Warning Messages**: "No files found matching" for team, publications, tools
- **Reason**: These content collections are defined but have no markdown files yet
- **Impact**: Non-critical warnings only

## Development Setup

### Prerequisites
- Node.js v22.16.0 or higher
- npm 10.9.2 or higher

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Common Commands
```bash
npm run dev      # Start dev server (http://localhost:4321)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
npm run typecheck # Run TypeScript checking
```

## Project Structure

```
clif_web_markdown/
├── src/
│   ├── pages/              # Route pages
│   │   └── data-dictionary/  # Data dictionary pages with fixes
│   ├── content/            # Content collections
│   │   ├── institutions/   # Institution JSON files
│   │   └── *.md           # Data dictionary markdown sources
│   └── components/         # Reusable Astro components
├── public/
│   └── images/            # Static images
├── CLAUDE.md              # AI assistant instructions
├── HANDOVER.md           # This file
└── README.md             # Project overview
```

## Testing the Fixes

1. Start the dev server: `npm run dev`
2. Navigate to: http://localhost:4321/data-dictionary/data-dictionary-2.0.0
3. Verify:
   - Field names display without backslashes (e.g., `location_category`)
   - Fields are color-coded by type
   - Sidebar navigation works
   - No "[Anchor]" text appears in headings

## Deployment

The project is configured for Vercel deployment (see `vercel.json`).

## Support Resources

- [Astro Documentation](https://docs.astro.build)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- Project Repository: [Check package.json for repository URL]

## Contact

For questions about recent changes, refer to the git commit history and CLAUDE.md for implementation details.