export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { computeMasterKeyFromFragments } from '../../../lib/crypto-masking';

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
    sql: 'SELECT created_by FROM crypto_projects WHERE id = ?',
    args: [projectId],
  });

  if (projectResult.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Project not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (projectResult.rows[0].created_by !== locals.user.id) {
    return new Response(JSON.stringify({ error: 'Only the project creator can finalize key sets.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keySetResult = await db.execute({
    sql: 'SELECT status FROM crypto_key_sets WHERE id = ? AND project_id = ?',
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
    return new Response(JSON.stringify({ error: 'Key set is already finalized.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (keySet.status !== 'keys_assigned' && keySet.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: `Cannot finalize key set in status: ${keySet.status}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const now = new Date().toISOString();

  const fragmentsResult = await db.execute({
    sql: 'SELECT key_data, is_dropped FROM crypto_site_keys WHERE key_set_id = ? ORDER BY key_index',
    args: [keySetId],
  });

  const activeFragments = fragmentsResult.rows
    .filter((row) => !row.is_dropped)
    .map((row) => JSON.parse(row.key_data as string) as Record<string, number>);

  if (activeFragments.length > 0 && Object.keys(activeFragments[0]).length > 0) {
    const masterKey = computeMasterKeyFromFragments(activeFragments);
    await db.execute({
      sql: `INSERT OR REPLACE INTO crypto_master_keys (id, project_id, key_set_id, key_data, created_at)
            VALUES (COALESCE((SELECT id FROM crypto_master_keys WHERE key_set_id = ?), lower(hex(randomblob(16)))), ?, ?, ?, ?)`,
      args: [keySetId, projectId, keySetId, JSON.stringify(masterKey), now],
    });
  }

  await Promise.all([
    db.execute({
      sql: `UPDATE crypto_site_keys SET key_data = '{}' WHERE key_set_id = ?`,
      args: [keySetId],
    }),
    db.execute({
      sql: `UPDATE crypto_key_sets SET status = 'complete' WHERE id = ?`,
      args: [keySetId],
    }),
  ]);

  // Roll up project status if every key_set is now complete.
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

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
