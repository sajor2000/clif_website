export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { generateApprovalToken, parseDecision, tallyApprovals, type ApprovalRow } from '../../../lib/los-approvals';

/**
 * Record a signed-in site PI's approve / decline on a letter of collaboration.
 *
 * POST { id, action } from the tracker's thumbs buttons. Returns JSON with the
 * updated tally. There is deliberately no GET / email-link variant: mail
 * security scanners open every link in an email, so a decision must come from
 * an authenticated session on the website.
 */

async function tallyFor(requestId: string) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT request_id, user_id, decision, decided_at FROM los_approvals WHERE request_id = ?`,
    args: [requestId],
  });
  return tallyApprovals(res.rows as unknown as ApprovalRow[]);
}

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved || !user.is_site_pi) {
    return new Response(JSON.stringify({ error: 'Only site PIs can respond to a letter request.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const decision = parseDecision(body.action);
  if (!id || !decision) {
    return new Response(JSON.stringify({ error: 'id and a valid action are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  const exists = await db.execute({ sql: 'SELECT id FROM los_requests WHERE id = ?', args: [id] });
  if (exists.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // A PI flagged after the request was filed has no row yet; create one so
  // their vote counts and the tally's denominator grows with them.
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR IGNORE INTO los_approvals (request_id, user_id, token) VALUES (?, ?, ?)`,
    args: [id, user.id, generateApprovalToken()],
  });
  await db.execute({
    sql: `UPDATE los_approvals SET decision = ?, decided_at = ?, decided_via = 'portal' WHERE request_id = ? AND user_id = ?`,
    args: [decision, now, id, user.id],
  });

  const tally = await tallyFor(id);
  return new Response(JSON.stringify({ success: true, tally }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
