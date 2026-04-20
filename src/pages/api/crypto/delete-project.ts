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

  const { projectId, action } = await request.json();
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
    return new Response(JSON.stringify({ error: 'Only the project creator or admin can manage this project.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (action === 'delete') {
    // Hard delete — remove project and all related data. Explicit deletes in
    // dependency order so we don't rely on FK cascade (Turso versions vary).
    await db.execute({ sql: 'DELETE FROM crypto_submissions WHERE project_id = ?', args: [projectId] });
    await db.execute({ sql: 'DELETE FROM crypto_site_keys WHERE project_id = ?', args: [projectId] });
    await db.execute({ sql: 'DELETE FROM crypto_master_keys WHERE project_id = ?', args: [projectId] });
    await db.execute({ sql: 'DELETE FROM crypto_key_sets WHERE project_id = ?', args: [projectId] });
    await db.execute({ sql: 'DELETE FROM crypto_projects WHERE id = ?', args: [projectId] });

    return new Response(JSON.stringify({ success: true, deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Default: cancel
  if (project.status === 'complete') {
    return new Response(JSON.stringify({ error: 'Completed projects cannot be cancelled.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE crypto_projects SET status = 'cancelled', updated_at = ? WHERE id = ?`,
    args: [now, projectId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
