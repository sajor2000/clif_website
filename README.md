# CLIF Consortium Website

A modern, responsive website for the Common Longitudinal ICU data Format (CLIF) Consortium, built with Astro and deployed on Vercel.

## 🚀 Project Overview

The CLIF Consortium website showcases a healthcare consortium focused on standardizing critical care data for research. The site features:

- **18 participating institutions** with 46 hospitals
- **680,158+ unique ICU patients** across the network
- **Interactive data dictionary** with CLIF 2.0.0 specifications
- **Enhanced FAQ system** with accordion functionality
- **Responsive team directory** with 46+ members
- **Real-time cohort dashboard** integration

## 🛠 Technology Stack

- **Framework**: [Astro 5.11.0](https://astro.build/) with TypeScript
- **Styling**: [Tailwind CSS 3.4.17](https://tailwindcss.com/)
- **Image Processing**: Sharp for optimization
- **Deployment**: [Vercel](https://vercel.com/)
- **Quality**: ESLint, Prettier, TypeScript strict mode

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/Common-Longitudinal-ICU-data-Format/CLIF.git
cd clif-consortium-website

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🧞 Commands

All commands are run from the root of the project:

| Command             | Action                                      |
| :------------------ | :------------------------------------------ |
| `npm run dev`       | Starts local dev server at `localhost:4321` |
| `npm run build`     | Build production site to `./dist/`          |
| `npm run preview`   | Preview build locally before deploying      |
| `npm run lint`      | Run ESLint on the codebase                  |
| `npm run format`    | Format code with Prettier                   |
| `npm run typecheck` | Run TypeScript type checking                |
| `npm test`          | Run tests with Vitest                       |

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
