export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  generateApprovalToken,
  isApprovalToken,
  parseDecision,
  tallyApprovals,
  type ApprovalRow,
} from '../../../lib/los-approvals';

/**
 * Record a site PI's approve / decline on a letter of collaboration.
 *
 * GET  ?token=…&action=approve|decline — the one-click link from the email.
 *      The token alone identifies the PI and the request; no sign-in needed.
 *      Renders a small confirmation page.
 * POST { id, action } — the tracker's buttons for a signed-in site PI.
 *      Returns JSON with the updated tally.
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title: string, body: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · CLIF Consortium</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#333}
  h1{color:#8B1538;font-size:20px;margin:0 0 16px;padding-bottom:12px;border-bottom:3px solid #8B1538}
  h2{font-size:18px;color:#111;margin:16px 0 8px}
  .ok{color:#15803d}.no{color:#b91c1c}.muted{color:#666;font-size:14px}
  a.btn{display:inline-block;margin-top:20px;background:#8B1538;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600}
</style></head>
<body><h1>CLIF Consortium</h1>${body}</body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function tallyFor(requestId: string) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT request_id, user_id, decision, decided_at FROM los_approvals WHERE request_id = ?`,
    args: [requestId],
  });
  return tallyApprovals(res.rows as unknown as ApprovalRow[]);
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const decision = parseDecision(url.searchParams.get('action'));
  if (!isApprovalToken(token) || !decision) {
    return page('Invalid link', `<h2>This link is not valid</h2><p class="muted">The approval link is incomplete or malformed. Open the letter tracker instead.</p><a class="btn" href="/portal/los-requests">Open letter tracker</a>`, 400);
  }

  const db = getDb();
  const found = await db.execute({
    sql: `SELECT a.id, a.request_id, a.decision, r.grant_title, u.full_name
          FROM los_approvals a
          JOIN los_requests r ON r.id = a.request_id
          LEFT JOIN users u ON u.id = a.user_id
          WHERE a.token = ?`,
    args: [token],
  });
  if (found.rows.length === 0) {
    return page('Link expired', `<h2>This approval link is no longer valid</h2><p class="muted">The request may have been deleted. Open the letter tracker to check its status.</p><a class="btn" href="/portal/los-requests">Open letter tracker</a>`, 404);
  }
  const a = found.rows[0];

  await db.execute({
    sql: `UPDATE los_approvals SET decision = ?, decided_at = ?, decided_via = 'email' WHERE id = ?`,
    args: [decision, new Date().toISOString(), a.id as string],
  });

  const t = await tallyFor(a.request_id as string);
  const who = (a.full_name as string | null) ? `Thanks, ${esc(a.full_name as string)}.` : 'Thanks.';
  const verb = decision === 'approved' ? '<span class="ok">approved</span>' : '<span class="no">declined</span>';
  return page(
    decision === 'approved' ? 'Approved' : 'Declined',
    `<p>${who} You ${verb} the letter of collaboration for:</p>
     <h2>${esc(a.grant_title as string)}</h2>
     <p><strong>${t.approved} of ${t.total}</strong> site PIs have approved so far.</p>
     <p class="muted">Changed your mind? Click the other button in the email, or respond again from the tracker.</p>
     <a class="btn" href="/portal/los-requests">Open letter tracker</a>`,
  );
};

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
