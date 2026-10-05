export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import { norm, EXCLUDED_FIELDS } from '../../../utils/mcideMappings';

// "What did other sites map this string to?" — the mCIDE Surveyor's search box.
//
// GET /api/mcide/lookup?q=<raw name>[&field=<key>]
//
// Two tiers, so a new site sees the closest precedent first:
//   1. exact — the same name after norm() (case, punctuation, spacing ignored)
//   2. partial — the query appears inside a name (FTS5 trigram; LIKE on norm
//      if the index is unavailable), biggest names first
// Each hit says how many sites map that name to that category and the records
// behind it, and which sites they are.

const MIN_QUERY = 3;
const LIMIT = 120; // enough for a results wheel, well under its leaf cap

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Hit {
  field_key: string;
  name: string;
  category: string;
  status: string;
  n_sites: number;
  n_all: number;
  tier: 'exact' | 'partial';
  /** Site codes behind n_sites, A–Z. */
  sites: string[];
}

function toHit(row: Record<string, unknown>, tier: Hit['tier']): Hit {
  const sites = Object.keys(JSON.parse(String(row.sites)));
  return {
    field_key: String(row.field_key),
    name: String(row.name),
    category: String(row.category),
    status: String(row.status),
    n_sites: sites.length,
    n_all: Number(row.n_all),
    tier,
    sites: sites.sort(),
  };
}

export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user || !user.is_approved) return json({ error: 'Unauthorized' }, 401);

  const q = (url.searchParams.get('q') ?? '').trim();
  const field = url.searchParams.get('field');
  if (q.length < MIN_QUERY) return json({ error: `Query must be at least ${MIN_QUERY} characters` }, 400);

  const db = getDb();
  const key = norm(q);
  // Off-schema mappings (a category the mCIDE does not define) and excluded
  // fields stay out of the review entirely, here as on the wheel.
  const excluded = [...EXCLUDED_FIELDS];
  const fieldClause =
    (field ? ' AND n.field_key = ?' : '') +
    (excluded.length ? ` AND n.field_key NOT IN (${excluded.map(() => '?').join(', ')})` : '') +
    " AND n.status NOT IN ('off_schema', 'unmapped')";
  const fieldArgs = [...(field ? [field] : []), ...excluded];
  const cols = 'n.field_key, n.name, n.category, n.status, n.sites, n.n_all';

  const exact = await db.execute({
    sql: `SELECT ${cols} FROM mcide_mapping_names n WHERE n.norm = ?${fieldClause} ORDER BY n.n_all DESC LIMIT ?`,
    args: [key, ...fieldArgs, LIMIT],
  });
  const hits: Hit[] = exact.rows.map((r) => toHit(r as Record<string, unknown>, 'exact'));
  const seen = new Set(hits.map((h) => `${h.field_key}\t${h.name}\t${h.category}`));

  const remaining = LIMIT - hits.length;
  if (remaining > 0) {
    let partial;
    try {
      // Trigram FTS: the query must be quoted as a single phrase.
      partial = await db.execute({
        sql: `SELECT ${cols} FROM mcide_mapping_names_fts f
              JOIN mcide_mapping_names n ON n.id = f.rowid
              WHERE mcide_mapping_names_fts MATCH ?${fieldClause}
              ORDER BY n.n_all DESC LIMIT ?`,
        args: [`"${q.replace(/"/g, '""')}"`, ...fieldArgs, LIMIT],
      });
    } catch {
      partial = await db.execute({
        sql: `SELECT ${cols} FROM mcide_mapping_names n WHERE n.norm LIKE ?${fieldClause} ORDER BY n.n_all DESC LIMIT ?`,
        args: [`%${key.replace(/[%_]/g, '')}%`, ...fieldArgs, LIMIT],
      });
    }
    for (const r of partial.rows) {
      const hit = toHit(r as Record<string, unknown>, 'partial');
      const id = `${hit.field_key}\t${hit.name}\t${hit.category}`;
      if (seen.has(id)) continue;
      seen.add(id);
      hits.push(hit);
      if (hits.length >= LIMIT) break;
    }
  }

  return json({ q, hits });
};
