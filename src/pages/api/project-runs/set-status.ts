export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { isDeadlineAhead, isValidDate } from '../../../lib/project-run-deadline';

/**
 * Open/close a project run and nothing else.
 *
 * Closing is the routine end-of-lifecycle step — it is what stops an open run
 * appearing as a pending task on every member's dashboard — so it gets its own
 * one-column endpoint rather than riding on /update. That route revalidates and
 * rewrites every field, which would both reject a status-only payload and let a
 * stale edit form clobber concurrent changes to unrelated columns.
 *
 * Reopening must come with a new Box upload deadline of today or later. Runs
 * close automatically once their deadline passes (/auto-close), so reopening
 * without moving the deadline would just be undone the next night. The rule is
 * that an open run always has a deadline ahead of it.
 *
 * An upcoming run can be closed here (cancelled) but not opened; see /launch.
 *
 * Same permission rule as /update: the run's creator, or an admin.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return json({ error: 'Forbidden' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!projectId) {
    return json({ error: 'projectId is required.' }, 400);
  }
  if (body.status !== 'open' && body.status !== 'closed') {
    return json({ error: "status must be 'open' or 'closed'." }, 400);
  }
  const status = body.status;

  const deadline = typeof body.results_deadline === 'string' ? body.results_deadline.trim() : '';
  if (status === 'open' && !(isValidDate(deadline) && isDeadlineAhead(deadline))) {
    return json({ error: 'Reopening a run needs a new Box upload deadline of today or later.' }, 400);
  }

  const db = getDb();

  const existing = await db.execute({
    sql: `SELECT p.created_by, p.status, p.repo_url, p.box_folder_url, p.prelim_shared, p.prelim_link,
                 (SELECT MAX(run_number) FROM project_runs WHERE project_number = p.project_number) AS latest_run,
                 p.run_number
            FROM project_runs p WHERE p.id = ?`,
    args: [projectId],
  });
  if (existing.rows.length === 0) {
    return json({ error: 'Not found.' }, 404);
  }
  const run = existing.rows[0];
  if (user.role !== 'admin' && run.created_by !== user.id) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (status === 'open') {
    // Opening an upcoming run is /launch's job — it runs the full checks and
    // announces the run.
    if (run.status === 'upcoming') {
      return json({ error: 'Use Launch run to open an upcoming run.' }, 400);
    }
    // A run that has been rerun is history; the newer run is the one sites act on.
    if (run.latest_run != null && Number(run.run_number) < Number(run.latest_run)) {
      return json({ error: `This run was superseded by run ${run.latest_run}. Reopen that one instead.` }, 400);
    }
    // A run closed before it launched may still lack what sites need.
    if (!run.repo_url || !run.box_folder_url || !run.prelim_shared || !run.prelim_link) {
      return json(
        { error: 'This run is missing its repo, Box folder or preliminary results. Edit the run to add them.' },
        400,
      );
    }
  }

  if (status === 'open') {
    await db.execute({
      sql: "UPDATE project_runs SET status = 'open', results_deadline = ?, updated_at = datetime('now') WHERE id = ?",
      args: [deadline, projectId],
    });
  } else {
    await db.execute({
      sql: "UPDATE project_runs SET status = 'closed', updated_at = datetime('now') WHERE id = ?",
      args: [projectId],
    });
  }

  return json({ ok: true, status });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
