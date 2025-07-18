# Vercel Deployment Guide

## Overview

The CLIF Consortium website is configured for automatic deployment to Vercel.

## Automatic Deployment

### GitHub Integration

1. **Push to main branch** triggers automatic deployment
2. **Pull requests** create preview deployments
3. **Build status** shows in GitHub

### Configuration

The `vercel.json` file contains:

```json
{
  "framework": "astro",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

## Manual Deployment

### Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to production**
   ```bash
   vercel --prod
   ```

3. **Create preview deployment**
   ```bash
   vercel
   ```

## Build Settings

### Environment

- **Framework Preset**: Astro
- **Node.js Version**: 18.x
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Build Optimizations

- Image compression with Sharp
- CSS purging with Tailwind
- JavaScript minification
- Static file generation

## Troubleshooting

### Build Failures

1. **Check build logs** in Vercel dashboard
2. **Common issues**:
   - Missing dependencies
   - TypeScript errors
   - Image processing failures

### Solutions

```bash
# Clear cache and rebuild
vercel --force

# Check local build
npm run build
npm run preview
```

### Image Compression Warnings

The build may show warnings about unsupported image formats. These are non-critical and don't prevent deployment.

## Performance

### Monitoring

- Web Vitals tracking enabled
- Sentry error reporting configured
- Analytics ready for integration

### Optimization

- CDN edge caching
- Automatic HTTPS
- Compression enabled
- HTTP/2 support

## Domain Configuration

### Custom Domain

1. Add domain in Vercel dashboard
2. Update DNS records
3. SSL certificate auto-provisioned

### Redirects

Configure in `vercel.json`:

```json
{
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ]
}
```

## Security

### Headers

Security headers configured in `public/_headers`:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

### Environment Variables

- Set in Vercel dashboard
- Available during build
- Encrypted at rest

## Rollback

### Via Dashboard

1. Go to Deployments tab
2. Find previous deployment
3. Click "Promote to Production"

### Via CLI

```bash
vercel rollback
```

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Status Page](https://www.vercel-status.com/)