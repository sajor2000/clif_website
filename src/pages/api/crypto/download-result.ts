export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { resultToCsv, type StrataDimension } from '../../../lib/crypto-masking';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Project ID is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const projectResult = await db.execute({
    sql: 'SELECT * FROM crypto_projects WHERE id = ?',
    args: [projectId],
  });

  if (projectResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Project not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const project = projectResult.rows[0];

  if (project.created_by !== locals.user.id && locals.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only the project creator can download results.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (project.status !== 'complete' || !project.result_data) {
    return new Response(JSON.stringify({ error: 'Results are not yet available.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resultData: Record<string, number> = JSON.parse(project.result_data as string);
  const strataConfig: StrataDimension[] = JSON.parse(project.strata_config as string);

  const csv = resultToCsv(resultData, strataConfig);
  const filename = `clif_unmasked_${project.name?.toString().replace(/\s+/g, '_') || project.id}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
