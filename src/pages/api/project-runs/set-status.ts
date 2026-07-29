export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

/**
 * Open/close a project run and nothing else.
 *
 * Closing is the routine end-of-lifecycle step — it is what stops an open run
 * appearing as a pending task on every member's dashboard — so it gets its own
 * one-column endpoint rather than riding on /update. That route revalidates and
 * rewrites every field, which would both reject a status-only payload and let a
 * stale edit form clobber concurrent changes to unrelated columns.
 *
 * Same permission rule as /update: the run's creator, or an admin.
 */
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
  if (body.status !== 'open' && body.status !== 'closed') {
    return new Response(JSON.stringify({ error: "status must be 'open' or 'closed'." }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const status = body.status;

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

  await db.execute({
    sql: "UPDATE project_runs SET status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [status, projectId],
  });

  return new Response(JSON.stringify({ ok: true, status }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
