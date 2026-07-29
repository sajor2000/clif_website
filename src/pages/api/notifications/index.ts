export const prerender = false;

import type { APIRoute } from 'astro';
import { listNotifications, unreadCount } from '../../../lib/notifications';

// Returns the current member's recent notifications + unread count. Used by the
// header bell to refresh without a full page load.
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const [items, unread] = await Promise.all([
    listNotifications(user.id),
    unreadCount(user.id),
  ]);

  return json({ items, unread });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
