export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

/**
 * Add a blank hospital row to a site, for the site's PI/editors to fill in.
 * Mirrors the authorization rules of ./update.ts: admins can add to any site,
 * everyone else only to sites they are an assigned editor of.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { siteId } = body;

  if (!siteId) {
    return new Response(JSON.stringify({ error: 'siteId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const site = await db.execute({
    sql: 'SELECT id, site_name FROM site_details WHERE id = ?',
    args: [siteId],
  });
  if (site.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (user.role !== 'admin') {
    const editor = await db.execute({
      sql: 'SELECT id FROM site_editors WHERE site_id = ? AND user_id = ?',
      args: [siteId, user.id],
    });
    if (editor.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // site_key is the health-system label shown in the Site column. Reuse whatever
  // the site's existing rows use; a site with no rows yet falls back to its name.
  const existing = await db.execute({
    sql: 'SELECT site_key FROM hospitals WHERE site_id = ? LIMIT 1',
    args: [siteId],
  });
  const siteKey = (existing.rows[0]?.site_key as string) || (site.rows[0].site_name as string);

  // hospital_id_name is NOT NULL and unique per site_key, so a blank row uses ''
  // and only one can exist at a time — name the first one before adding another.
  const blank = await db.execute({
    sql: "SELECT id FROM hospitals WHERE site_key = ? AND hospital_id_name = ''",
    args: [siteKey],
  });
  if (blank.rows.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'This site already has an unnamed row — name it before adding another.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const inserted = await db.execute({
    sql: `INSERT INTO hospitals (site_id, site_key, hospital_id_name, updated_at, updated_by)
          VALUES (?, ?, '', datetime('now'), ?)
          RETURNING id`,
    args: [siteId, siteKey, user.id],
  });

  return new Response(JSON.stringify({ success: true, id: inserted.rows[0]?.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
