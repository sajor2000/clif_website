export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { parseLosFields } from './create';

// The request creator or an admin can edit an LOS request.
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return new Response(JSON.stringify({ error: 'id is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseLosFields(body);
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const f = parsed.fields;

  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT created_by FROM los_requests WHERE id = ?',
    args: [id],
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
    sql: `UPDATE los_requests SET grant_title = ?, grant_type = ?, grant_deadline = ?, aims_link = ?, los_link = ?, updated_at = ?
          WHERE id = ?`,
    args: [f.grant_title, f.grant_type, f.grant_deadline, f.aims_link, f.los_link, new Date().toISOString(), id],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
