export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { parseProjectRunFields } from './create';
import { isDeadlineAhead } from '../../../lib/project-run-deadline';

// The request creator or an admin can edit a project run request.
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!projectId) {
    return new Response(JSON.stringify({ error: 'projectId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseProjectRunFields(body);
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const f = parsed.fields;
  const status = body.status === 'closed' ? 'closed' : 'open';
  // An open run always has a deadline ahead of it; otherwise the nightly
  // auto-close job would just close it again (see /set-status).
  if (status === 'open' && !isDeadlineAhead(f.results_deadline)) {
    return new Response(
      JSON.stringify({
        error: 'An open run needs a Box upload deadline of today or later. Pick a new deadline, or mark the run closed.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const db = getDb();

  const existing = await db.execute({
    sql: 'SELECT created_by FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (existing.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (user.role !== 'admin' && existing.rows[0].created_by !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.execute({
    sql: `UPDATE project_runs SET
            title = ?, repo_url = ?, box_folder_url = ?, prelim_shared = ?,
            prelim_link = ?, description = ?, instructions = ?, purpose = ?, purpose_detail = ?,
            results_deadline = ?, clif_version = ?, status = ?, updated_at = ?
          WHERE id = ?`,
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
      status,
      new Date().toISOString(),
      projectId,
    ],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
