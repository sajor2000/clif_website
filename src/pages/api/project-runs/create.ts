export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { announceProjectRun } from '../../../lib/notify-project-run';
import { isDeadlineAhead, isValidDate } from '../../../lib/project-run-deadline';
import { parseConference } from '../../../lib/project-run-status';
import { PROJECT_RUN_VERSIONS, runnableTables } from '../../../data/clif-tables';

// Allowed purpose categories. Kept here and re-used by update.ts so the two
// endpoints stay in sync.
export const PURPOSES = ['grant', 'conference', 'journal', 'other'] as const;

export interface ProjectRunFields {
  title: string;
  repo_url: string | null;
  box_folder_url: string | null;
  description: string;
  instructions: string;
  purpose: string;
  purpose_detail: string;
  results_deadline: string;
  clif_version: string;
  required_tables: string[];
  prelim_shared: number;
  prelim_link: string | null;
}

/**
 * Validate the request body for a project run. In 'full' mode (a run sites can
 * act on) every field is required, including shared preliminary results and a
 * link to them. In 'upcoming' mode the repo, Box folder and preliminary results
 * may still be missing; /launch re-checks them in full mode.
 * Returns the cleaned fields, or an error string for a 400 response.
 */
export function parseProjectRunFields(
  body: any,
  mode: 'full' | 'upcoming' = 'full',
): { fields: ProjectRunFields } | { error: string } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const full = mode === 'full';

  const title = str(body.title);
  if (!title) return { error: 'Project title is required.' };

  const repo_url = str(body.repo_url);
  if (!repo_url && full) return { error: 'Project repo is required.' };

  const box_folder_url = str(body.box_folder_url);
  if (!box_folder_url && full) return { error: 'Box folder is required.' };

  const description = str(body.description);
  if (!description) return { error: 'Brief description is required.' };

  const instructions = str(body.instructions);
  if (!instructions) return { error: 'Specific instructions are required.' };

  const purpose = str(body.purpose);
  if (!purpose) return { error: 'Purpose is required.' };
  if (!(PURPOSES as readonly string[]).includes(purpose)) {
    return { error: 'Invalid purpose.' };
  }

  const purpose_detail = str(body.purpose_detail);
  if (!purpose_detail) return { error: 'Purpose detail is required.' };

  const results_deadline = str(body.results_deadline);
  if (!results_deadline) return { error: 'Deadline to upload results to Box is required.' };
  if (!isValidDate(results_deadline)) return { error: 'Invalid Box upload deadline.' };

  const clif_version = str(body.clif_version);
  if (!clif_version) return { error: 'CLIF version is required.' };
  if (!(PROJECT_RUN_VERSIONS as readonly string[]).includes(clif_version)) {
    return { error: 'Invalid CLIF version.' };
  }

  // Tables sites need: at least one, each a runnable table of this version.
  // Stored in picker order so the card lists them consistently.
  const allowedTables = runnableTables(clif_version);
  const pickedTables: string[] = Array.isArray(body.required_tables)
    ? body.required_tables.filter((t: unknown): t is string => typeof t === 'string')
    : [];
  const unknownTable = pickedTables.find((t) => !allowedTables.includes(t));
  if (unknownTable) return { error: `"${unknownTable}" is not a CLIF ${clif_version} table.` };
  const required_tables = allowedTables.filter((t) => pickedTables.includes(t));
  if (required_tables.length === 0) return { error: 'Select at least one table sites need to have.' };

  // Sharing preliminary results is a prerequisite for a run sites can act on.
  const prelim_shared = body.prelim_shared ? 1 : 0;
  if (!prelim_shared && full) {
    return { error: 'You must share the preliminary project results before requesting a consortium run.' };
  }
  // A link only means something alongside the "shared" box.
  const prelim_link = prelim_shared ? str(body.prelim_link) : '';
  if (!prelim_link && full) {
    return { error: 'A link to the preliminary results is required.' };
  }

  return {
    fields: {
      title,
      repo_url: repo_url || null,
      box_folder_url: box_folder_url || null,
      description,
      instructions,
      purpose,
      purpose_detail,
      results_deadline,
      clif_version,
      required_tables,
      prelim_shared,
      prelim_link: prelim_link || null,
    },
  };
}

