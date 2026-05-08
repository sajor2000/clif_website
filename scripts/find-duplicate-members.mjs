// Finds candidate duplicate users grouped by normalized full_name.
// Read-only — prints a report and exits.
//
// Run: node --env-file=.env scripts/find-duplicate-members.mjs

import { createClient } from '@libsql/client';

function normName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set.');
    process.exit(1);
  }

  const db = createClient({ url, authToken });
  const { rows } = await db.execute(
    'SELECT id, email, google_id, full_name, institution, role, is_approved FROM users ORDER BY full_name'
  );

  const groups = new Map();
  for (const row of rows) {
    const key = normName(row.full_name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let dupCount = 0;
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    dupCount++;
    console.log(`\n[${members.length}x] ${members[0].full_name}`);
    for (const m of members) {
      const oauth = m.google_id ? 'OAuth' : 'stub';
      console.log(
        `  - id=${m.id.slice(0, 8)}…  email=${m.email}  institution=${m.institution || '—'}  role=${m.role}  approved=${m.is_approved}  ${oauth}`
      );
    }
  }

  if (dupCount === 0) {
    console.log('No duplicate-name groups found.');
  } else {
    console.log(`\n${dupCount} duplicate-name group(s) found.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
