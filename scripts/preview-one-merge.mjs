// Read-only preview of what dedupe-stub-members.mjs would do for ONE person.
// Run: node --env-file=.env scripts/preview-one-merge.mjs "Kaveri Chhikara"

import { createClient } from '@libsql/client';

const TARGET_NAME = process.argv[2];
if (!TARGET_NAME) {
  console.error('Usage: node --env-file=.env scripts/preview-one-merge.mjs "<full name>"');
  process.exit(1);
}

const MERGE_FIELDS = [
  'full_name',
  'institution',
  'avatar_url',
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

function normName(name) {
  return (name || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
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

function fmt(v) {
  if (v === null || v === undefined || v === '') return '∅ (NULL)';
  if (typeof v === 'string' && v.length > 90) return JSON.stringify(v.slice(0, 87) + '…');
  return JSON.stringify(v);
}

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const target = normName(TARGET_NAME);
  const { rows } = await db.execute('SELECT * FROM users');
  const matches = rows.filter((r) => normName(r.full_name) === target);

  if (matches.length === 0) {
    console.log(`No users with name matching "${TARGET_NAME}"`);
    return;
  }

  console.log(`Found ${matches.length} row(s) for "${TARGET_NAME}":\n`);
  for (const r of matches) {
    const tag = r.google_id ? 'OAuth' : 'stub ';
    console.log(`  [${tag}] id=${r.id}  email=${r.email}  role=${r.role}`);
  }

  const oauthRows = matches.filter((m) => m.google_id);
  const stubRows = matches.filter((m) => !m.google_id);

  if (oauthRows.length === 0 || stubRows.length === 0) {
    console.log('\nNothing to merge (need both OAuth and stub).');
    return;
  }

  const canonical = pickCanonical(oauthRows);
  console.log(`\nCanonical → ${canonical.email} (id=${canonical.id})`);
  if (oauthRows.length > 1) {
    for (const o of oauthRows.filter((r) => r.id !== canonical.id)) {
      console.log(`Untouched OAuth → ${o.email} (id=${o.id})`);
    }
  }

  for (const stub of stubRows) {
    console.log(`\n— Stub being merged: ${stub.email} (id=${stub.id}) —`);

    console.log('\nField-by-field comparison:');
    console.log(
      '  ' + 'field'.padEnd(24) + 'canonical (kept)'.padEnd(50) + 'stub (going away)'
    );
    for (const f of MERGE_FIELDS) {
      const cv = canonical[f];
      const sv = stub[f];
      const cMissing = cv === null || cv === undefined || cv === '';
      const willBackfill = cMissing && sv;
      const marker = willBackfill ? ' ← BACKFILL' : '';
      console.log(`  ${f.padEnd(24)}${fmt(cv).padEnd(50)}${fmt(sv)}${marker}`);
    }

    // FK refs on the stub
    console.log('\nForeign-key references on stub:');
    let totalRefs = 0;
    for (const [table, col] of FK_REFS) {
      const { rows: cnt } = await db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${col} = ?`,
        args: [stub.id],
      });
      const n = Number(cnt[0]?.cnt) || 0;
      totalRefs += n;
      const flag = n > 0 ? ' ← BLOCKING' : '';
      console.log(`  ${(table + '.' + col).padEnd(36)}${n}${flag}`);
    }

    // Build the actual SQL the script would run.
    const setExprs = [];
    const args = [];
    for (const f of MERGE_FIELDS) {
      const cv = canonical[f];
      if ((cv === null || cv === undefined || cv === '') && stub[f]) {
        setExprs.push(`${f} = ?`);
        args.push(stub[f]);
      }
    }

    console.log('\nSQL that would execute:');
    if (setExprs.length === 0) {
      console.log('  (no UPDATE — canonical already has all fields)');
    } else {
      console.log(`  UPDATE users SET ${setExprs.join(', ')}, updated_at = ?`);
      console.log(`    WHERE id = '${canonical.id}';`);
      console.log('  -- args:', args.map(fmt).join(', '));
    }
    if (totalRefs === 0) {
      console.log(`  DELETE FROM users WHERE id = '${stub.id}';`);
    } else {
      console.log(`  -- DELETE skipped: stub has ${totalRefs} FK reference(s)`);
    }
  }

  console.log('\n(read-only preview; no changes made)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
