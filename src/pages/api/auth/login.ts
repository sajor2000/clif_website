export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { verifyPassword } from '../../../lib/auth';
import { createSession, cleanupExpiredSessions } from '../../../lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT id, password_hash FROM users WHERE email = ?',
    args: [email],
  });

  if (result.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = result.rows[0];
  const valid = await verifyPassword(password, user.password_hash as string);

  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await createSession(user.id as string, cookies);

  // Cleanup expired sessions in background (non-blocking)
  cleanupExpiredSessions().catch(() => {});

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
