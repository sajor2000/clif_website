export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { notifyProjectRunReady } from '../../../lib/notify-project-run';

// The request creator or an admin can notify all approved members that a
// project run is ready.
export const POST: APIRoute = async ({ locals, request, url }) => {
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
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (user.role !== 'admin' && existing.rows[0].created_by !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await notifyProjectRunReady(projectId, url.origin, { excludeUserId: user.id });

  return new Response(JSON.stringify({ sent: result.sent, error: result.error }), {
    status: result.error ? 400 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
