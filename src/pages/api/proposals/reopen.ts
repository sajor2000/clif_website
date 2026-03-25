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

  const { proposalId } = await request.json();

  if (!proposalId) {
    return new Response(JSON.stringify({ error: 'proposalId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  await db.execute({
    sql: "UPDATE proposals SET status = 'open', updated_at = ? WHERE id = ?",
    args: [new Date().toISOString(), proposalId],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
