export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { ROLES } from '../../../lib/roles';

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userId, role } = await request.json();

  if (!userId || !role) {
    return new Response(JSON.stringify({ error: 'userId and role are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid role.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (userId === locals.user.id) {
    return new Response(JSON.stringify({ error: 'Cannot change your own role.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  await db.execute({
    sql: 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
    args: [role, new Date().toISOString(), userId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
