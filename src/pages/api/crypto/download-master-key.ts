export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
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

  const { projectId, keySetId } = await request.json();
  if (!projectId || !keySetId) {
    return new Response(JSON.stringify({ error: 'projectId and keySetId are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const projectResult = await db.execute({
    sql: 'SELECT created_by, master_key_authorized, name FROM crypto_projects WHERE id = ?',
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

  const keySetResult = await db.execute({
    sql: 'SELECT strata_config, name FROM crypto_key_sets WHERE id = ? AND project_id = ?',
    args: [keySetId, projectId],
  });

  if (keySetResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Key set not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keySet = keySetResult.rows[0];
  const strataConfig: StrataDimension[] = JSON.parse(keySet.strata_config as string);

  const storedResult = await db.execute({
    sql: 'SELECT key_data FROM crypto_master_keys WHERE key_set_id = ?',
    args: [keySetId],
  });

  if (storedResult.rows.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Master key is not available yet. The key set must be finalized or unmasked first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const masterKey: Record<string, number> = JSON.parse(storedResult.rows[0].key_data as string);

  const csv = keyDataToCsv(masterKey, strataConfig);
  const projectName = (project.name as string || 'project').replace(/\s+/g, '_');
  const ksName = (keySet.name as string || 'keyset').replace(/\s+/g, '_');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="master_key_${projectName}_${ksName}.csv"`,
    },
  });
};
