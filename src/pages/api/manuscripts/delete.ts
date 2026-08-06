export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { isNamedOnManuscript } from '../../../lib/manuscript-access';

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user?.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await request.json();

  if (!id) {
    return new Response(JSON.stringify({ error: 'id is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const found = await db.execute({
    sql: 'SELECT lead_authors, lead_data_scientist FROM manuscripts WHERE id = ?',
    args: [id],
  });
  if (found.rows.length === 0) {
    return new Response(JSON.stringify({ error: 'Manuscript not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Admins may delete anything; everyone else must be named on the manuscript
  // as a lead author or its lead data scientist.
  const row = found.rows[0] as { lead_authors: string | null; lead_data_scientist: string | null };
  if (user.role !== 'admin' && !isNamedOnManuscript(user.full_name, row)) {
    return new Response(
      JSON.stringify({ error: 'Only admins or people named on the manuscript can delete it.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  await db.execute({
    sql: 'DELETE FROM manuscripts WHERE id = ?',
    args: [id],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
