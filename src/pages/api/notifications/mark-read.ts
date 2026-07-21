export const prerender = false;

import type { APIRoute } from 'astro';
import { markRead, markAllRead, unreadCount } from '../../../lib/notifications';

// Mark a single notification read ({ id }) or all of them ({ all: true }).
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json().catch(() => ({}));

  if (body.all) {
    await markAllRead(user.id);
  } else if (typeof body.id === 'string' && body.id) {
    await markRead(user.id, body.id);
  } else {
    return json({ error: 'Provide an id or all: true.' }, 400);
  }

  return json({ success: true, unread: await unreadCount(user.id) });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
