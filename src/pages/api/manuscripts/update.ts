export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { serializeStatus, TEXT_FIELDS } from './create';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user?.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!id) {
    return new Response(JSON.stringify({ error: 'id is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!title) {
    return new Response(JSON.stringify({ error: 'Title is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let status: string | null;
  try {
    status = serializeStatus(body.status);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const values = TEXT_FIELDS.map((f) => {
    const v = body[f];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  });

  const db = getDb();
  const now = new Date().toISOString();

  try {
    const setCols = ['title = ?', ...TEXT_FIELDS.map((f) => `${f} = ?`)].join(', ');
    await db.execute({
      sql: `UPDATE manuscripts SET ${setCols}, status = ?, updated_at = ?, updated_by = ?
            WHERE id = ?`,
      args: [title, ...values, status, now, locals.user.id, id],
    });
  } catch (e: any) {
    const msg = /UNIQUE/.test(e.message)
      ? 'A manuscript with that title already exists.'
      : e.message;
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
