export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { institution } = await request.json();

  if (!institution || !institution.trim()) {
    return new Response(JSON.stringify({ error: 'Institution is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();
  await db.execute({
    sql: 'UPDATE users SET institution = ?, updated_at = ? WHERE id = ?',
    args: [institution.trim(), new Date().toISOString(), locals.user.id],
  });

  const redirect = locals.user.is_approved ? '/portal' : '/auth/pending';

  return new Response(JSON.stringify({ success: true, redirect }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
