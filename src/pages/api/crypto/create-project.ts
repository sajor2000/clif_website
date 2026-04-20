export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';
import {
  generateCellKeys,
  generateFragments,
  fragmentLabel,
  type StrataDimension,
} from '../../../lib/crypto-masking';

/**
 * Fisher-Yates shuffle (cryptographically random).
 */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  if (shuffled.length === 0) return shuffled;
  const randomBytes = new Uint32Array(shuffled.length);
  crypto.getRandomValues(randomBytes);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomBytes[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface KeySetInput {
  name?: string;
  strata_config: StrataDimension[];
  min_offset?: number;
  max_offset?: number;
}

interface SiteInput {
  name: string;
  user_ids: string[];
}

const OFFSET_BOUND = 10000;

function validateKeySet(ks: KeySetInput, label: string): string | null {
  if (!Array.isArray(ks.strata_config) || ks.strata_config.length === 0) {
    return `${label}: at least one dimension is required.`;
  }
  for (const dim of ks.strata_config) {
    if (!dim.name || !Array.isArray(dim.categories) || dim.categories.length === 0) {
      return `${label}: dimension "${dim.name || 'unnamed'}" must have at least one category.`;
    }
  }
  const min = ks.min_offset ?? 0;
  const max = ks.max_offset ?? 40;
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return `${label}: min and max offset must be integers.`;
  }
  if (max < min) {
    return `${label}: max offset (${max}) must be >= min offset (${min}).`;
  }
  if (Math.abs(min) > OFFSET_BOUND || Math.abs(max) > OFFSET_BOUND) {
    return `${label}: offsets must be within [-${OFFSET_BOUND}, ${OFFSET_BOUND}].`;
  }
  return null;
}

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { name, description, sites } = body as { name?: string; description?: string; sites?: SiteInput[] };

  // Back-compat: accept legacy single `strata_config` payload by wrapping it as
  // a one-element key_sets array. New clients send `key_sets`.
  let keySets: KeySetInput[] = Array.isArray(body.key_sets) ? body.key_sets : [];
  if (keySets.length === 0 && Array.isArray(body.strata_config)) {
    keySets = [{ name: 'Default', strata_config: body.strata_config }];
  }

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

  if (keySets.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one key set is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (let i = 0; i < keySets.length; i++) {
    const err = validateKeySet(keySets[i], keySets[i].name?.trim() || `Key set ${i + 1}`);
    if (err) {
      return new Response(JSON.stringify({ error: err }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const numSites = sites.length;
  const db = getDb();
  const now = new Date().toISOString();

  // Project-level record: strata_config stores the first key-set's config for
  // backward compat with older read paths (it's not load-bearing for new code).
  const firstConfig = keySets[0].strata_config;
  const result = await db.execute({
    sql: `INSERT INTO crypto_projects (id, name, description, year_start, year_end, strata_config, num_sites, status, created_by, created_at, updated_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, 0, 0, ?, ?, 'keys_assigned', ?, ?, ?)
          RETURNING id`,
    args: [
      name.trim(),
      description?.trim() || null,
      JSON.stringify(firstConfig),
      numSites,
      locals.user.id,
      now,
      now,
    ],
  });

  const projectId = result.rows[0]?.id as string;

  // For each key set: insert key_set row, generate fragments with configured
  // offset range, shuffle fragment→site assignment (blinding), insert site keys.
  for (let i = 0; i < keySets.length; i++) {
    const ks = keySets[i];
    const minOffset = ks.min_offset ?? 0;
    const maxOffset = ks.max_offset ?? 40;
    const ksName = ks.name?.trim() || (keySets.length === 1 ? 'Default' : `Key Set ${i + 1}`);

    const keySetInsert = await db.execute({
      sql: `INSERT INTO crypto_key_sets (id, project_id, name, strata_config, min_offset, max_offset, status, created_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'keys_assigned', ?)
            RETURNING id`,
      args: [projectId, ksName, JSON.stringify(ks.strata_config), minOffset, maxOffset, now],
    });
    const keySetId = keySetInsert.rows[0]?.id as string;

    const cellKeys = generateCellKeys(ks.strata_config);
    const fragments = generateFragments(cellKeys, numSites, minOffset, maxOffset);
    const shuffledSites = shuffleArray(sites);

    for (let j = 0; j < numSites; j++) {
      await db.execute({
        sql: `INSERT INTO crypto_site_keys (id, project_id, key_set_id, key_index, label, site_name, authorized_users, assigned_at, key_data, created_at)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          projectId,
          keySetId,
          j + 1,
          fragmentLabel(j),
          shuffledSites[j].name,
          JSON.stringify(shuffledSites[j].user_ids),
          now,
          JSON.stringify(fragments[j]),
          now,
        ],
      });
    }
  }

  return new Response(JSON.stringify({ success: true, projectId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
