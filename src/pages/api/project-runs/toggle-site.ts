export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  MAX_SITE_AUTHORS,
  buildRunAuthorList,
  loadAuthorMembers,
  loadSitePicks,
  saveSiteAuthors,
  siteRoster,
} from '../../../lib/project-run-authors';

// A site self-reports whether it has run a project. Authorization mirrors
// /api/site-details/update: an admin, or a user assigned as that site's
// site_editor, may toggle that site's box.
//
// Marking a site as run also names its authors (`authorIds`, at least one,
// all from that site's roster). The same call with hasRun: true edits the
// authors later. Unticking removes them. The response carries the run's
// refreshed author list so the tracker can update in place.
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
  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  const hasRun = body.hasRun ? 1 : 0;
  const authorIds: string[] = Array.isArray(body.authorIds)
    ? [...new Set<string>(body.authorIds.filter((id: unknown) => typeof id === 'string' && id))]
    : [];

  if (!projectId || !siteId) {
    return new Response(JSON.stringify({ error: 'projectId and siteId are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const runRes = await db.execute({
    sql: 'SELECT status, created_by FROM project_runs WHERE id = ?',
    args: [projectId],
  });
  if (runRes.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Project run not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (runRes.rows[0].status === 'upcoming') {
    return new Response(JSON.stringify({ error: "Sites can't act on this run until it launches." }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (runRes.rows[0].status === 'closed') {
    return new Response(JSON.stringify({ error: 'This run is closed. Reopen it to change a site.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authorization: admin or assigned editor for this site.
  if (user.role !== 'admin') {
    const editor = await db.execute({
      sql: 'SELECT id FROM site_editors WHERE site_id = ? AND user_id = ?',
      args: [siteId, user.id],
    });
    if (editor.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'You can only update your own site.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const sitesRes = await db.execute('SELECT id, site_name, institution FROM site_details');
  const sites = (sitesRes.rows as any[]).map((r) => ({
    id: String(r.id),
    site_name: String(r.site_name || ''),
    institution: (r.institution as string | null) ?? null,
  }));
  const site = sites.find((s) => s.id === siteId);
  if (!site) {
    return new Response(JSON.stringify({ error: 'Site not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const members = await loadAuthorMembers();
  if (hasRun) {
    if (authorIds.length === 0) {
      return new Response(JSON.stringify({ error: `Pick at least one author from ${site.site_name}.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // A site's own editor can always name themselves, whatever their profile
    // institution says. An admin acting for a site gets no such exception.
    const roster = new Set(
      siteRoster(site, members, user.role === 'admin' ? undefined : user.id).map((m) => m.id),
    );
    if (authorIds.length > MAX_SITE_AUTHORS || authorIds.some((id) => !roster.has(id))) {
      return new Response(JSON.stringify({ error: `Authors must be approved members from ${site.site_name}.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const now = new Date().toISOString();

  // Ran and N/A are mutually exclusive (see /set-site-na): checking the box
  // clears any N/A on the site.
  await db.execute({
    sql: `INSERT INTO project_run_sites (project_id, site_id, has_run, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id, site_id)
          DO UPDATE SET
            has_run = excluded.has_run,
            not_applicable = CASE WHEN excluded.has_run = 1 THEN 0 ELSE not_applicable END,
            na_reason = CASE WHEN excluded.has_run = 1 THEN NULL ELSE na_reason END,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by`,
    args: [projectId, siteId, hasRun, now, user.id],
  });

  await saveSiteAuthors(projectId, siteId, hasRun ? authorIds : [], user.id);

  const list = buildRunAuthorList(
    (runRes.rows[0].created_by as string | null) ?? null,
    await loadSitePicks(projectId),
    sites,
    new Map(members.map((m) => [m.id, m])),
  );

  return new Response(
    JSON.stringify({
      success: true,
      siteAuthorIds: hasRun ? authorIds : [],
      authorCount: list.ids.length,
      authorList: list.text,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
