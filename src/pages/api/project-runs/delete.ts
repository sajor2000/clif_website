export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

// The request creator or an admin can delete a project run request.
// Per-site rows are removed via ON DELETE CASCADE.
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const existing = await db.execute({
    sql: 'SELECT created_by FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (existing.rows.length === 0) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (user.role !== 'admin' && existing.rows[0].created_by !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.execute({ sql: 'DELETE FROM project_runs WHERE id = ?', args: [projectId] });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
