export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { serializeStatus } from './create';

// Quick status-only update for the inline dropdown on the Manuscript Tracker.
// Unlike /api/manuscripts/update, this touches ONLY the status column so the
// other fields are left untouched.
export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user?.is_approved) {
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

  let status: string | null;
  try {
    status = serializeStatus(body.status);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.execute({
      sql: 'UPDATE manuscripts SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      args: [status, now, locals.user.id, id],
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
