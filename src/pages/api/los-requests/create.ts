export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

export interface LosFields {
  grant_title: string;
  grant_type: string;
  grant_deadline: string;
  aims_link: string;
  los_link: string;
}

/** Validate/normalize the request body. Every field is required. */
export function parseLosFields(body: any): { fields: LosFields } | { error: string } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const grant_title = str(body.grant_title);
  if (!grant_title) return { error: 'Grant title is required.' };
  const grant_type = str(body.grant_type);
  if (!grant_type) return { error: 'Grant type is required.' };
  const grant_deadline = str(body.grant_deadline);
  if (!grant_deadline) return { error: 'Grant deadline is required.' };
  const aims_link = str(body.aims_link);
  if (!aims_link) return { error: 'Link to Specific Aims is required.' };
  const los_link = str(body.los_link);
  if (!los_link) return { error: 'Link to the letter of support is required.' };
  return { fields: { grant_title, grant_type, grant_deadline, aims_link, los_link } };
}

// Any approved portal member can file a letter-of-support request.
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !user.is_approved) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const parsed = parseLosFields(body);
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const f = parsed.fields;

  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO los_requests
            (grant_title, grant_type, grant_deadline, aims_link, los_link, status, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    args: [f.grant_title, f.grant_type, f.grant_deadline, f.aims_link, f.los_link, user.id, now, now],
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
