export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { isKnownStatus } from '../../../lib/manuscript-status.js';

// Optional free-text fields accepted from the admin form, in column order.
// Re-used by update.ts so the two endpoints stay in sync.
export const TEXT_FIELDS = [
  'clif_version',
  'ats',
  'github_repo',
  'manuscript_link',
  'lead_authors',
  'journal',
  'cite',
  'contributing_sites',
  'validation_buddy',
  'notes',
] as const;

/** Validate the status array and join to the stored comma-separated form. */
export function serializeStatus(status: unknown): string | null {
  if (status == null) return null;
  if (!Array.isArray(status)) throw new Error('status must be an array');
  const slugs: string[] = [];
  for (const s of status) {
    if (typeof s !== 'string' || !isKnownStatus(s)) {
      throw new Error(`Invalid status tag: ${String(s)}`);
    }
    if (!slugs.includes(s)) slugs.push(s);
  }
  return slugs.length ? slugs.join(',') : null;
}

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return new Response(JSON.stringify({ error: 'Title is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let status: string | null;
  try {
    status = serializeStatus(body.status);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const values = TEXT_FIELDS.map((f) => {
    const v = body[f];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  });

  const db = getDb();
  const now = new Date().toISOString();

  try {
    const next = await db.execute(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM manuscripts'
    );
    const sortOrder = Number(next.rows[0]?.next) || 1;

    await db.execute({
      sql: `INSERT INTO manuscripts
              (title, clif_version, ats, github_repo, manuscript_link,
               lead_authors, journal, cite, contributing_sites,
               validation_buddy, notes, status, sort_order, updated_at, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [title, ...values, status, sortOrder, now, locals.user.id],
    });
  } catch (e: any) {
    const msg = /UNIQUE/.test(e.message)
      ? 'A manuscript with that title already exists.'
      : e.message;
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
