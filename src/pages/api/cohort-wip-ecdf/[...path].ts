export const prerender = true;
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

// WIP distributions endpoint — mirrors /api/ecdf but reads the new PMF data in
// src/data/cohort_wip_ecdf (used only by the gated /cohort_wip dashboard).
const BASE = ['src', 'data', 'cohort_wip_ecdf'];

export const getStaticPaths: GetStaticPaths = async () => {
  const ecdfBasePath = join(process.cwd(), ...BASE);
  const categories = ['labs', 'respiratory_support', 'vitals'];
  const paths: { params: { path: string } }[] = [];

  for (const category of categories) {
    const categoryPath = join(ecdfBasePath, category);
    try {
      const files = await readdir(categoryPath);
      for (const file of files) {
        if (file.endsWith('.csv')) {
          paths.push({ params: { path: `${category}/${file}` } });
        }
      }
    } catch {
      // Category directory doesn't exist, skip
    }
  }

  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  const { path } = params;

  if (!path) {
    return new Response('Not found', { status: 404 });
  }

  // Sanitize path to prevent directory traversal
  const sanitizedPath = path.replace(/\.\./g, '').replace(/^\/+/, '');

  // Only allow .csv files
  if (!sanitizedPath.endsWith('.csv')) {
    return new Response('Not found', { status: 404 });
  }

  const filePath = join(process.cwd(), ...BASE, sanitizedPath);

  try {
    const content = await readFile(filePath, 'utf-8');
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
};
