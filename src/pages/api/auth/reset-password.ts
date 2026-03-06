export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hashPassword, verifyPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const { email, security_answer, new_password, step } = await request.json();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT id, security_question, security_answer_hash FROM users WHERE email = ?',
    args: [email],
  });

  if (result.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'No account found with that email.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = result.rows[0];

  // Step 1: Return the security question for this email
  if (step === 'get_question') {
    if (!user.security_question) {
      return new Response(JSON.stringify({ error: 'No security question set for this account. Contact an admin.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ security_question: user.security_question }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 2: Verify answer and reset password
  if (step === 'reset') {
    if (!security_answer || !new_password) {
      return new Response(JSON.stringify({ error: 'Security answer and new password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const valid = await verifyPassword(
      security_answer.trim().toLowerCase(),
      user.security_answer_hash as string,
    );

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Incorrect security answer.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newHash = await hashPassword(new_password);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      args: [newHash, new Date().toISOString(), user.id as string],
    });

    // Delete all existing sessions for this user (force re-login)
    await db.execute({
      sql: 'DELETE FROM sessions WHERE user_id = ?',
      args: [user.id as string],
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid step.' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