// Any approved portal member can file a project run request.
export const POST: APIRoute = async ({ locals, request, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const status = body.status === 'upcoming' ? 'upcoming' : 'open';
  const parsed = parseProjectRunFields(body, status === 'upcoming' ? 'upcoming' : 'full');
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const f = parsed.fields;
  // A new run can't start with a deadline that already passed (the nightly
  // auto-close job would close an open one straight away, and /launch would
  // reject an upcoming one).
  if (!isDeadlineAhead(f.results_deadline)) {
    return new Response(JSON.stringify({ error: 'The Box upload deadline must be today or later.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // A rerun repeats an existing project: it takes that project's number and
  // the next run_number, as a fresh row with an empty site checklist. Only the
  // project's latest run can be rerun (so the sequence stays linear), it must
  // have actually run (not upcoming), and only its creator or an admin may do it.
  const rerunOf = typeof body.rerun_of === 'string' ? body.rerun_of.trim() : '';
  let previous: { id: string; project_number: number; status: string } | null = null;
  if (rerunOf) {
    const prevRes = await db.execute({
      sql: `SELECT p.id, p.project_number, p.run_number, p.status, p.created_by,
                   (SELECT MAX(run_number) FROM project_runs WHERE project_number = p.project_number) AS latest_run
              FROM project_runs p WHERE p.id = ?`,
      args: [rerunOf],
    });
    const prev = prevRes.rows[0] as any;
    if (!prev) return jsonError('The project to rerun was not found.', 404);
    if (user.role !== 'admin' && prev.created_by !== user.id) {
      return jsonError('Only the project creator or an admin can request a rerun.', 403);
    }
    if (prev.project_number == null) return jsonError('This project has no number and cannot be rerun.');
    if (prev.status === 'upcoming') return jsonError('An upcoming run has not run yet, so it cannot be rerun.');
    if (Number(prev.run_number) !== Number(prev.latest_run)) {
      return jsonError(`Rerun the latest run of this project (run ${prev.latest_run}).`);
    }
    previous = { id: prev.id as string, project_number: Number(prev.project_number), status: prev.status as string };
  }

  // project_number (new project) or run_number (rerun) is taken as MAX + 1
  // inside the INSERT so the read and the write are one statement — two
  // concurrent creates can't both read the same max. The unique index on
  // (project_number, run_number) backs this up.
  const numberSql = previous
    ? `?, (SELECT COALESCE(MAX(run_number), 0) + 1 FROM project_runs WHERE project_number = ?)`
    : `(SELECT COALESCE(MAX(project_number), 0) + 1 FROM project_runs), 1`;
  const numberArgs = previous ? [previous.project_number, previous.project_number] : [];
  const insertRes = await db.execute({
    sql: `INSERT INTO project_runs
            (title, repo_url, box_folder_url, prelim_shared, prelim_link, description, instructions,
             purpose, purpose_detail, results_deadline, clif_version, required_tables, conference, status,
             created_by, created_at, updated_at, project_number, run_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${numberSql})
          RETURNING id, project_number, run_number`,
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
      parseConference(body.conference),
      status,
      user.id,
      now,
      now,
      ...numberArgs,
    ],
  });
  const created = insertRes.rows[0] as any;
  const newId = created?.id as string | undefined;

  // The requester chose whether to close the run being replaced. Only an open
  // run can be closed this way; the guard keeps a race from reopening nothing.
  if (previous && body.close_previous && previous.status === 'open') {
    await db.execute({
      sql: `UPDATE project_runs SET status = 'closed', updated_at = ? WHERE id = ? AND status = 'open'`,
      args: [now, previous.id],
    });
  }

  // An upcoming run is announced when it launches, not now.
  if (newId && status === 'open') {
    announceProjectRun(newId, { origin: url.origin, notifyAll: !!body.notify_all, requester: user }).catch(() => {});
  }

  return new Response(
    JSON.stringify({
      success: true,
      id: newId ?? null,
      project_number: created?.project_number ?? null,
      run_number: created?.run_number ?? null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

function jsonError(error: string, status = 400): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
