export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

/** Admin toggle: mark a member as a site PI who approves letters of collaboration. */
export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId || typeof body.isSitePi !== 'boolean') {
    return new Response(JSON.stringify({ error: 'userId and isSitePi are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  await db.execute({
    sql: 'UPDATE users SET is_site_pi = ?, updated_at = ? WHERE id = ?',
    args: [body.isSitePi ? 1 : 0, new Date().toISOString(), userId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
