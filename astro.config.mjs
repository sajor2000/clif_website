import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://clif-consortium.org',
  integrations: [
    // Error monitoring
    sentry({
      dsn: process.env.SENTRY_DSN || '', // Set this via environment variable in production
      enabled: import.meta.env?.PROD || false, // Only enable in production
      tracesSampleRate: 0.2, // Sample rate for performance monitoring
    }),
    tailwind(),
    sitemap(),
    compress({
      CSS: true,
      HTML: true,
      Image: {
        // Exclude problematic file types from compression
        exclude: [
          (file) => file.endsWith('.svg'),
          (file) => file.includes('placeholder'),
          (file) => file.includes('_astro'),
        ],
      },
      JavaScript: true,
      SVG: false, // Disable SVG compression to avoid errors
      Logger: 1, // Show compression statistics
    })
  ],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        // Sharp configuration for optimal image processing
        jpeg: { quality: 80 },
        webp: { quality: 80 },
        avif: { quality: 80 },
        png: { quality: 80 },
        defaults: {
          quality: 80,
          format: 'webp',
        }
      }
    },
    // Allow processing of remote images with https protocol
    remotePatterns: [{ protocol: 'https' }]
  },
  // build: {
  //   // Improve asset caching with content hashes in filenames
  //   assets: 'assets',
  //   assetsPrefix: '/_astro'
  // }
});
