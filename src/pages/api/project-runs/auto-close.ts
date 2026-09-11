export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { todayInConsortiumTz } from '../../../lib/project-run-deadline';

/**
 * Auto-close job. Invoked daily by Vercel Cron (see vercel.json), scheduled
 * for 08:00 UTC, which is after midnight in Chicago year-round.
 *
 * Closes every open project run whose Box upload deadline has passed, meaning
 * the deadline is before today's Chicago date. No grace period. Closing has the
 * same effect as the requester clicking "Close run": the run leaves members'
 * pending tasks and site checkboxes lock. The requester or an admin can reopen
 * it, but only by setting a new deadline of today or later (enforced by
 * /set-status), so a reopened run is not immediately re-closed here.
 *
 * Runs with no deadline (possible only for rows that predate the required
 * field) are left alone.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The request is
 * rejected unless CRON_SECRET is configured and matches.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET || import.meta.env.CRON_SECRET;
  if (!secret) {
    return json({ error: 'CRON_SECRET not configured' }, 500);
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const today = todayInConsortiumTz();
  const res = await getDb().execute({
    sql: `UPDATE project_runs SET status = 'closed', updated_at = datetime('now')
          WHERE status = 'open' AND results_deadline IS NOT NULL AND results_deadline < ?
          RETURNING id, project_number, title, results_deadline`,
    args: [today],
  });

  const closed = (res.rows as any[]).map((r) => ({
    id: r.id as string,
    projectNumber: r.project_number == null ? null : Number(r.project_number),
    title: r.title as string,
    deadline: r.results_deadline as string,
  }));
  if (closed.length > 0) {
    console.log(`[auto-close] closed ${closed.length} project run(s) past their deadline`, closed);
  }

  return json({ success: true, today, closed });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
