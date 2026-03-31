export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  generateCellKeys,
  generateMasterKey,
  splitMasterKey,
  fragmentLabel,
  keyDataToCsv,
  type StrataDimension,
} from '../../../lib/crypto-masking';

/**
 * Fisher-Yates shuffle (cryptographically random).
 */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  const randomBytes = new Uint32Array(shuffled.length);
  crypto.getRandomValues(randomBytes);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomBytes[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name, description, sites, strata_config } = await request.json();

  if (!name || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Project name is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(sites) || sites.length < 2) {
    return new Response(JSON.stringify({ error: 'At least 2 sites are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const site of sites) {
    if (!site.name || !Array.isArray(site.user_ids) || site.user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: `Each site must have a name and at least one member. Issue with: "${site.name || 'unnamed'}"` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  if (!Array.isArray(strata_config) || strata_config.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one dimension is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const dim of strata_config) {
    if (!dim.name || !Array.isArray(dim.categories) || dim.categories.length === 0) {
      return new Response(
        JSON.stringify({ error: `Invalid dimension: "${dim.name || 'unnamed'}" must have at least one category.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const numSites = sites.length;
  const strataConfigParsed: StrataDimension[] = strata_config;

  // Generate cell keys (cartesian product of all dimensions), master key, and fragments
  const cellKeys = generateCellKeys(strataConfigParsed);
  const masterKey = generateMasterKey(cellKeys);
  const fragments = splitMasterKey(masterKey, numSites);

  // Randomly shuffle sites for fragment assignment (blinding)
  const shuffledSites = shuffleArray(sites as { name: string; user_ids: string[] }[]);

  const db = getDb();
  const now = new Date().toISOString();

  // Create project (year_start/year_end set to 0 — unused in generic mode)
  const result = await db.execute({
    sql: `INSERT INTO crypto_projects (id, name, description, year_start, year_end, strata_config, num_sites, status, created_by, created_at, updated_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, 0, 0, ?, ?, 'keys_assigned', ?, ?, ?)
          RETURNING id`,
    args: [
      name.trim(),
      description?.trim() || null,
      JSON.stringify(strata_config),
      numSites,
      locals.user.id,
      now,
      now,
    ],
  });

  const projectId = result.rows[0]?.id as string;

  // Master key is NOT stored in the database — returned to the creator as a CSV download.
  // Convert master key to CSV for the response.
  const masterKeyCsv = keyDataToCsv(masterKey, strataConfigParsed);

  // Store each fragment, assigned to a shuffled site with authorized users
  for (let i = 0; i < numSites; i++) {
    await db.execute({
      sql: `INSERT INTO crypto_site_keys (id, project_id, key_index, label, site_name, authorized_users, assigned_at, key_data, created_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        projectId, i + 1, fragmentLabel(i),
        shuffledSites[i].name,
        JSON.stringify(shuffledSites[i].user_ids),
        now, JSON.stringify(fragments[i]), now,
      ],
    });
  }

  return new Response(JSON.stringify({ success: true, projectId, masterKeyCsv }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
