export const prerender = false;

import type { APIRoute } from 'astro';
import { hasRole } from '../../../lib/roles';
import { notifyProposalOpened } from '../../../lib/notify-proposal';

export const POST: APIRoute = async ({ locals, request, url }) => {
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

  // Manual sends only target members who haven't voted yet, so re-sending
  // nudges the people who still need to act without spamming those who voted.
  const result = await notifyProposalOpened(proposalId, url.origin, { onlyNonVoters: true });

  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, sent: result.sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
