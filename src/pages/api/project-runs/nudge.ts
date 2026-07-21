export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { fanOutNotification } from '../../../lib/notifications';
import { buildProjectRunNudgeEmail } from '../../../lib/email';

// The project run's creator (or an admin) reminds a specific site that it still
// needs to run the project. Notifies that site's assigned editors in-app and by
// email. Mirrors the authorization model of /api/project-runs/notify.
export const POST: APIRoute = async ({ locals, request, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return json({ error: 'Forbidden' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  if (!projectId || !siteId) {
    return json({ error: 'projectId and siteId are required.' }, 400);
  }

  const db = getDb();

  const runRes = await db.execute({
    sql: 'SELECT id, title, results_deadline, created_by FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (runRes.rows.length === 0) {
    return json({ error: 'Project run not found.' }, 404);
  }
  const run = runRes.rows[0];

  // Only the creator or an admin may nudge sites for this run.
  if (user.role !== 'admin' && run.created_by !== user.id) {
    return json({ error: 'Forbidden' }, 403);
  }

  const siteRes = await db.execute({
    sql: 'SELECT id, site_name FROM site_details WHERE id = ?',
    args: [siteId],
  });
  if (siteRes.rows.length === 0) {
    return json({ error: 'Site not found.' }, 404);
  }
  const siteName = siteRes.rows[0].site_name as string;

  // Recipients: everyone assigned to edit this site.
  const editorsRes = await db.execute({
    sql: 'SELECT user_id FROM site_editors WHERE site_id = ?',
    args: [siteId],
  });
  const editorIds = (editorsRes.rows as any[]).map((r) => r.user_id as string);
  if (editorIds.length === 0) {
    return json({ error: `No data editor is assigned to ${siteName} yet.` }, 400);
  }

  const projectTitle = run.title as string;
  const deadline = (run.results_deadline as string) || null;
  const projectUrl = `${url.origin}/portal/project-runs`;

  const sent = await fanOutNotification(
    editorIds,
    {
      type: 'project_run.site_nudged',
      title: `Reminder: run "${projectTitle}" for ${siteName}`,
      body: deadline ? `Results due by the project deadline.` : null,
      link: projectUrl,
      entityType: 'project_run',
      entityId: projectId,
      actorId: user.id,
    },
    {
      subject: `Reminder to run CLIF project: ${projectTitle}`,
      html: buildProjectRunNudgeEmail(siteName, projectTitle, deadline, projectUrl),
    },
  );

  return json({ success: true, sent });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
