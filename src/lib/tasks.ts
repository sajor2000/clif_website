import { getDb } from './turso';
import type { Role } from './roles';

/**
 * Derived "pending tasks" for a member — standing obligations computed live from
 * existing tables (project runs, site details, profile, LOS requests). Nothing
 * is stored: a task disappears the moment its underlying state is resolved (a
 * box is checked, a field is filled, a request is approved), so there is no
 * read/dismiss bookkeeping to drift out of sync. Discrete one-off events live in
 * ./notifications instead.
 */

export type TaskSeverity = 'action' | 'warning' | 'info';

export interface PendingTask {
  key: string; // stable id for de-dup / keys
  kind: 'run_project' | 'stale_site' | 'incomplete_profile' | 'los_review';
  title: string;
  detail?: string;
  link: string;
  severity: TaskSeverity;
  // Site-detail and profile tasks can be dismissed ("nothing to change"); a
  // project you owe or a review you must do cannot. `signature` captures what
  // was dismissed so the task returns if that situation later changes.
  dismissible?: boolean;
  signature?: string;
}

// A site record is considered "stale" if it hasn't been touched in this long OR
// is missing any required field (the user picked BOTH signals).
const STALE_MONTHS = 6;
const SITE_REQUIRED_FIELDS = [
  'data_source',
  'source_data_date_range',
  'irb_number',
  'cohort_inclusion_criteria',
] as const;
// Core profile fields every member should keep current.
const PROFILE_REQUIRED_FIELDS = ['full_name', 'institution', 'work_email'] as const;

interface TaskUser {
  id: string;
  role: Role | string;
}

/**
 * Parse a timestamp out of the database as UTC.
 *
 * SQLite's `datetime('now')` (how site_details.updated_at is written) returns
 * "YYYY-MM-DD HH:MM:SS" — a space separator and no zone marker. `new Date()`
 * reads that as LOCAL time, so every comparison drifts by the runtime's UTC
 * offset. Normalize to an explicit UTC instant instead.
 *
 * `dateOnlyTime` decides what a bare "YYYY-MM-DD" means: start of day for
 * staleness, end of day for deadlines, midday for display.
 * Returns null for missing/unparseable input so each caller decides what that
 * means, rather than throwing on NULL columns.
 */
