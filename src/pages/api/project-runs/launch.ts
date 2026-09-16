export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { parseProjectRunFields } from './create';
import { isDeadlineAhead } from '../../../lib/project-run-deadline';
import { announceProjectRun } from '../../../lib/notify-project-run';
import { parseConference } from '../../../lib/project-run-status';

/**
 * Launch an upcoming run: save the submitted fields with the full checks a new
 * open run gets (repo, Box folder, preliminary results, a deadline ahead), move
 * it to open, and announce it the way /create announces an open run.
 *
 * Same permission rule as /update: the run's creator, or an admin.
 */
export const POST: APIRoute = async ({ locals, request, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return json({ error: 'Forbidden' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!projectId) {
    return json({ error: 'projectId is required.' }, 400);
  }

  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT created_by, status, conference FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (existing.rows.length === 0) {
    return json({ error: 'Not found.' }, 404);
  }
  const run = existing.rows[0];
  if (user.role !== 'admin' && run.created_by !== user.id) {
    return json({ error: 'Forbidden' }, 403);
  }
  if (run.status !== 'upcoming') {
    return json({ error: 'Only an upcoming run can be launched.' }, 400);
  }

  const parsed = parseProjectRunFields(body, 'full');
  if ('error' in parsed) {
    return json({ error: parsed.error }, 400);
  }
  const f = parsed.fields;
  if (!isDeadlineAhead(f.results_deadline)) {
    return json({ error: 'Launching a run needs a Box upload deadline of today or later.' }, 400);
  }

  // The status guard makes a double-submitted launch a no-op rather than a
  // second announcement.
  const res = await db.execute({
    sql: `UPDATE project_runs SET
            title = ?, repo_url = ?, box_folder_url = ?, prelim_shared = ?,
            prelim_link = ?, description = ?, instructions = ?, purpose = ?, purpose_detail = ?,
            results_deadline = ?, clif_version = ?, required_tables = ?, conference = ?,
            status = 'open', updated_at = ?
          WHERE id = ? AND status = 'upcoming'`,
    args: [
      f.title,
      f.repo_url,
      f.box_folder_url,
      f.prelim_shared,
      f.prelim_link,
      f.description,
      f.instructions,
      f.purpose,
      f.purpose_detail,
      f.results_deadline,
      f.clif_version,
      JSON.stringify(f.required_tables),
      parseConference(body.conference, run.conference),
      new Date().toISOString(),
      projectId,
    ],
  });
  if (res.rowsAffected === 0) {
    return json({ error: 'This run was already launched.' }, 409);
  }

  announceProjectRun(projectId, { origin: url.origin, notifyAll: !!body.notify_all, requester: user }).catch(() => {});

  return json({ success: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
