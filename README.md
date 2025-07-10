# CLIF Consortium Website

The official website for the Common Longitudinal ICU data Format (CLIF) Consortium, built with Astro.

## 🚀 Overview

CLIF is a standardized framework for organizing electronic health record (EHR) data on critically ill patients across multiple institutions. This website serves as the primary resource for researchers, clinicians, and institutions participating in the CLIF consortium.

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build) v4.16.18
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v3.4.17
- **Language**: TypeScript
- **Testing**: Vitest
- **Deployment**: Vercel

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/[your-org]/clif-consortium-website.git
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
/
├── public/
│   ├── fonts/          # Web fonts
│   └── images/         # Static images
├── src/
│   ├── components/     # Reusable Astro components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Route pages
│   ├── styles/         # Global styles
│   └── tests/          # Test files
├── astro.config.mjs    # Astro configuration
├── tailwind.config.cjs # Tailwind CSS configuration
└── package.json
```

## 🌐 Deployment

This site is configured for deployment on [Vercel](https://vercel.com):

1. Push changes to the main branch
2. Vercel will automatically build and deploy
3. Preview deployments are created for pull requests

### Environment Variables

No environment variables are required for basic deployment.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🔗 Links

- [CLIF Consortium Website](https://clif-consortium.org)
- [CLIF GitHub Organization](https://github.com/Common-Longitudinal-ICU-data-Format)
- [Research Paper](https://link.springer.com/article/10.1007/s00134-025-07848-7)

## 👥 Maintainers

- CLIF Consortium Technical Team

For questions or support, please open an issue on GitHub.
