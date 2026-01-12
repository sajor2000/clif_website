# CLIF Consortium Website

<div align="center">
  <img src="public/images/clif_logo.png" alt="CLIF Logo" width="200">
  
  **Common Longitudinal ICU data Format**
  
  [![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-FF5D01?style=flat&logo=astro)](https://astro.build)
  [![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
</div>

## Overview

The CLIF Consortium website is a modern, performant web application showcasing the Common Longitudinal ICU data Format standard for critical care data research. Built with Astro for optimal performance and developer experience.

### Key Features

- 📊 **Interactive Data Dictionary** - Comprehensive documentation of CLIF data standards (v1.0.0, v2.0.0, v2.1.0)
- 🎨 **Enhanced Visual Design** - Color-coded field types for improved readability
- 🔍 **Advanced Search** - Searchable sidebar navigation and data tables
- 📱 **Fully Responsive** - Optimized for all device sizes
- ⚡ **Lightning Fast** - Static site generation with Astro
- 🏥 **18 Member Institutions** - Collaborative healthcare data standardization

### Quick Statistics

- **18 participating institutions** with 62 hospitals
- **808,749+ unique ICU patients** across the network
- **46+ consortium members** contributing to the standard
- **3 CLIF versions** documented with comprehensive field definitions

## Quick Start

```bash
# Clone the repository
git clone https://github.com/sajor2000/clif_website.git
cd clif_website

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Documentation

### Core Documentation

- [`CLAUDE.md`](CLAUDE.md) - AI assistant guidance and project conventions
- [`docs/folder-structure.md`](docs/folder-structure.md) - Detailed project structure

### Development Guides

- [Development Setup](#development-setup)
- [Architecture Overview](#architecture)
- [Contributing Guidelines](#contributing)

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on http://localhost:4321 |
| `npm run build` | Build for production to ./dist |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type checking |

## 📁 Project Structure

```
src/
├── components/          # Reusable Astro components
│   ├── layout/         # Header, Footer, Navigation
│   ├── home/           # Homepage-specific components
│   ├── team/           # Team member components
│   ├── cohort/         # Dashboard components
│   └── shared/         # Buttons, cards, utilities
├── content/            # Content Collections
│   ├── institutions/   # Institution data (JSON)
│   ├── team/          # Team profiles (empty - using hardcoded)
│   ├── publications/  # Research data (empty)
│   └── tools/         # Tool descriptions (empty)
├── layouts/           # Page layouts
├── pages/             # File-based routing
├── styles/            # Global CSS
└── env.d.ts          # TypeScript definitions

public/
├── images/            # Static assets
│   ├── headshots/     # Team member photos (JPG/WebP)
│   ├── institutions/  # University logos
│   ├── data-dictionary/ # ERD diagrams
│   └── misc/          # Site images
├── favicon.svg
├── manifest.json
└── robots.txt
```

## 🚢 Deployment

The site is configured for **Vercel deployment**:

- **Framework**: Astro (auto-detected)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Region**: `iad1` (US East)

### Environment Variables
No environment variables required for basic functionality.

## 🎨 Key Features

### Interactive FAQ System
- Accordion-style collapsible questions
- Sticky sidebar navigation
- Copy-to-clipboard email functionality
- Mobile-responsive design

### Enhanced Data Dictionary
- Multiple CLIF versions (1.0.0, 2.0.0, 2.1.0)
- Interactive table of contents
- Beta badges and maturity indicators
- mCIDE GitHub integration

### Team Management
- 46+ team member profiles
- Headshot optimization (JPG→WebP)
- Contact information with social links
- Institution affiliations

### Performance Optimizations
- Image lazy loading and optimization
- Component-level code splitting
- Tailwind CSS purging
- Sharp image processing

## 📋 Content Management

### Adding Team Members
1. Add headshot to `public/images/headshots/`
2. Create WebP version for optimization
3. Update team data in respective page files

### Adding Institutions
1. Add logo to `public/images/institutions/`
2. Update institution data in `src/content/institutions/`

### Updating Content
- **Homepage**: `src/pages/index.astro`
- **Team Page**: `src/pages/team.astro`
- **Data Dictionary**: `src/pages/data-dictionary/`
- **FAQ**: `src/pages/faq.astro`

## 🔧 Configuration Files

- `astro.config.mjs` - Astro configuration
- `tailwind.config.cjs` - Tailwind CSS setup
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint rules
- `vercel.json` - Deployment configuration

## 🎯 Code Quality

### Standards
- TypeScript strict mode enabled
- ESLint with Astro-specific rules
- Prettier for consistent formatting
- Component-level CSS containment

### Best Practices
- Semantic HTML structure
- Accessibility (ARIA labels, focus states)
- Performance optimizations
- Mobile-first responsive design

## 🐛 Troubleshooting

### Common Issues
1. **Build Errors**: Run `npm run typecheck` to identify TypeScript issues
2. **Style Issues**: Check Tailwind class conflicts
3. **Image Issues**: Verify image paths are absolute (`/images/...`)

### Development Tips
- Use `npm run dev` for hot reloading
- Images in `public/` are served from root (`/images/...`)
- Components use TypeScript interfaces for props

## 📈 Analytics & Monitoring

- Web Vitals integration ready
- Sentry error tracking configured
- SEO optimization with meta tags
- Sitemap generation enabled

## 🤝 Contributing

For new developers taking over this project:

1. **Familiarize** with Astro framework concepts
2. **Review** the component architecture in `src/components/`
3. **Understand** the content structure and routing
4. **Test** changes locally before deployment
5. **Maintain** code quality standards

## 📝 License

ISC License - See LICENSE file for details

## 🔗 Links

- [CLIF Consortium Website](https://clif-consortium.org)
- [CLIF GitHub Repository](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF)
- [Research Paper](https://link.springer.com/article/10.1007/s00134-025-07848-7)

---

**Project Status**: Production Ready ✅  
**Last Updated**: July 2025  
**Maintainer**: CLIF Consortium Team
