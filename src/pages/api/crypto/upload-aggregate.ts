export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  parseMaskedCsv,
  computeMasterKeyFromFragments,
  unmaskServerSide,
  type StrataDimension,
} from '../../../lib/crypto-masking';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, keySetId, csvData } = await request.json();

  if (!projectId || !keySetId || !csvData) {
    return new Response(JSON.stringify({ error: 'projectId, keySetId, and csvData are required.' }), {
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
    return new Response(JSON.stringify({ error: 'Only the project creator can upload aggregated data.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keySetResult = await db.execute({
    sql: 'SELECT * FROM crypto_key_sets WHERE id = ? AND project_id = ?',
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
      JSON.stringify({ error: 'This key set has already been unmasked. Unmasking is a one-time operation.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (keySet.status !== 'keys_assigned' && keySet.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: `Cannot upload data in status: ${keySet.status}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const strataConfig: StrataDimension[] = JSON.parse(keySet.strata_config as string);
  const { data, errors } = parseMaskedCsv(csvData, strataConfig);

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: `CSV parsing errors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const cellCount = Object.keys(data).length;
  if (cellCount === 0) {
    return new Response(JSON.stringify({ error: 'No valid data rows found in CSV.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  await db.execute({
    sql: 'DELETE FROM crypto_submissions WHERE key_set_id = ?',
    args: [keySetId],
  });

  await db.execute({
    sql: `INSERT INTO crypto_submissions (id, project_id, key_set_id, submitted_by, submission_data, submitted_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)`,
    args: [projectId, keySetId, locals.user.id, JSON.stringify(data), now],
  });

  const siteKeysResult = await db.execute({
    sql: 'SELECT key_index, key_data, is_dropped FROM crypto_site_keys WHERE key_set_id = ? ORDER BY key_index',
    args: [keySetId],
  });

  const allFragments: Record<string, number>[] = [];
  const droppedIndices: number[] = [];

  for (let i = 0; i < siteKeysResult.rows.length; i++) {
    const row = siteKeysResult.rows[i];
    allFragments.push(JSON.parse(row.key_data as string));
    if (row.is_dropped) {
      droppedIndices.push(i);
    }
  }

  const droppedSet = new Set(droppedIndices);
  const activeFragments = allFragments.filter((_, i) => !droppedSet.has(i));
  const masterKey = computeMasterKeyFromFragments(activeFragments);

  await db.execute({
    sql: `INSERT OR REPLACE INTO crypto_master_keys (id, project_id, key_set_id, key_data, created_at)
          VALUES (COALESCE((SELECT id FROM crypto_master_keys WHERE key_set_id = ?), lower(hex(randomblob(16)))), ?, ?, ?, ?)`,
    args: [keySetId, projectId, keySetId, JSON.stringify(masterKey), now],
  });

  const unmaskResult = unmaskServerSide(data, allFragments, droppedIndices);

  await db.execute({
    sql: `UPDATE crypto_site_keys SET key_data = '{}' WHERE key_set_id = ?`,
    args: [keySetId],
  });

  await db.execute({
    sql: `UPDATE crypto_key_sets SET status = 'complete', result_data = ? WHERE id = ?`,
    args: [JSON.stringify(unmaskResult.result), keySetId],
  });

  // Roll up project status if every key_set in the project is now complete.
  const remainingResult = await db.execute({
    sql: `SELECT COUNT(*) as c FROM crypto_key_sets WHERE project_id = ? AND status != 'complete'`,
    args: [projectId],
  });
  const remaining = Number(remainingResult.rows[0]?.c ?? 0);
  if (remaining === 0) {
    await db.execute({
      sql: `UPDATE crypto_projects SET status = 'complete', updated_at = ? WHERE id = ?`,
      args: [now, projectId],
    });
  } else {
    await db.execute({
      sql: `UPDATE crypto_projects SET updated_at = ? WHERE id = ?`,
      args: [now, projectId],
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      cellCount,
      result: unmaskResult.result,
      warnings: unmaskResult.warnings,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
