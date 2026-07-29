export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

// Only site-detail and profile tasks may be dismissed. A run-a-project task or a
// steering review is a real obligation, not something to wave away, so the
// server refuses those keys regardless of what the client sends.
function isDismissible(key: string): boolean {
  return key.startsWith('stale_site:') || key === 'incomplete_profile';
}

// Record a "nothing to change" dismissal for one of the current member's tasks.
// The signature is stored so computePendingTasks can re-surface the task if the
// underlying situation later changes (see migration 014).
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => ({}));
  const key = typeof body.key === 'string' ? body.key : '';
  const signature = typeof body.signature === 'string' ? body.signature : '';
  if (!key || !signature) return json({ error: 'key and signature are required.' }, 400);
  if (!isDismissible(key)) return json({ error: 'This task cannot be dismissed.' }, 400);

  const db = getDb();
  // Scoped to the caller's own user id — a member can only dismiss their own
  // tasks. Re-dismissing updates the stored signature in place.
  await db.execute({
    sql: `INSERT INTO task_dismissals (user_id, task_key, signature, dismissed_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, task_key)
          DO UPDATE SET signature = excluded.signature, dismissed_at = excluded.dismissed_at`,
    args: [user.id, key, signature],
  });

  return json({ success: true });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
