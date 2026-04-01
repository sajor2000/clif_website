export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  computeMasterKeyFromFragments,
  keyDataToCsv,
  type StrataDimension,
} from '../../../lib/crypto-masking';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId } = await request.json();
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
    return new Response(JSON.stringify({ error: 'Only the project creator can download the master key.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const strataConfig: StrataDimension[] = JSON.parse(project.strata_config as string);
  let masterKey: Record<string, number>;

  // Try stored master key first (available after unmasking)
  const storedResult = await db.execute({
    sql: 'SELECT key_data FROM crypto_master_keys WHERE project_id = ?',
    args: [projectId],
  });

  if (storedResult.rows.length > 0) {
    masterKey = JSON.parse(storedResult.rows[0].key_data as string);
  } else {
    // Compute from live fragments (before unmasking)
    const fragmentsResult = await db.execute({
      sql: 'SELECT key_data FROM crypto_site_keys WHERE project_id = ? ORDER BY key_index',
      args: [projectId],
    });

    const fragments = fragmentsResult.rows.map(
      (row) => JSON.parse(row.key_data as string) as Record<string, number>,
    );

    if (fragments.length === 0 || Object.keys(fragments[0]).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Master key is not available.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    masterKey = computeMasterKeyFromFragments(fragments);
  }

  const csv = keyDataToCsv(masterKey, strataConfig);
  const projectName = (project.name as string || 'project').replace(/\s+/g, '_');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="master_key_${projectName}.csv"`,
    },
  });
};
