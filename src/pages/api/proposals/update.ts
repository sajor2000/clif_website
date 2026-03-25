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

  const { proposalId, title, description, deadline } = await request.json();

  if (!proposalId || !title?.trim()) {
    return new Response(JSON.stringify({ error: 'proposalId and title are required.' }), {
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
  await db.execute({
    sql: 'UPDATE proposals SET title = ?, description = ?, deadline = ?, updated_at = ? WHERE id = ?',
    args: [title.trim(), description?.trim() || null, deadline, new Date().toISOString(), proposalId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
