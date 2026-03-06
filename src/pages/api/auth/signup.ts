export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hashPassword } from '../../../lib/auth';
import { createSession } from '../../../lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password, full_name, institution, security_question, security_answer } = await request.json();

  if (!email || !password || !full_name || !security_question || !security_answer) {
    return new Response(JSON.stringify({ error: 'All fields including security question are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Check if email already exists
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  });

  if (existing.rows.length > 0) {
    return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const passwordHash = await hashPassword(password);
  const answerHash = await hashPassword(security_answer.trim().toLowerCase());
  const now = new Date().toISOString();

  const result = await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, full_name, institution, security_question, security_answer_hash, role, is_approved, created_at, updated_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'member', 0, ?, ?)
          RETURNING id`,
    args: [email, passwordHash, full_name, institution || null, security_question, answerHash, now, now],
  });

  const userId = result.rows[0].id as string;
  await createSession(userId, cookies);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
