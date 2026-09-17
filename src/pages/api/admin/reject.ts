export const prerender = false;

import type { APIRoute } from 'astro';
import { deleteUser, describeBlockers } from '../../../lib/delete-user';

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userId } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Sessions and other cascading rows go with the user; audit columns pointing
  // at them are cleared. Content they authored blocks the delete.
  const result = await deleteUser(userId);

  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: describeBlockers(result.blockedBy), blockedBy: result.blockedBy }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
