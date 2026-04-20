export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { keyDataToCsv, type StrataDimension } from '../../../lib/crypto-masking';

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

  const keySetResult = await db.execute({
    sql: `SELECT ks.*, p.name as project_name
          FROM crypto_key_sets ks
          JOIN crypto_projects p ON p.id = ks.project_id
          WHERE ks.id = ? AND ks.project_id = ?`,
    args: [keySetId, projectId],
  });

  if (keySetResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Key set not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keySet = keySetResult.rows[0];

  if (keySet.status === 'complete') {
    return new Response(
      JSON.stringify({ error: 'This key set has been unmasked and fragment data has been wiped. Contact the project coordinator to create a new project.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (keySet.status !== 'keys_assigned' && keySet.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: 'Keys are not yet available for download.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const allKeysResult = await db.execute({
    sql: 'SELECT * FROM crypto_site_keys WHERE key_set_id = ?',
    args: [keySetId],
  });

  const userId = locals.user.id;
  const siteKey = allKeysResult.rows.find((row) => {
    const authorized: string[] = JSON.parse((row.authorized_users as string) || '[]');
    return authorized.includes(userId);
  });

  if (!siteKey) {
    return new Response(JSON.stringify({ error: 'You do not have an assigned key fragment for this key set.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const keyData: Record<string, number> = JSON.parse(siteKey.key_data as string);
  const strataConfig: StrataDimension[] = JSON.parse(keySet.strata_config as string);

  const csv = keyDataToCsv(keyData, strataConfig);

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE crypto_site_keys SET downloaded_at = ? WHERE id = ? AND downloaded_at IS NULL',
    args: [now, siteKey.id],
  });

  if (keySet.status === 'keys_assigned') {
    await db.execute({
      sql: `UPDATE crypto_key_sets SET status = 'collecting' WHERE id = ? AND status = 'keys_assigned'`,
      args: [keySetId],
    });
    await db.execute({
      sql: `UPDATE crypto_projects SET status = 'collecting', updated_at = ? WHERE id = ? AND status = 'keys_assigned'`,
      args: [now, projectId],
    });
  }

  const ksNamePart = (keySet.name as string || 'keyset').replace(/\s+/g, '_');
  const labelPart = siteKey.label?.toString().replace(/\s+/g, '_') || siteKey.key_index;
  const filename = `key_${ksNamePart}_${labelPart}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
