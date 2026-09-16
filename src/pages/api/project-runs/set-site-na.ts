export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

const MAX_REASON_LENGTH = 500;

// Mark a site N/A for a project run (the project does not apply to it), or undo
// that. An N/A site is no longer owed the run. Marking N/A clears has_run.
//
// Authorization is wider than /toggle-site: that site's assigned editor, the
// run's requester, or an admin. Only a site's own editor (or an admin) can
// claim the site has RUN the project, but the requester may also exclude a site
// they know the project doesn't apply to.
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return json({ error: 'Forbidden' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  const notApplicable = body.notApplicable ? 1 : 0;
  const reason =
    notApplicable && typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim().slice(0, MAX_REASON_LENGTH)
      : null;

  if (!projectId || !siteId) {
    return json({ error: 'projectId and siteId are required.' }, 400);
  }

  const db = getDb();

  const runRes = await db.execute({
    sql: 'SELECT created_by, status FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (runRes.rows.length === 0) {
    return json({ error: 'Project run not found.' }, 404);
  }
  if (runRes.rows[0].status === 'upcoming') {
    return json({ error: "Sites can't act on this run until it launches." }, 400);
  }

  if (user.role !== 'admin' && runRes.rows[0].created_by !== user.id) {
    const editor = await db.execute({
      sql: 'SELECT id FROM site_editors WHERE site_id = ? AND user_id = ?',
      args: [siteId, user.id],
    });
    if (editor.rows.length === 0) {
      return json(
        { error: "Only this site's data editor, the run's requester, or an admin can change this." },
        403,
      );
    }
  }

  const now = new Date().toISOString();

  // Marking N/A also clears has_run; undoing N/A leaves has_run alone (it is
  // already 0, since the two states are mutually exclusive).
  await db.execute({
    sql: `INSERT INTO project_run_sites (project_id, site_id, has_run, not_applicable, na_reason, updated_at, updated_by)
          VALUES (?, ?, 0, ?, ?, ?, ?)
          ON CONFLICT(project_id, site_id)
          DO UPDATE SET
            has_run = CASE WHEN excluded.not_applicable = 1 THEN 0 ELSE has_run END,
            not_applicable = excluded.not_applicable,
            na_reason = excluded.na_reason,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by`,
    args: [projectId, siteId, notApplicable, reason, now, user.id],
  });

  return json({ success: true, notApplicable: notApplicable === 1, reason });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
