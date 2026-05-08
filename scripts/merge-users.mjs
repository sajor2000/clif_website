// Merge two specific users by email. Same lossless logic as
// dedupe-stub-members.mjs but operates on an explicit pair, so it works for
// duplicates that have different name spellings (e.g. "Alex" vs "Alexander").
//
// Run:
//   node --env-file=.env scripts/merge-users.mjs \
//     --canonical=alexander.c.ortiz@gmail.com \
//     --other=alexander.ortiz@pennmedicine.upenn.edu
//   ...append --apply to actually write.
//
// Refuses to delete the "other" row if it has any FK references, or if it
// has a google_id (real OAuth account) unless --force is also passed.

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const CANONICAL_EMAIL = argValue('canonical');
const OTHER_EMAIL = argValue('other');

if (!CANONICAL_EMAIL || !OTHER_EMAIL) {
  console.error('Usage: node --env-file=.env scripts/merge-users.mjs --canonical=<email> --other=<email> [--apply] [--force]');
  process.exit(1);
}

const MERGE_FIELDS = [
  'full_name',
  'institution',
  'avatar_url',
  'work_email',
  'degrees',
  'orcid',
  'github_username',
  'gmail_personal',
  'affiliation',
  'funding',
  'conflicts_of_interest',
  'member_status',
];

const FK_REFS = [
  ['sessions', 'user_id'],
  ['proposals', 'created_by'],
  ['votes', 'user_id'],
  ['site_details', 'updated_by'],
  ['site_editors', 'user_id'],
  ['site_editors', 'assigned_by'],
  ['crypto_projects', 'created_by'],
  ['crypto_projects', 'key_assigner_id'],
  ['crypto_site_keys', 'assigned_to'],
  ['crypto_submissions', 'submitted_by'],
];

async function loadByEmail(db, email) {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
    args: [email],
  });
  return rows[0] || null;
}

async function countReferences(db, userId) {
  const counts = {};
  for (const [table, col] of FK_REFS) {
    const { rows } = await db.execute({
      sql: `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${col} = ?`,
      args: [userId],
    });
    const n = Number(rows[0]?.cnt) || 0;
    if (n > 0) counts[`${table}.${col}`] = n;
  }
  return counts;
}

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log(APPLY ? 'Mode: APPLY (writes will be committed)' : 'Mode: dry-run (no changes)');

  const canonical = await loadByEmail(db, CANONICAL_EMAIL);
  const other = await loadByEmail(db, OTHER_EMAIL);
  if (!canonical) {
    console.error(`No user found with email: ${CANONICAL_EMAIL}`);
    process.exit(1);
  }
  if (!other) {
    console.error(`No user found with email: ${OTHER_EMAIL}`);
    process.exit(1);
  }
  if (canonical.id === other.id) {
    console.error('Canonical and other resolved to the same row.');
    process.exit(1);
  }

  console.log(`\nCanonical: ${canonical.full_name} <${canonical.email}>  id=${canonical.id}  role=${canonical.role}  google_id=${canonical.google_id ? 'yes' : 'no'}`);
  console.log(`Other:     ${other.full_name} <${other.email}>  id=${other.id}  role=${other.role}  google_id=${other.google_id ? 'yes' : 'no'}`);

  if (other.google_id && !FORCE) {
    console.error('\nRefusing to merge: "other" row has google_id (real OAuth account). Pass --force to override.');
    process.exit(1);
  }

  const refs = await countReferences(db, other.id);
  if (Object.keys(refs).length > 0) {
    console.error('\nRefusing to merge: "other" row has FK references:', refs);
    process.exit(1);
  }

  const setExprs = [];
  const args = [];
  const fills = {};

  // Lossless email handling
  const cEmail = String(canonical.email || '').toLowerCase();
  const oEmail = String(other.email || '').toLowerCase();
  if (oEmail && oEmail !== cEmail && !canonical.work_email) {
    setExprs.push('work_email = ?');
    args.push(other.email);
    fills.work_email = other.email;
  }

  for (const field of MERGE_FIELDS) {
    if (field === 'work_email') continue;
    const cv = canonical[field];
    if ((cv === null || cv === undefined || cv === '') && other[field]) {
      setExprs.push(`${field} = ?`);
      args.push(other[field]);
      fills[field] = other[field];
    }
  }

  console.log('\nField-by-field plan:');
  if (Object.keys(fills).length === 0) {
    console.log('  (no backfills — canonical already has values for every field)');
  } else {
    for (const [k, v] of Object.entries(fills)) {
      const display = typeof v === 'string' && v.length > 80 ? JSON.stringify(v.slice(0, 77) + '…') : JSON.stringify(v);
      console.log(`  + ${k} = ${display}`);
    }
  }
  console.log(`\nDelete: row id=${other.id}  email=${other.email}`);

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to commit.');
    return;
  }

  if (setExprs.length > 0) {
    setExprs.push('updated_at = ?');
    args.push(new Date().toISOString());
    args.push(canonical.id);
    await db.execute({
      sql: `UPDATE users SET ${setExprs.join(', ')} WHERE id = ?`,
      args,
    });
  }
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [other.id] });

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
