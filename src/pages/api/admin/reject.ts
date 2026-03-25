export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userId } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Delete user (sessions cascade via FK)
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [userId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
