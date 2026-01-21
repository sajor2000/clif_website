import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://clif-consortium.org',
  integrations: [
    // Error monitoring
    sentry({}),
    tailwind(),
    sitemap(),
    compress({
      CSS: true,
      HTML: {
        // Exclude ERD-related HTML from aggressive compression
        exclude: [
          (file) => file.includes('data-dictionary-2.0.0'),
        ],
      },
      Image: {
        // Exclude problematic file types from compression
        exclude: [
          (file) => file.endsWith('.svg'),
          (file) => file.includes('placeholder'),
          (file) => file.includes('_astro'),
        ],
      },
      JavaScript: {
        // Be more conservative with JavaScript compression for ERD pages
        exclude: [
          (file) => file.includes('data-dictionary-2.0.0'),
          (file) => file.includes('InteractiveERD'),
        ],
      },
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
