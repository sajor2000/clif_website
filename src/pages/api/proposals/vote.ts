export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { hasRole } from '../../../lib/roles';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user?.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { proposalId, vote, was_present } = await request.json();

  if (!proposalId || !vote || !['yes', 'no', 'abstain'].includes(vote)) {
    return new Response(JSON.stringify({ error: 'proposalId and vote (yes/no/abstain) are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Check proposal is open and deadline hasn't passed
  const proposal = await db.execute({
    sql: 'SELECT status, deadline, steering_only FROM proposals WHERE id = ?',
    args: [proposalId],
  });

  if (proposal.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Proposal not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const p = proposal.rows[0];
  if (p.status !== 'open') {
    return new Response(JSON.stringify({ error: 'Proposal is no longer open for voting.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (p.deadline && new Date((p.deadline as string) + 'T23:59:59') < new Date()) {
    return new Response(JSON.stringify({ error: 'Voting deadline has passed.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if steering-only vote
  if (Boolean(p.steering_only) && !hasRole(locals.user.role, 'steering')) {
    return new Response(JSON.stringify({ error: 'This vote is restricted to steering committee members.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if this is a meeting vote that requires attendance
  if (Boolean(p.is_meeting_vote) && was_present === undefined) {
    return new Response(JSON.stringify({ error: 'Please indicate if you were present at the meeting.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Upsert vote (INSERT OR REPLACE allows changing vote)
  await db.execute({
    sql: `INSERT OR REPLACE INTO votes (id, proposal_id, user_id, vote, was_present, created_at)
          VALUES (
            COALESCE((SELECT id FROM votes WHERE proposal_id = ? AND user_id = ?), lower(hex(randomblob(16)))),
            ?, ?, ?, ?, ?
          )`,
    args: [proposalId, locals.user.id, proposalId, locals.user.id, vote, was_present !== undefined ? (was_present ? 1 : 0) : null, new Date().toISOString()],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
