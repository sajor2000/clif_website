export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { EXCLUDED_FIELDS } from '../../../utils/mcideMappings';

// Members-only mapping docs for /portal/mapping-review.
//
// GET /api/mcide/mappings            → the fields loaded, with their run label
// GET /api/mcide/mappings?field=<key> → that field's MappingDoc, served as the
//                                       gzipped JSON the loader stored
//
// Site EHR strings never leave the portal: /portal/* is gated by the middleware
// but /api/* only gets the user attached, so the check is repeated here.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) return json({ error: 'Unauthorized' }, 401);

  const db = getDb();
  const field = url.searchParams.get('field');

  if (!field) {
    const result = await db.execute(
      'SELECT field_key, table_name, run_label, summary, updated_at FROM mcide_mapping_docs ORDER BY field_key'
    );
    return json(
      result.rows
        .filter((row) => !EXCLUDED_FIELDS.has(String(row.field_key)))
        .map((row) => ({
          field_key: row.field_key,
          table_name: row.table_name,
          run_label: row.run_label,
          summary: JSON.parse(String(row.summary)),
          updated_at: row.updated_at,
        }))
    );
  }

  if (EXCLUDED_FIELDS.has(field)) return json({ error: 'Unknown field' }, 404);
  const result = await db.execute({
    sql: 'SELECT doc FROM mcide_mapping_docs WHERE field_key = ?',
    args: [field],
  });
  const row = result.rows[0];
  if (!row) return json({ error: 'Unknown field' }, 404);

  // The browser inflates it; nothing is decoded on the server.
  const doc = row.doc as ArrayBuffer | Uint8Array;
  const body = doc instanceof Uint8Array ? doc : new Uint8Array(doc);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'private, max-age=3600',
      Vary: 'Cookie',
    },
  });
};
