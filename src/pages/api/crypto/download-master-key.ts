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

  const masterKeyAuthorized: string[] = JSON.parse((project.master_key_authorized as string) || '[]');
  const canDownload = project.created_by === locals.user.id
    || masterKeyAuthorized.includes(locals.user.id);

  if (!canDownload) {
    return new Response(JSON.stringify({ error: 'You are not authorized to download the master key.' }), {
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
    // Compute from active (non-dropped) fragments (before unmasking)
    const fragmentsResult = await db.execute({
      sql: 'SELECT key_data, is_dropped FROM crypto_site_keys WHERE project_id = ? ORDER BY key_index',
      args: [projectId],
    });

    const activeFragments = fragmentsResult.rows
      .filter((row) => !row.is_dropped)
      .map((row) => JSON.parse(row.key_data as string) as Record<string, number>);

    if (activeFragments.length === 0 || Object.keys(activeFragments[0]).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Master key is not available.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    masterKey = computeMasterKeyFromFragments(activeFragments);
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
