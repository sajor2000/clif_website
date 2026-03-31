export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, resultData } = await request.json();

  if (!projectId || !resultData) {
    return new Response(JSON.stringify({ error: 'projectId and resultData are required.' }), {
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
    return new Response(JSON.stringify({ error: 'Only the project creator can save results.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE crypto_projects SET result_data = ?, status = 'complete', updated_at = ? WHERE id = ?`,
    args: [JSON.stringify(resultData), now, projectId],
  });

  // Wipe all fragment key data — no longer needed after unmasking
  await db.execute({
    sql: `UPDATE crypto_site_keys SET key_data = '{}' WHERE project_id = ?`,
    args: [projectId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
