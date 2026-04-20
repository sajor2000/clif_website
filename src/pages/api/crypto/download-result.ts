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
  const keySetId = url.searchParams.get('keySetId');

  if (!projectId || !keySetId) {
    return new Response(JSON.stringify({ error: 'projectId and keySetId are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const projectResult = await db.execute({
    sql: 'SELECT created_by, name FROM crypto_projects WHERE id = ?',
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

  const keySetResult = await db.execute({
    sql: 'SELECT strata_config, status, result_data, name FROM crypto_key_sets WHERE id = ? AND project_id = ?',
    args: [keySetId, projectId],
  });

  if (keySetResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Key set not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keySet = keySetResult.rows[0];

  if (keySet.status !== 'complete' || !keySet.result_data) {
    return new Response(JSON.stringify({ error: 'Results are not yet available for this key set.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resultData: Record<string, number> = JSON.parse(keySet.result_data as string);
  const strataConfig: StrataDimension[] = JSON.parse(keySet.strata_config as string);

  const csv = resultToCsv(resultData, strataConfig);
  const projectName = (project.name as string || projectId).replace(/\s+/g, '_');
  const ksName = (keySet.name as string || 'keyset').replace(/\s+/g, '_');
  const filename = `clif_unmasked_${projectName}_${ksName}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
