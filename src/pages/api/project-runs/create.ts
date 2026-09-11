export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { notifyProjectRunReady } from '../../../lib/notify-project-run';
import { notifySlackProjectRun } from '../../../lib/slack';
import { isDeadlineAhead, isValidDate } from '../../../lib/project-run-deadline';
import { PROJECT_RUN_VERSIONS, runnableTables } from '../../../data/clif-tables';

// Allowed purpose categories. Kept here and re-used by update.ts so the two
// endpoints stay in sync.
export const PURPOSES = ['grant', 'conference', 'journal', 'other'] as const;

export interface ProjectRunFields {
  title: string;
  repo_url: string;
  box_folder_url: string;
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
 * Validate the request body for a project run. Every field is required; the
 * preliminary-results link is required only when prelim_shared is checked.
 * Returns the cleaned fields, or an error string for a 400 response.
 */
export function parseProjectRunFields(body: any): { fields: ProjectRunFields } | { error: string } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const title = str(body.title);
  if (!title) return { error: 'Project title is required.' };

  const repo_url = str(body.repo_url);
  if (!repo_url) return { error: 'Project repo is required.' };

  const box_folder_url = str(body.box_folder_url);
  if (!box_folder_url) return { error: 'Box folder is required.' };

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

  // Sharing preliminary results is a prerequisite for requesting a consortium run.
  const prelim_shared = body.prelim_shared ? 1 : 0;
  if (!prelim_shared) {
    return { error: 'You must share the preliminary project results before requesting a consortium run.' };
  }
  const prelim_link = str(body.prelim_link);
  if (!prelim_link) {
    return { error: 'A link to the preliminary results is required.' };
  }

  return {
    fields: {
      title,
      repo_url,
      box_folder_url,
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
  const parsed = parseProjectRunFields(body);
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const f = parsed.fields;
  // A new run is open, so it can't start with a deadline that already passed
  // (the nightly auto-close job would close it straight away).
  if (!isDeadlineAhead(f.results_deadline)) {
    return new Response(JSON.stringify({ error: 'The Box upload deadline must be today or later.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // project_number is taken as MAX + 1 inside the INSERT so the read and the
  // write are one statement — two concurrent creates can't both read the same
  // max. A unique index backs this up.
  const insertRes = await db.execute({
    sql: `INSERT INTO project_runs
            (title, repo_url, box_folder_url, prelim_shared, prelim_link, description, instructions,
             purpose, purpose_detail, results_deadline, clif_version, required_tables, status,
             created_by, created_at, updated_at, project_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?,
                  (SELECT COALESCE(MAX(project_number), 0) + 1 FROM project_runs))
          RETURNING id, project_number`,
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
      user.id,
      now,
      now,
    ],
  });

  // Optionally notify every approved member that a new run is ready. Fire-and-forget
  // so a mail hiccup never blocks request creation.
  const newId = insertRes.rows[0]?.id as string | undefined;
  if (newId && body.notify_all) {
    notifyProjectRunReady(newId, url.origin, { excludeUserId: user.id }).catch(() => {});
  }

  // Announce every new request in Slack, regardless of notify_all: a channel
  // post is opt-in to read, unlike mailing all approved members. No-ops when
  // SLACK_WEBHOOK_URL is unset, and never blocks creation.
  const newNumber = insertRes.rows[0]?.project_number;
  notifySlackProjectRun({
    projectNumber: newNumber == null ? null : Number(newNumber),
    title: f.title,
    description: f.description,
    purpose: f.purpose,
    purposeDetail: f.purpose_detail,
    deadline: f.results_deadline,
    requestedBy: user.full_name || user.email || null,
    projectUrl: `${url.origin}/portal/project-runs`,
  }).catch(() => {});

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
