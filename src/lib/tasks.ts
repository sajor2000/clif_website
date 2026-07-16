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

function isOlderThanMonths(iso: string | null, months: number): boolean {
  if (!iso) return true; // never updated counts as stale
  const then = new Date(iso).getTime();
  if (isNaN(then)) return true;
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
  if (!iso) return false;
  const due = new Date(iso.length <= 10 ? iso + 'T23:59:59Z' : iso).getTime();
  return !isNaN(due) && due < Date.now();
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
  } catch {
    siteIds = [];
  }

  // --- 1. Run an open project at a site you edit ------------------------------
  if (siteIds.length > 0) {
    try {
      const placeholders = siteIds.map(() => '?').join(', ');
      const res = await db.execute({
        sql: `SELECT p.id AS project_id, p.title, p.results_deadline,
                     sd.id AS site_id, sd.site_name
              FROM project_runs p
              CROSS JOIN site_details sd
              LEFT JOIN project_run_sites prs
                     ON prs.project_id = p.id AND prs.site_id = sd.id
              WHERE p.status = 'open'
                AND sd.id IN (${placeholders})
                AND COALESCE(prs.has_run, 0) = 0
              ORDER BY p.results_deadline IS NULL, p.results_deadline ASC`,
        args: siteIds,
      });
      for (const r of res.rows as any[]) {
        const deadline = r.results_deadline as string | null;
        tasks.push({
          key: `run_project:${r.project_id}:${r.site_id}`,
          kind: 'run_project',
          title: `Run "${r.title}" for ${r.site_name}`,
          detail: !deadline
            ? undefined
            : isPast(deadline)
              ? `Overdue — results were due ${formatDate(deadline)}`
              : `Results due ${formatDate(deadline)}`,
          link: '/portal/project-runs',
          // Running an open project is always an action item; the query orders
          // by deadline (soonest first, undated last) and the severity sort is
          // stable, so overdue rows stay at the top of the panel.
          severity: 'action',
        });
      }
    } catch {
      /* skip this check on error */
    }
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
            : `Not updated since ${formatDate(r.updated_at as string)}`;
        tasks.push({
          key: `stale_site:${r.id}`,
          kind: 'stale_site',
          title: `Review site details for ${r.site_name}`,
          detail,
          link: '/portal/site-details',
          severity: missing.length > 0 ? 'action' : 'warning',
        });
      }
    } catch {
      /* skip */
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
        });
      }
    }
  } catch {
    /* skip */
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
    } catch {
      /* skip */
    }
  }

  return tasks;
}

/** Lightweight count for badges — avoids building full task objects downstream. */
export async function pendingTaskCount(user: TaskUser): Promise<number> {
  return (await computePendingTasks(user)).length;
}

function prettyField(f: string): string {
  return f
    .replace(/_/g, ' ')
    .replace(/\birb\b/i, 'IRB')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T12:00:00Z' : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
