export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { sniffImage } from '../../../lib/image-dimensions';

/**
 * A member's signature image for generated letters of collaboration.
 *
 *   GET    ?userId=…                      the image bytes (self or admin)
 *   POST   { userId, data: <base64> }     store a PNG or JPEG, at most 500 KB (self or admin)
 *   DELETE { userId }                     remove it (self or admin)
 *
 * The image only ever appears on letters for requests the member approved,
 * so it is never served to anyone but the member and admins.
 */

const MAX_BYTES = 500 * 1024;

function allowed(locals: App.Locals, userId: string): boolean {
  const u = locals.user;
  return !!u && u.is_approved && (u.role === 'admin' || u.id === userId);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ locals, url }) => {
  const userId = url.searchParams.get('userId') || '';
  if (!userId || !allowed(locals, userId)) return json({ error: 'Forbidden' }, 403);

  const res = await getDb().execute({ sql: 'SELECT mime, data FROM pi_signatures WHERE user_id = ?', args: [userId] });
  const row = res.rows[0];
  if (!row) return json({ error: 'No signature on file.' }, 404);
  const raw: unknown = row.data;
  const data = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw instanceof Uint8Array ? raw : new Uint8Array(0);
  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': String(row.mime), 'Cache-Control': 'private, no-store' },
  });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId || !allowed(locals, userId)) return json({ error: 'Forbidden' }, 403);

  const b64 = typeof body.data === 'string' ? body.data.replace(/^data:[^;]+;base64,/, '') : '';
  if (!b64) return json({ error: 'An image is required.' }, 400);
  if (b64.length > (MAX_BYTES * 4) / 3 + 4) return json({ error: 'The image must be 500 KB or smaller.' }, 400);
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
  if (bytes.length > MAX_BYTES) return json({ error: 'The image must be 500 KB or smaller.' }, 400);

  const info = sniffImage(bytes);
  if (!info) return json({ error: 'Upload a PNG or JPEG image.' }, 400);
  if (info.width < 40 || info.height < 10 || info.width > 5000 || info.height > 5000) {
    return json({ error: 'The image size is out of range (40–5000 px wide).' }, 400);
  }

  await getDb().execute({
    sql: `INSERT INTO pi_signatures (user_id, mime, data, width, height, updated_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data,
            width = excluded.width, height = excluded.height, updated_at = excluded.updated_at`,
    args: [userId, info.mime, bytes, info.width, info.height, new Date().toISOString()],
  });
  return json({ success: true, width: info.width, height: info.height }, 200);
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId || !allowed(locals, userId)) return json({ error: 'Forbidden' }, 403);
  await getDb().execute({ sql: 'DELETE FROM pi_signatures WHERE user_id = ?', args: [userId] });
  return json({ success: true }, 200);
};
