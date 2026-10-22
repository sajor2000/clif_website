/**
 * Rows for the project-run spreadsheet export (/api/project-runs/export).
 *
 * Two sheets: "Runs" carries one row per run with everything the tracker card
 * shows, and "Site status" is a run × site matrix of who has run it. Pure
 * functions so the shape is unit-tested without a database.
 */
import { isDeadlineAhead, todayInConsortiumTz } from './project-run-deadline';
import { CURRENT_ATS, PURPOSE_LABELS, STATUS_BADGE, toProjectRunStatus } from './project-run-status';
import type { Cell, Sheet } from './xlsx';

/** Mirrors the tabs on /portal/project-runs (see matches() there). */
export const EXPORT_FILTERS = ['active', 'upcoming', 'ats', 'all'] as const;
export type ExportFilter = (typeof EXPORT_FILTERS)[number];

export function toExportFilter(value: unknown): ExportFilter {
  return (EXPORT_FILTERS as readonly unknown[]).includes(value) ? (value as ExportFilter) : 'active';
}

/** A project_runs row joined with its creator's name. */
export interface ExportRun {
  id: string;
  project_number?: number | null;
  /** 1 for the original run of a project, 2+ for reruns (NULL on rows predating it). */
  run_number?: number | null;
  title: string;
  status?: string | null;
  conference?: string | null;
  purpose?: string | null;
  purpose_detail?: string | null;
  clif_version?: string | null;
  required_tables?: string | null;
  prelim_shared?: number | null;
  prelim_link?: string | null;
  repo_url?: string | null;
  box_folder_url?: string | null;
  results_deadline?: string | null;
  creator_name?: string | null;
  created_at?: string | null;
  description?: string | null;
  instructions?: string | null;
}

export interface ExportSite {
  id: string;
  site_name: string;
}

/** A project_run_sites row; only rows with has_run or not_applicable set matter. */
export interface ExportSiteStatus {
  project_id: string;
  site_id: string;
  has_run?: number | null;
  not_applicable?: number | null;
  na_reason?: string | null;
}

/**
 * Same rule as the page's tab filter: active is open and not past its Box
 * upload deadline (Chicago date); ats is anything tagged for the current ATS.
 */
export function matchesExportFilter(run: ExportRun, filter: ExportFilter, now: Date = new Date()): boolean {
  const status = toProjectRunStatus(run.status);
  switch (filter) {
    case 'active':
      return status === 'open' && (!run.results_deadline || isDeadlineAhead(run.results_deadline, now));
    case 'upcoming':
      return status === 'upcoming';
    case 'ats':
      return run.conference === CURRENT_ATS;
    default:
      return true;
  }
}

const RUN_COLUMNS = [
  '#',
  'Run',
  'Title',
  'Status',
  'Conference',
  'Purpose',
  'Purpose detail',
  'CLIF version',
  'Required tables',
  'Sites run',
  'Sites applicable',
  'Sites N/A',
  'Box upload deadline',
  'Deadline passed',
  'Prelim results shared',
  'Prelim results link',
  'Repo',
  'Box folder',
  'Requested by',
  'Requested on',
  'Description',
  'Instructions',
];
const RUN_WIDTHS = [6, 5, 48, 10, 11, 20, 24, 12, 40, 9, 15, 9, 18, 14, 18, 40, 40, 40, 22, 13, 60, 60];

export function buildExportSheets(
  runs: ExportRun[],
  sites: ExportSite[],
  statuses: ExportSiteStatus[],
  filter: ExportFilter,
  now: Date = new Date(),
): Sheet[] {
  const selected = runs.filter((r) => matchesExportFilter(r, filter, now));

  const ran = new Map<string, Set<string>>();
  const na = new Map<string, Map<string, string>>();
  for (const s of statuses) {
    if (Number(s.has_run) === 1) {
      if (!ran.has(s.project_id)) ran.set(s.project_id, new Set());
      ran.get(s.project_id)!.add(s.site_id);
    } else if (Number(s.not_applicable) === 1) {
      if (!na.has(s.project_id)) na.set(s.project_id, new Map());
      na.get(s.project_id)!.set(s.site_id, (s.na_reason || '').trim());
    }
  }

  const runRows: Cell[][] = [RUN_COLUMNS];
  const siteRows: Cell[][] = [['#', 'Run', 'Title', 'Status', ...sites.map((s) => s.site_name)]];

  for (const r of selected) {
    const status = toProjectRunStatus(r.status);
    const launched = status !== 'upcoming';
    const ranSites = ran.get(r.id) ?? new Set<string>();
    const naSites = na.get(r.id) ?? new Map<string, string>();
    const deadlinePassed = status !== 'closed' && !!r.results_deadline && !isDeadlineAhead(r.results_deadline, now);

    runRows.push([
      r.project_number ?? null,
      r.run_number ?? 1,
      r.title,
      STATUS_BADGE[status].label,
      r.conference || null,
      r.purpose ? PURPOSE_LABELS[r.purpose] || r.purpose : null,
      r.purpose_detail || null,
      r.clif_version || null,
      parseTables(r.required_tables).join(', ') || null,
      launched ? ranSites.size : null,
      launched ? sites.length - naSites.size : null,
      launched ? naSites.size : null,
      r.results_deadline || null,
      launched ? yesNo(deadlinePassed) : null,
      yesNo(Number(r.prelim_shared) === 1),
      Number(r.prelim_shared) === 1 ? r.prelim_link || null : null,
      r.repo_url || null,
      r.box_folder_url || null,
      r.creator_name || null,
      (r.created_at || '').slice(0, 10) || null,
      r.description || null,
      r.instructions || null,
    ]);

    siteRows.push([
      r.project_number ?? null,
      r.run_number ?? 1,
      r.title,
      STATUS_BADGE[status].label,
      ...sites.map((s) => {
        if (!launched) return null;
        if (ranSites.has(s.id)) return 'Run';
        if (naSites.has(s.id)) {
          const reason = naSites.get(s.id);
          return reason ? `N/A: ${reason}` : 'N/A';
        }
        return null;
      }),
    ]);
  }

  return [
    { name: 'Runs', rows: runRows, widths: RUN_WIDTHS },
    { name: 'Site status', rows: siteRows, widths: [6, 5, 48, 10, ...sites.map(() => 18)] },
  ];
}

export function exportFilename(filter: ExportFilter, now: Date = new Date()): string {
  return `clif-project-runs-${filter}-${todayInConsortiumTz(now)}.xlsx`;
}

function yesNo(v: boolean): string {
  return v ? 'Yes' : 'No';
}

// required_tables is a JSON array of table names (NULL on runs that predate it).
function parseTables(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}
