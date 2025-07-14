# CLIF Website Folder Structure

This document describes the organization of the CLIF Consortium website project.

## Root Directory

```
clif_web_markdown/
├── src/                    # Source code
├── public/                 # Static assets
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── tests/                  # Test files
├── archive/                # Archived files (gitignored)
└── dist/                   # Build output (gitignored)
```

## Source Directory (`src/`)

```
src/
├── components/             # Reusable Astro components
│   ├── layout/            # Layout components (Header, Footer, Navigation)
│   ├── home/              # Homepage-specific components
│   ├── team/              # Team member components
│   ├── cohort/            # Cohort dashboard components
│   ├── shared/            # Shared components (buttons, cards, etc.)
│   └── *.astro           # Individual component files
├── content/               # Content Collections
│   ├── team/             # Team member profiles (currently empty)
│   ├── publications/     # Research publications (currently empty)
│   ├── tools/            # Tool descriptions (currently empty)
│   └── institutions/     # Institution data (JSON files)
├── layouts/              # Page layouts
├── pages/                # Route pages (file-based routing)
│   └── data-dictionary/  # Data dictionary sub-pages
├── styles/               # Global styles
└── env.d.ts              # TypeScript environment types
```

## Public Directory (`public/`)

```
public/
├── images/
│   ├── icons/            # App icons and small graphics
│   ├── features/         # Feature images (tools, dashboards)
│   ├── institutions/     # Institution logos
│   ├── headshots/        # Team member photos
│   ├── logos/            # CLIF logos
│   ├── projects/         # Project images
│   ├── data-dictionary/  # Data dictionary specific images
│   └── misc/             # Miscellaneous images
├── _headers              # Vercel headers configuration
├── favicon.svg           # Site favicon
├── manifest.json         # PWA manifest
└── robots.txt           # Search engine directives
```

## Image Organization Guidelines

- **icons/**: Small icons (< 256px), app icons
- **features/**: Tool screenshots, feature highlights
- **institutions/**: University and hospital logos
- **headshots/**: Team member photos (JPG/WebP pairs)
- **logos/**: CLIF branding assets
- **projects/**: Conference and project images
- **data-dictionary/**: ERD diagrams, badges
- **misc/**: Other images that don't fit categories

## File Naming Conventions

- Use kebab-case for all file names: `team-member-name.jpg`
- Headshots: `firstname-lastname.jpg` and `.webp`
- Components: PascalCase for Astro components
- Pages: kebab-case for routes

## Git Ignore Patterns

The following are excluded from version control:
- `node_modules/`
- `dist/` and `.astro/`
- `.env` files
- Log files (`*.log`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Archive folder
- Screenshot files (`Xnip*.png`)