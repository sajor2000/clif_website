import js from '@eslint/js';
import astroPlugin from 'eslint-plugin-astro';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'archive/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
  {
    files: ['**/*.astro'],
    plugins: {
      astro: astroPlugin,
    },
    languageOptions: {
      parser: astroPlugin.parsers.astro,
    },
    rules: {
      ...astroPlugin.configs.recommended.rules,
      'astro/no-set-html-directive': 'error',
      'astro/no-unused-css-selector': 'warn',
    },
  },
];
