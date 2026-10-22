/**
 * Project run lifecycle: upcoming → open ("Active") → closed.
 *
 * An upcoming run is logged before its repo, Box folder and preliminary
 * results exist. It stays out of members' dashboards and sites can't act on it
 * until the requester launches it (/api/project-runs/launch), which applies the
 * full field checks and moves it to open.
 */
export const PROJECT_RUN_STATUSES = ['upcoming', 'open', 'closed'] as const;
export type ProjectRunStatus = (typeof PROJECT_RUN_STATUSES)[number];

/**
 * The conference the create form's "For ATS …?" toggle tags a run with. Stored
 * as text on project_runs.conference, so bumping this for next year leaves
 * earlier runs labelled with their own year.
 */
export const CURRENT_ATS = 'ATS 2027';

export const STATUS_BADGE: Record<ProjectRunStatus, { label: string; classes: string }> = {
  upcoming: {
    label: 'Upcoming',
    classes: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  },
  open: {
    label: 'Active',
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  closed: {
    label: 'Closed',
    classes: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-400',
  },
};

/**
 * A project is identified by project_number; each run of it is one
 * project_runs row with a run_number (1 for the original, 2 for the first
 * rerun, …). A rerun is a fresh row — new id, empty site checklist — that
 * shares the previous run's project_number.
 */
export function isRerun(runNumber: unknown): boolean {
  return Number(runNumber) > 1;
}

/** Badge text for a rerun card: "Rerun · run 2". Empty for an original run. */
export function rerunLabel(runNumber: unknown): string {
  return isRerun(runNumber) ? `Rerun · run ${Number(runNumber)}` : '';
}

/** "12" for an original run, "12 (run 2)" for a rerun; "" when the run has no number yet. */
export function runLabel(projectNumber: unknown, runNumber: unknown): string {
  if (projectNumber == null) return '';
  const n = String(projectNumber);
  return isRerun(runNumber) ? `${n} (run ${Number(runNumber)})` : n;
}

/** Normalize a stored status; anything unrecognized is treated as open (the column default). */
export function toProjectRunStatus(value: unknown): ProjectRunStatus {
  return (PROJECT_RUN_STATUSES as readonly unknown[]).includes(value) ? (value as ProjectRunStatus) : 'open';
}

/**
 * Accept the current ATS tag, or the tag the run already has (so editing a
 * run from a past year doesn't drop its label). Anything else clears it.
 */
export function parseConference(value: unknown, existing: unknown = null): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v === CURRENT_ATS) return CURRENT_ATS;
  if (v && v === existing) return v;
  return null;
}

/** Labels for project_runs.purpose, shown on the tracker, in Slack posts and in the export. */
export const PURPOSE_LABELS: Record<string, string> = {
  grant: 'Grant',
  conference: 'Conference / Abstract',
  journal: 'Journal / Manuscript',
  other: 'Exploratory / Other',
};
