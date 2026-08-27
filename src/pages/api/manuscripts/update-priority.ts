export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { serializePriority } from './create';

// Quick priority-only update for the inline dropdown on the Manuscript Tracker.
// Mirrors update-status.ts: touches ONLY the priority column so triaging a row
// from the table cannot clobber fields the editor never opened.
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

  let priority: string | null;
  try {
    priority = serializePriority(body.priority);
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
      sql: 'UPDATE manuscripts SET priority = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      args: [priority, now, locals.user.id, id],
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
