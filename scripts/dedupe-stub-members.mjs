// Merges CSV-imported stub user rows (no google_id) into their OAuth-row
// twin and deletes the stub. Dry-run by default; pass --apply to write.
//
// Run:
//   node --env-file=.env scripts/dedupe-stub-members.mjs           # dry-run
//   node --env-file=.env scripts/dedupe-stub-members.mjs --apply
//
// Logic per name-normalized group:
//   - Canonical = OAuth row (google_id NOT NULL).
//     If multiple, prefer role='steering', then 'admin', then 'member',
//     then earliest created_at.
//   - For each stub (google_id IS NULL) in the group:
//       Backfill canonical's NULL fields with stub's values.
//       Verify the stub has no foreign-key references (votes, sessions,
//       site_editors, etc.). If clean, delete it. Otherwise skip + warn.
//   - If a group has multiple OAuth rows (e.g. someone signed up twice
//     with two different Google accounts), do NOT touch the non-canonical
//     OAuth row — just report it for human review.
//   - Groups with only one row, or only stubs and no OAuth row, are left
//     alone.

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');

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

// Columns to ensure on `users` before merging.
const REQUIRED_COLUMNS = [
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

// (table, column) pairs that reference users.id
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

function normName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROLE_RANK = { steering: 0, admin: 1, member: 2 };
function pickCanonical(oauthRows) {
  return [...oauthRows].sort((a, b) => {
    const ra = ROLE_RANK[a.role] ?? 99;
    const rb = ROLE_RANK[b.role] ?? 99;
    if (ra !== rb) return ra - rb;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  })[0];
}

async function ensureColumns(db) {
  const existing = await db.execute("SELECT name FROM pragma_table_info('users')");
  const have = new Set(existing.rows.map((r) => r.name));
  for (const col of REQUIRED_COLUMNS) {
    if (!have.has(col)) {
      await db.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
      console.log(`  + added column users.${col}`);
    }
  }
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
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set.');
    process.exit(1);
  }
  const db = createClient({ url, authToken });

  console.log(APPLY ? 'Mode: APPLY (writes will be committed)' : 'Mode: dry-run (no changes)');

  if (APPLY) {
    console.log('Ensuring schema columns…');
    await ensureColumns(db);
  }

  const { rows } = await db.execute('SELECT * FROM users');
  const groups = new Map();
  for (const row of rows) {
    const key = normName(row.full_name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let merged = 0;
  let deleted = 0;
  let skippedHasRefs = 0;
  let skippedAmbiguous = 0;

  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const oauthRows = members.filter((m) => m.google_id);
    const stubRows = members.filter((m) => !m.google_id);
    if (oauthRows.length === 0 || stubRows.length === 0) continue;

    const canonical = pickCanonical(oauthRows);
    console.log(`\n${members[0].full_name}`);
    console.log(`  canonical → ${canonical.email} (role=${canonical.role})`);
    if (oauthRows.length > 1) {
      const other = oauthRows.filter((r) => r.id !== canonical.id);
      for (const o of other) {
        console.log(`  other OAuth (left alone) → ${o.email} (role=${o.role})`);
      }
      skippedAmbiguous += other.length;
    }

    for (const stub of stubRows) {
      const refs = await countReferences(db, stub.id);
      if (Object.keys(refs).length > 0) {
        console.log(`  ! stub ${stub.email} has FK refs:`, refs, '— skipping');
        skippedHasRefs++;
        continue;
      }

      // Build merge SET clause: only fill canonical fields that are currently NULL.
      const setExprs = [];
      const args = [];
      const fills = {};

      // Lossless email handling: if the stub's email differs from the canonical's
      // OAuth identity and canonical.work_email is empty, preserve stub.email as
      // the canonical's work_email. (canonical.email is never overwritten — it's
      // the OAuth identity used for auth lookups.)
      const canonicalEmail = String(canonical.email || '').toLowerCase();
      const stubEmail = String(stub.email || '').toLowerCase();
      const canonicalWorkEmail = canonical.work_email ?? null;
      if (stubEmail && stubEmail !== canonicalEmail && !canonicalWorkEmail) {
        setExprs.push('work_email = ?');
        args.push(stub.email);
        fills.work_email = stub.email;
      }

      for (const field of MERGE_FIELDS) {
        if (field === 'work_email') continue; // handled above
        if ((canonical[field] === null || canonical[field] === undefined || canonical[field] === '') && stub[field]) {
          setExprs.push(`${field} = ?`);
          args.push(stub[field]);
          fills[field] = stub[field];
        }
      }

      if (setExprs.length > 0) {
        console.log(`  merge fields → canonical:`, fills);
      } else {
        console.log(`  merge: nothing to backfill (canonical already has values)`);
      }
      console.log(`  delete stub ${stub.email}`);

      if (APPLY) {
        if (setExprs.length > 0) {
          setExprs.push('updated_at = ?');
          args.push(new Date().toISOString());
          args.push(canonical.id);
          await db.execute({
            sql: `UPDATE users SET ${setExprs.join(', ')} WHERE id = ?`,
            args,
          });
          // Mirror in-memory canonical so subsequent stubs in the same group
          // see the freshly populated fields.
          for (const [k, v] of Object.entries(fills)) canonical[k] = v;
          merged++;
        }
        await db.execute({
          sql: 'DELETE FROM users WHERE id = ?',
          args: [stub.id],
        });
        deleted++;
      }
    }
  }

  console.log('\nSummary:');
  console.log(`  Stubs ${APPLY ? 'deleted' : 'planned for deletion'}: ${APPLY ? deleted : '(see above)'}`);
  if (APPLY) console.log(`  Merge updates applied: ${merged}`);
  if (skippedHasRefs) console.log(`  Skipped (FK references): ${skippedHasRefs}`);
  if (skippedAmbiguous) console.log(`  Other OAuth rows untouched (ambiguous): ${skippedAmbiguous}`);
  if (!APPLY) console.log('\nDry-run only. Re-run with --apply to commit.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
