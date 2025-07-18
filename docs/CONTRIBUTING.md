# Contributing to CLIF Consortium Website

Thank you for your interest in contributing to the CLIF Consortium website! This guide will help you get started.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/clif_website.git
   cd clif_website
   ```

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

## Development Process

### 1. Make Your Changes

- Follow the [Development Guide](guides/development.md)
- Write clean, readable code
- Add comments for complex logic
- Update documentation as needed

### 2. Test Your Changes

```bash
# Run linting
npm run lint

# Check types
npm run typecheck

# Format code
npm run format

# Build locally
npm run build
```

### 3. Commit Your Changes

Follow conventional commits:

```bash
# Features
git commit -m "feat: add new data visualization component"

# Bug fixes
git commit -m "fix: correct color coding in data dictionary"

# Documentation
git commit -m "docs: update team member information"

# Style changes
git commit -m "style: improve mobile responsive layout"

# Refactoring
git commit -m "refactor: simplify navigation component logic"

# Tests
git commit -m "test: add unit tests for data table"

# Chores
git commit -m "chore: update dependencies"
```

### 4. Push Your Changes

```bash
git push origin feature/your-feature-name
```

### 5. Create a Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template
5. Submit for review

## Pull Request Guidelines

### PR Title

Use the same conventional commit format:
- `feat: add institution logo carousel`
- `fix: resolve build error in production`

### PR Description

Include:
- **What** changed
- **Why** it was changed
- **How** to test it
- **Screenshots** (if UI changes)

### Checklist

- [ ] Code follows project style guide
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Accessible (ARIA labels, keyboard navigation)

## Code Style Guide

### TypeScript

```typescript
// Use interfaces for props
interface Props {
  title: string;
  isActive?: boolean;
}

// Use const for components
const MyComponent = ({ title, isActive = false }: Props) => {
  // Component logic
};
```

### Astro Components

```astro
---
// Use TypeScript in frontmatter
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<div class="component">
  <h2>{title}</h2>
</div>

<style>
  /* Component styles */
  .component {
    /* Styles */
  }
</style>
```

### CSS/Tailwind

- Use Tailwind utility classes
- Avoid inline styles
- Group related utilities
- Use custom colors from config

```html
<!-- Good -->
<div class="flex items-center justify-between p-4 bg-clif-burgundy text-white">

<!-- Avoid -->
<div style="display: flex; padding: 1rem;">
```

## Areas for Contribution

### Current Needs

1. **Documentation**
   - Improve component documentation
   - Add JSDoc comments
   - Update guides

2. **Testing**
   - Add unit tests
   - Improve test coverage
   - End-to-end testing

3. **Performance**
   - Optimize images
   - Improve load times
   - Reduce bundle size

4. **Accessibility**
   - Screen reader support
   - Keyboard navigation
   - WCAG compliance

5. **Features**
   - Data visualizations
   - Search functionality
   - Interactive elements

### First-Time Contributors

Look for issues labeled:
- `good first issue`
- `help wanted`
- `documentation`

## Review Process

1. **Automated checks** run on PR creation
2. **Code review** by maintainers
3. **Testing** in preview deployment
4. **Merge** when approved

## Questions?

- Open an issue for bugs or features
- Start a discussion for questions
- Contact maintainers for guidance

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to the CLIF Consortium!