function parseUtc(value: string | null | undefined, dateOnlyTime = 'T00:00:00Z'): number | null {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  const iso =
    s.length <= 10
      ? s + dateOnlyTime
      : /([zZ]|[+-]\d{2}:?\d{2})$/.test(s)
        ? s // already carries a zone — trust it
        : s.replace(' ', 'T') + 'Z';
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

function isOlderThanMonths(iso: string | null, months: number): boolean {
  const then = parseUtc(iso);
  if (then === null) return true; // never updated counts as stale
  const cutoff = Date.now() - months * 30 * 24 * 60 * 60 * 1000;
  return then < cutoff;
}

/**
 * Has a deadline already passed? A date-only deadline ("2026-07-16") is due at
 * the END of that day, so it only counts as past once the day is over. No
 * deadline is never past (unlike `isOlderThanMonths`, where a missing timestamp
 * means "never updated" and so counts as stale).
 */
function isPast(iso: string | null): boolean {
  const due = parseUtc(iso, 'T23:59:59Z');
  return due !== null && due < Date.now();
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/**
 * Compute every pending task for a member. Safe to call on any portal request;
 * each sub-query is guarded so one failing check never breaks the panel.
 */
export async function computePendingTasks(user: TaskUser): Promise<PendingTask[]> {
  const db = getDb();
  const tasks: PendingTask[] = [];

  // Which sites is this member responsible for? (admins are not implicitly
  // responsible for every site — responsibility comes from site_editors.)
  let siteIds: string[] = [];
  try {
    const res = await db.execute({
      sql: 'SELECT site_id FROM site_editors WHERE user_id = ?',
      args: [user.id],
    });
    siteIds = (res.rows as any[]).map((r) => r.site_id as string);
  } catch (e) {
    // Each section below degrades to "no tasks" rather than breaking the panel.
    // Log it: a missing task is indistinguishable from a resolved one, so a
    // silent failure here is invisible by construction.
    console.error('[tasks] site_editors lookup failed', e);
    siteIds = [];
  }

  // --- 1. Open project runs ---------------------------------------------------
  // Every member sees each open run. A site editor whose site still owes the run
  // gets an actionable "run it for your site" task (one per owing site). Everyone
  // else gets a lower-key info task with the run's progress, so open runs are
  // visible on every dashboard — not just editors'.
  try {
    const openRuns = (await db.execute(
      `SELECT id, title, results_deadline FROM project_runs
       WHERE status = 'open'
       ORDER BY results_deadline IS NULL, results_deadline ASC`,
    )).rows as any[];

    if (openRuns.length > 0) {
      const totalSites =
        Number((await db.execute('SELECT COUNT(*) AS c FROM site_details')).rows[0].c) || 0;

      // How many sites have run each project (for the info task's progress line).
      const ranByProject = new Map<string, number>();
      const ranRes = await db.execute(
        'SELECT project_id, COUNT(*) AS c FROM project_run_sites WHERE has_run = 1 GROUP BY project_id',
      );
      for (const r of ranRes.rows as any[]) ranByProject.set(r.project_id as string, Number(r.c));

      // Which of THIS member's sites still owe which project.
      const owedByProject = new Map<string, { site_id: string; site_name: string }[]>();
      if (siteIds.length > 0) {
        const placeholders = siteIds.map(() => '?').join(', ');
        const res = await db.execute({
          sql: `SELECT p.id AS project_id, sd.id AS site_id, sd.site_name
                FROM project_runs p
                CROSS JOIN site_details sd
                LEFT JOIN project_run_sites prs ON prs.project_id = p.id AND prs.site_id = sd.id
                WHERE p.status = 'open' AND sd.id IN (${placeholders}) AND COALESCE(prs.has_run, 0) = 0`,
          args: siteIds,
        });
        for (const r of res.rows as any[]) {
          const arr = owedByProject.get(r.project_id as string) ?? [];
          arr.push({ site_id: r.site_id as string, site_name: r.site_name as string });
          owedByProject.set(r.project_id as string, arr);
        }
      }

      for (const p of openRuns) {
        const projectId = p.id as string;
        const title = p.title as string;
        const deadline = (p.results_deadline as string) || null;
        const mine = owedByProject.get(projectId);

        if (mine && mine.length > 0) {
          // Actionable: this member edits sites that still owe the run.
          for (const s of mine) {
            tasks.push({
              key: `run_project:${projectId}:${s.site_id}`,
              kind: 'run_project',
              title: `Run "${title}" for ${s.site_name}`,
              detail: !deadline
                ? undefined
                : isPast(deadline)
                  ? `Overdue — results were due ${formatDate(deadline)}`
                  : `Results due ${formatDate(deadline)}`,
              link: '/portal/project-runs',
              severity: 'action',
            });
          }
        } else {
          // Awareness only: shown to members with no actionable stake in this run
          // (not a site editor, or their sites already ran it).
          const ran = ranByProject.get(projectId) ?? 0;
          tasks.push({
            key: `run_project_info:${projectId}`,
            kind: 'run_project',
            title: `Open project run: ${title}`,
            detail: [
              `${ran}/${totalSites} sites have run this`,
              deadline
                ? isPast(deadline)
                  ? `overdue ${formatDate(deadline)}`
                  : `due ${formatDate(deadline)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            link: '/portal/project-runs',
            severity: 'info',
          });
        }
      }
    }
  } catch (e) {
    console.error('[tasks] open project-run check failed', e);
  }

  // --- 2. Update stale / incomplete site details -----------------------------
  if (siteIds.length > 0) {
    try {
      const placeholders = siteIds.map(() => '?').join(', ');
      const cols = ['id', 'site_name', 'updated_at', ...SITE_REQUIRED_FIELDS].join(', ');
      const res = await db.execute({
        sql: `SELECT ${cols} FROM site_details WHERE id IN (${placeholders})`,
        args: siteIds,
      });
      for (const r of res.rows as any[]) {
        const missing = SITE_REQUIRED_FIELDS.filter((f) => isBlank(r[f]));
        const stale = isOlderThanMonths(r.updated_at as string | null, STALE_MONTHS);
        if (missing.length === 0 && !stale) continue;
        const detail =
          missing.length > 0
            ? `Missing: ${missing.map(prettyField).join(', ')}`
            : r.updated_at
              ? `Not updated since ${formatDate(r.updated_at as string)}`
              : 'Never reviewed';
        tasks.push({
          key: `stale_site:${r.id}`,
          kind: 'stale_site',
          title: `Review site details for ${r.site_name}`,
          detail,
          link: '/portal/site-details',
          severity: missing.length > 0 ? 'action' : 'warning',
          dismissible: true,
          // Reason snapshot: exactly which fields are missing + whether stale.
          // A new missing field or a fresh staleness changes this, so a prior
          // "nothing to change" dismissal no longer applies.
          signature: `m:${missing.slice().sort().join(',')}|s:${stale ? 1 : 0}`,
        });
      }
    } catch (e) {
      console.error('[tasks] site-details check failed', e);
    }
  }

  // --- 3. Complete your own member profile -----------------------------------
  try {
    const cols = PROFILE_REQUIRED_FIELDS.join(', ');
    const res = await db.execute({
      sql: `SELECT ${cols} FROM users WHERE id = ?`,
      args: [user.id],
    });
    const row = res.rows[0] as any;
    if (row) {
      const missing = PROFILE_REQUIRED_FIELDS.filter((f) => isBlank(row[f]));
      if (missing.length > 0) {
        tasks.push({
          key: 'incomplete_profile',
          kind: 'incomplete_profile',
          title: 'Complete your member profile',
          detail: `Missing: ${missing.map(prettyField).join(', ')}`,
          link: `/portal/members/${user.id}`,
          severity: 'action',
          dismissible: true,
          signature: `m:${missing.slice().sort().join(',')}`,
        });
      }
    }
  } catch (e) {
    console.error('[tasks] profile-completeness check failed', e);
  }

  // --- 4. Letters of support awaiting your approval (steering / admin) --------
  if (user.role === 'steering' || user.role === 'admin') {
    try {
      const res = await db.execute({
        sql: `SELECT id, grant_title, grant_deadline FROM los_requests WHERE status = 'pending'`,
        args: [],
      });
      for (const r of res.rows as any[]) {
        const deadline = r.grant_deadline as string | null;
        tasks.push({
          key: `los_review:${r.id}`,
          kind: 'los_review',
          title: `Review letter of support: ${r.grant_title}`,
          detail: deadline ? `Grant deadline ${formatDate(deadline)}` : 'Awaiting steering approval',
          link: '/portal/los-requests',
          severity: 'action',
        });
      }
    } catch (e) {
      console.error('[tasks] letter-of-support check failed', e);
    }
  }

  // Drop dismissible tasks the member has waved away — but only while the
  // dismissed signature still matches. If the situation changed, the signature
  // differs and the task stays, so nothing important is silenced permanently.
  const dismissed = new Map<string, string>();
  try {
    const res = await db.execute({
      sql: 'SELECT task_key, signature FROM task_dismissals WHERE user_id = ?',
      args: [user.id],
    });
    for (const r of res.rows as any[]) dismissed.set(r.task_key as string, r.signature as string);
  } catch (e) {
    // Showing everything is the safe failure here — better a task the member
    // already waved away than a silently suppressed one.
    console.error('[tasks] dismissal lookup failed — showing all tasks', e);
  }

  return tasks.filter((t) => !(t.dismissible && dismissed.get(t.key) === t.signature));
}

/**
 * Count for the nav badge: only tasks the member can actually resolve.
 *
 * `info` tasks (an open run the member has no stake in) carry no action and
 * cannot be dismissed, so counting them leaves members with a badge they are
 * powerless to clear — and a badge that never reaches zero stops being read as
 * "you have work", taking the actionable items down with it. They still render
 * in the list; they just don't inflate the count.
 */
export async function pendingTaskCount(user: TaskUser): Promise<number> {
  const tasks = await computePendingTasks(user);
  return tasks.filter((t) => t.severity !== 'info').length;
}

function prettyField(f: string): string {
  return f
    .replace(/_/g, ' ')
    .replace(/\birb\b/i, 'IRB')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(dateStr: string | null | undefined): string {
  // Midday UTC for date-only input, so the rendered calendar date can't slip a
  // day in either direction.
  const t = parseUtc(dateStr, 'T12:00:00Z');
  if (t === null) return typeof dateStr === 'string' && dateStr.trim() ? dateStr : 'unknown date';
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
