export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export const POST: APIRoute = async ({ locals, request }) => {
  const viewer = locals.user;
  if (!viewer) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isSelf = viewer.id === userId;
  const isAdmin = viewer.role === 'admin';
  if (!isSelf && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const EDITABLE = [
    'full_name',
    'institution',
    'work_email',
    'degrees',
    'affiliation',
    'orcid',
    'github_username',
    'gmail_personal',
    'funding',
    'conflicts_of_interest',
    'member_status',
  ] as const;

  const norm = (v: unknown) => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t === '' ? null : t;
  };

  const setExprs: string[] = [];
  const args: (string | null)[] = [];
  for (const col of EDITABLE) {
    if (col in body) {
      setExprs.push(`${col} = ?`);
      args.push(norm(body[col]));
    }
  }

  if (setExprs.length === 0) {
    return new Response(JSON.stringify({ error: 'No editable fields supplied' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  setExprs.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(userId);

  const db = getDb();
  await db.execute({
    sql: `UPDATE users SET ${setExprs.join(', ')} WHERE id = ?`,
    args,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
