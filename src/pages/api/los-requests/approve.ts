export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hasRole } from '../../../lib/roles';

// Only steering committee members (and admins) can approve / decline a
// consortium letter of support.
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved || !hasRole(user.role, 'steering')) {
    return new Response(JSON.stringify({ error: 'Only steering committee members can approve support.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action;
  if (!id || !['approve', 'decline', 'reset'].includes(action)) {
    return new Response(JSON.stringify({ error: 'id and a valid action are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const status = action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'pending';
  // Record the approver only when approving/declining; clear it on reset.
  const approver = action === 'reset' ? null : user.id;
  const approvedAt = action === 'reset' ? null : new Date().toISOString();

  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT id FROM los_requests WHERE id = ?',
    args: [id],
  });
  if (existing.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await db.execute({
    sql: 'UPDATE los_requests SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?',
    args: [status, approver, approvedAt, new Date().toISOString(), id],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
