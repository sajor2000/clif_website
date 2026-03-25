export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hasRole } from '../../../lib/roles';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user || !hasRole(locals.user.role, 'steering')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { title, description, deadline, is_meeting_vote, meeting_date, is_anonymous, steering_only } = await request.json();

  if (!title) {
    return new Response(JSON.stringify({ error: 'Title is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!deadline) {
    return new Response(JSON.stringify({ error: 'Deadline is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO proposals (id, title, description, created_by, status, deadline, is_meeting_vote, meeting_date, is_anonymous, steering_only, created_at, updated_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
    args: [title, description || null, locals.user.id, deadline, is_meeting_vote ? 1 : 0, meeting_date || null, is_anonymous !== false ? 1 : 0, steering_only ? 1 : 0, now, now],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
