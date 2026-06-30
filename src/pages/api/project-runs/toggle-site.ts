export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

// A site self-reports whether it has run a project. Authorization mirrors
// /api/site-details/update: an admin, or a user assigned as that site's
// site_editor, may toggle that site's box.
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
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  const hasRun = body.hasRun ? 1 : 0;

  if (!projectId || !siteId) {
    return new Response(JSON.stringify({ error: 'projectId and siteId are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Authorization: admin or assigned editor for this site.
  if (user.role !== 'admin') {
    const editor = await db.execute({
      sql: 'SELECT id FROM site_editors WHERE site_id = ? AND user_id = ?',
      args: [siteId, user.id],
    });
    if (editor.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'You can only update your own site.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO project_run_sites (project_id, site_id, has_run, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id, site_id)
          DO UPDATE SET has_run = excluded.has_run, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    args: [projectId, siteId, hasRun, now, user.id],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
