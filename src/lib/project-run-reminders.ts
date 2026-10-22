import { getDb } from './turso';
import { addDays, daysBetween, todayInConsortiumTz } from './project-run-deadline';
import { buildDeadlineReminderSlackMessage, postSlackMessage } from './slack';

/**
 * Deadline reminders for project runs, posted to #run_requests.
 *
 * Each open run gets a reminder once its Box upload deadline is within a week
 * and another once it is within a day: how many of the applicable sites have
 * run it and which sites are still pending. Every post is recorded in
 * project_run_reminders keyed by (run, deadline, window), so the daily job
 * can't repeat itself, while a deadline the requester pushes out earns fresh
 * reminders when it comes round.
 *
 * Windows are thresholds ("within N days"), not exact offsets, so a run whose
 * deadline is edited to land inside the week, or a day the cron didn't fire,
 * is still caught. A run entering several windows at once (e.g. created three
 * days before its deadline) gets a single post that satisfies all of them.
 *
 * A run every applicable site has already run is skipped without being
 * recorded: there is nobody to remind, and if a site un-ticks its box later
 * the next day's job will still catch it.
 */
export const REMINDER_WINDOWS_DAYS = [7, 1] as const;

/**
 * Sites still onboarding, not yet in a position to run any project. They are
 * left out of reminders entirely -- neither listed as pending nor counted in
 * the "N / M sites" denominator -- so the channel isn't chasing them. Remove a
 * site here once it is ready. Matched on site_details.site_name.
 */
export const SITES_NOT_YET_RUNNING = new Set([
  'Harvard University',
  'Yale University',
  'University of Colorado',
]);

export interface DeadlineReminderOutcome {
  id: string;
  projectNumber: number | null;
  title: string;
  deadline: string;
  daysLeft: number;
  ran: number;
  applicable: number;
  pending: string[];
  posted: boolean;
  error?: string;
}

export async function sendDeadlineReminders(
  origin: string,
  now: Date = new Date(),
): Promise<{ today: string; reminders: DeadlineReminderOutcome[] }> {
  const db = getDb();
  const today = todayInConsortiumTz(now);
  const horizon = addDays(today, Math.max(...REMINDER_WINDOWS_DAYS));

  const runsRes = await db.execute({
    sql: `SELECT p.id, p.project_number, p.run_number, p.title, p.results_deadline, p.conference,
                 u.full_name AS requester_name, u.email AS requester_email
          FROM project_runs p
          LEFT JOIN users u ON u.id = p.created_by
          WHERE p.status = 'open'
            AND p.results_deadline IS NOT NULL
            AND p.results_deadline >= ? AND p.results_deadline <= ?
          ORDER BY p.results_deadline, p.project_number, p.run_number`,
    args: [today, horizon],
  });
  const runs = runsRes.rows as any[];
  const reminders: DeadlineReminderOutcome[] = [];
  if (runs.length === 0) return { today, reminders };

  // The tracker's denominator -- every site in site_details minus the ones
  // marked N/A for the run -- less the sites that can't run anything yet.
  const sitesRes = await db.execute('SELECT id, site_name FROM site_details ORDER BY site_name');
  const sites = (sitesRes.rows as any[])
    .map((s) => ({ id: s.id as string, name: s.site_name as string }))
    .filter((s) => !SITES_NOT_YET_RUNNING.has(s.name));
  const projectUrl = `${origin}/portal/project-runs`;

  for (const r of runs) {
    const id = r.id as string;
    const deadline = r.results_deadline as string;
    const daysLeft = daysBetween(today, deadline);

    // Windows this run is inside that haven't had their post for this deadline.
    const sentRes = await db.execute({
      sql: 'SELECT days_before FROM project_run_reminders WHERE project_id = ? AND deadline = ?',
      args: [id, deadline],
    });
    const sent = new Set((sentRes.rows as any[]).map((s) => Number(s.days_before)));
    const due = REMINDER_WINDOWS_DAYS.filter((w) => daysLeft <= w && !sent.has(w));
    if (due.length === 0) continue;

    const statusRes = await db.execute({
      sql: 'SELECT site_id, has_run, not_applicable FROM project_run_sites WHERE project_id = ?',
      args: [id],
    });
    const ran = new Set<string>();
    const na = new Set<string>();
    const known = new Set(sites.map((s) => s.id));
    for (const s of statusRes.rows as any[]) {
      if (!known.has(s.site_id as string)) continue; // an excluded site's row
      if (Number(s.has_run) === 1) ran.add(s.site_id as string);
      else if (Number(s.not_applicable) === 1) na.add(s.site_id as string);
    }
    const pending = sites.filter((s) => !ran.has(s.id) && !na.has(s.id)).map((s) => s.name);

    const outcome: DeadlineReminderOutcome = {
      id,
      projectNumber: r.project_number == null ? null : Number(r.project_number),
      title: r.title as string,
      deadline,
      daysLeft,
      ran: ran.size,
      applicable: sites.length - na.size,
      pending,
      posted: false,
    };
    reminders.push(outcome);
    if (pending.length === 0) continue;

    const res = await postSlackMessage(
      buildDeadlineReminderSlackMessage({
        projectNumber: outcome.projectNumber,
        runNumber: r.run_number == null ? null : Number(r.run_number),
        title: outcome.title,
        deadline,
        daysLeft,
        conference: (r.conference as string) || null,
        requestedBy: (r.requester_name as string) || (r.requester_email as string) || null,
        ranCount: outcome.ran,
        applicableCount: outcome.applicable,
        naCount: na.size,
        pendingSites: pending,
        projectUrl,
      }),
    );
    if (!res.ok) {
      // Not recorded, so tomorrow's run retries (e.g. webhook outage).
      outcome.error = res.error;
      continue;
    }
    // One post covers every window the run is inside today.
    for (const w of due) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO project_run_reminders (project_id, deadline, days_before) VALUES (?, ?, ?)',
        args: [id, deadline, w],
      });
    }
    outcome.posted = true;
  }

  return { today, reminders };
}
