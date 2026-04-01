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

  if (project.created_by !== locals.user.id) {
    return new Response(JSON.stringify({ error: 'Only the project creator can finalize the project.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (project.status === 'complete') {
    return new Response(JSON.stringify({ error: 'Project is already finalized.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (project.status !== 'keys_assigned' && project.status !== 'collecting') {
    return new Response(
      JSON.stringify({ error: `Cannot finalize project in status: ${project.status}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const now = new Date().toISOString();

  // Store master key as audit record before wiping fragments
  const fragmentsResult = await db.execute({
    sql: 'SELECT key_data, is_dropped FROM crypto_site_keys WHERE project_id = ? ORDER BY key_index',
    args: [projectId],
  });

  const allFragments = fragmentsResult.rows.map(
    (row) => JSON.parse(row.key_data as string) as Record<string, number>,
  );

  if (allFragments.length > 0 && Object.keys(allFragments[0]).length > 0) {
    const masterKey = computeMasterKeyFromFragments(allFragments);
    await db.execute({
      sql: 'DELETE FROM crypto_master_keys WHERE project_id = ?',
      args: [projectId],
    });
    await db.execute({
      sql: `INSERT INTO crypto_master_keys (id, project_id, key_data, created_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?)`,
      args: [projectId, JSON.stringify(masterKey), now],
    });
  }

  // Wipe all fragment key data
  await db.execute({
    sql: `UPDATE crypto_site_keys SET key_data = '{}' WHERE project_id = ?`,
    args: [projectId],
  });

  // Mark project as complete
  await db.execute({
    sql: `UPDATE crypto_projects SET status = 'complete', updated_at = ? WHERE id = ?`,
    args: [now, projectId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
