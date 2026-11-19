import { timingSafeEqual } from 'node:crypto';
import { getDb } from './turso';

/**
 * One-time mirror of closed project runs into the CLIF GitHub org (see
 * migrations/029-project-run-mirror.sql). The copying itself is done by a
 * GitHub Action in the org's `.github` repo, which holds the org-write token.
 * This module is the website's side: the queue the Action reads and the
 * results it reports back.
 */

export const CLIF_GITHUB_ORG = 'Common-Longitudinal-ICU-data-Format';
const ORG_URL_PREFIX = `https://github.com/${CLIF_GITHUB_ORG}/`;

/** Where skip reports go. */
export const MIRROR_REPORT_EMAIL = 'clif_consortium@uchicago.edu';

export interface MirrorQueueItem {
  id: string;
  project_number: number | null;
  run_number: number | null;
  title: string;
  repo_url: string;
  /** Why the previous attempt was skipped, if it was. */
  mirror_note: string | null;
}

export type MirrorOutcome = 'mirrored' | 'in_org' | 'skipped';

export interface MirrorResult {
  /** project_runs.id. Absent for backfill items that have no tracker row. */
  id?: string;
  title: string;
  repo_url: string;
  outcome: MirrorOutcome;
  /** The org repo holding the code. Required unless skipped. */
  mirror_url?: string;
  /** Why it was skipped. Required when skipped. */
  reason?: string;
}

export interface MirrorSkip {
  title: string;
  repo_url: string;
  reason: string;
}

/** `Authorization: Bearer <MIRROR_SYNC_TOKEN>`, compared in constant time. */
export function isMirrorSyncAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false;
  const given = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Closed runs that have a repo link and no org copy recorded yet. */
export async function collectMirrorQueue(): Promise<MirrorQueueItem[]> {
  const res = await getDb().execute({
    sql: `SELECT id, project_number, run_number, title, repo_url, mirror_note
            FROM project_runs
           WHERE status = 'closed'
             AND repo_url IS NOT NULL AND TRIM(repo_url) <> ''
             AND mirror_url IS NULL
           ORDER BY project_number, run_number`,
    args: [],
  });
  return (res.rows as any[]).map((r) => ({
    id: r.id as string,
    project_number: r.project_number == null ? null : Number(r.project_number),
    run_number: r.run_number == null ? null : Number(r.run_number),
    title: r.title as string,
    repo_url: r.repo_url as string,
    mirror_note: (r.mirror_note as string | null) ?? null,
  }));
}

/** Validate the Action's POST body. Returns the results or an error message. */
export function parseMirrorResults(body: unknown): { results: MirrorResult[] } | { error: string } {
  const list = (body as any)?.results;
  if (!Array.isArray(list)) return { error: 'results must be an array.' };
  const results: MirrorResult[] = [];
  for (const [i, raw] of list.entries()) {
    const at = `results[${i}]`;
    if (!raw || typeof raw !== 'object') return { error: `${at} must be an object.` };
    const { id, title, repo_url, outcome, mirror_url, reason } = raw as Record<string, unknown>;
    if (id !== undefined && typeof id !== 'string') return { error: `${at}.id must be a string.` };
    if (typeof title !== 'string' || !title.trim()) return { error: `${at}.title is required.` };
    if (typeof repo_url !== 'string' || !repo_url.trim()) return { error: `${at}.repo_url is required.` };
    if (outcome === 'skipped') {
      if (typeof reason !== 'string' || !reason.trim()) return { error: `${at}.reason is required when skipped.` };
      results.push({ id, title, repo_url, outcome, reason: reason.trim() });
    } else if (outcome === 'mirrored' || outcome === 'in_org') {
      // Only ever record a link into the CLIF org.
      if (typeof mirror_url !== 'string' || !mirror_url.startsWith(ORG_URL_PREFIX)) {
        return { error: `${at}.mirror_url must be a ${CLIF_GITHUB_ORG} repo URL.` };
      }
      results.push({ id, title, repo_url, outcome, mirror_url });
    } else {
      return { error: `${at}.outcome must be mirrored, in_org or skipped.` };
    }
  }
  return { results };
}

/**
 * Store what the Action did. A run that already has a mirror_url is never
 * changed. Returns the skips worth reporting: ones whose reason is new or
 * different from last time, plus every skip that has no tracker row.
 */
export async function recordMirrorResults(
  results: MirrorResult[],
): Promise<{ recorded: number; skipsToReport: MirrorSkip[] }> {
  const db = getDb();
  let recorded = 0;
  const skipsToReport: MirrorSkip[] = [];

  for (const r of results) {
    if (r.outcome === 'skipped') {
      const skip = { title: r.title, repo_url: r.repo_url, reason: r.reason as string };
      if (!r.id) {
        skipsToReport.push(skip);
        continue;
      }
      const res = await db.execute({
        sql: `UPDATE project_runs SET mirror_note = ?
               WHERE id = ? AND mirror_url IS NULL
                 AND (mirror_note IS NULL OR mirror_note <> ?)
               RETURNING id`,
        args: [skip.reason, r.id, skip.reason],
      });
      if (res.rows.length > 0) skipsToReport.push(skip);
      continue;
    }
    if (!r.id) continue;
    const res = await db.execute({
      sql: `UPDATE project_runs
               SET mirror_url = ?, mirrored_at = datetime('now'), mirror_note = NULL
             WHERE id = ? AND mirror_url IS NULL
             RETURNING id`,
      args: [r.mirror_url as string, r.id],
    });
    recorded += res.rows.length;
  }
  return { recorded, skipsToReport };
}
