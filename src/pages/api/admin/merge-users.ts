export const prerender = false;

import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/turso';

// Merge a duplicate member record into a canonical one: move the duplicate's
// login identities and all references onto the canonical user, backfill any
// profile fields the canonical is missing, then delete the duplicate. Runs as
// a single write transaction.

const ROLE_LEVEL: Record<string, number> = { member: 0, steering: 1, admin: 2 };

// Profile columns to copy from the duplicate when the canonical's value is empty.
const FILL_COLS = [
  'full_name',
  'institution',
  'work_email',
  'degrees',
  'orcid',
  'github_username',
  'gmail_personal',
  'affiliation',
  'funding',
  'conflicts_of_interest',
  'member_status',
  'avatar_url',
] as const;

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

export const POST: APIRoute = async ({ locals, request }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { canonicalId, duplicateId } = await request.json();

  if (!canonicalId || !duplicateId) {
    return new Response(JSON.stringify({ error: 'canonicalId and duplicateId are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (canonicalId === duplicateId) {
    return new Response(JSON.stringify({ error: 'Cannot merge a member into itself' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  const both = await db.execute({
    sql: 'SELECT * FROM users WHERE id IN (?, ?)',
    args: [canonicalId, duplicateId],
  });
  const canon = both.rows.find((r) => r.id === canonicalId) as Record<string, unknown> | undefined;
  const dup = both.rows.find((r) => r.id === duplicateId) as Record<string, unknown> | undefined;

  if (!canon || !dup) {
    return new Response(JSON.stringify({ error: 'One or both members not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();

  // Build the canonical-row backfill from the duplicate's richer fields.
  const setExprs: string[] = [];
  const setArgs: (string | number | null)[] = [];
  for (const col of FILL_COLS) {
    if (isEmpty(canon[col]) && !isEmpty(dup[col])) {
      setExprs.push(`${col} = ?`);
      setArgs.push(dup[col] as string);
    }
  }
  // Never demote: keep the higher of the two roles.
  const canonLevel = ROLE_LEVEL[String(canon.role)] ?? 0;
  const dupLevel = ROLE_LEVEL[String(dup.role)] ?? 0;
  if (dupLevel > canonLevel) {
    setExprs.push('role = ?');
    setArgs.push(String(dup.role));
  }
  // Approved if either was approved.
  if (!canon.is_approved && dup.is_approved) {
    setExprs.push('is_approved = ?');
    setArgs.push(1);
  }
  setExprs.push('updated_at = ?');
  setArgs.push(now);

  const stmts = [
    // De-dupe the unique/PK-constrained tables: drop the duplicate's rows that
    // would collide with the canonical's before re-pointing.
    {
      sql: `DELETE FROM votes WHERE user_id = ? AND proposal_id IN (SELECT proposal_id FROM votes WHERE user_id = ?)`,
      args: [duplicateId, canonicalId],
    },
    {
      sql: `DELETE FROM proposal_reminders WHERE user_id = ? AND proposal_id IN (SELECT proposal_id FROM proposal_reminders WHERE user_id = ?)`,
      args: [duplicateId, canonicalId],
    },
    {
      sql: `DELETE FROM site_editors WHERE user_id = ? AND site_id IN (SELECT site_id FROM site_editors WHERE user_id = ?)`,
      args: [duplicateId, canonicalId],
    },

    // Re-point every reference from the duplicate to the canonical.
    { sql: `UPDATE votes SET user_id = ? WHERE user_id = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE proposal_reminders SET user_id = ? WHERE user_id = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE site_editors SET user_id = ? WHERE user_id = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE site_editors SET assigned_by = ? WHERE assigned_by = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE proposals SET created_by = ? WHERE created_by = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE site_details SET updated_by = ? WHERE updated_by = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE crypto_projects SET created_by = ? WHERE created_by = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE crypto_projects SET key_assigner_id = ? WHERE key_assigner_id = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE crypto_site_keys SET assigned_to = ? WHERE assigned_to = ?`, args: [canonicalId, duplicateId] },
    { sql: `UPDATE crypto_submissions SET submitted_by = ? WHERE submitted_by = ?`, args: [canonicalId, duplicateId] },

    // Move login identities; they become non-primary under the canonical user.
    // (google_id is globally unique, so no collision is possible.)
    { sql: `UPDATE user_identities SET user_id = ?, is_primary = 0 WHERE user_id = ?`, args: [canonicalId, duplicateId] },

    // Backfill the canonical profile, then drop the duplicate (sessions cascade).
    { sql: `UPDATE users SET ${setExprs.join(', ')} WHERE id = ?`, args: [...setArgs, canonicalId] },
    { sql: `DELETE FROM users WHERE id = ?`, args: [duplicateId] },
  ];

  try {
    await db.batch(stmts, 'write');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'merge failed';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
