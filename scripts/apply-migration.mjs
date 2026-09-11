// Apply a migration file to the Turso database.
//
// Usage:
//   node --env-file=.env scripts/apply-migration.mjs migrations/018-manuscripts-priority.sql
//
// Uses the same TURSO_DATABASE_URL / TURSO_AUTH_TOKEN the site runs on, so it
// works without a `turso auth login` — handy when the CLI's browser login is
// unreachable. Statements run in order; an "already applied" ALTER is reported
// rather than treated as a failure, so re-running a migration is harmless.

import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

// Migration files are plain DDL, so stripping line comments and splitting on
// `;` is enough. Keep semicolons out of string literals in migrations.
function statementsOf(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAlreadyApplied(err) {
  const m = String(err?.message ?? '').toLowerCase();
  return m.includes('duplicate column name') || m.includes('already exists');
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node --env-file=.env scripts/apply-migration.mjs <migration.sql>');
    process.exit(1);
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error(
      'TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/apply-migration.mjs ' +
        path
    );
    process.exit(1);
  }

  const db = createClient({ url, authToken });
  const statements = statementsOf(readFileSync(path, 'utf8'));
  console.log(`Applying ${path} (${statements.length} statement(s))`);

  let applied = 0;
  let skipped = 0;
  for (const sql of statements) {
    const label = sql.replace(/\s+/g, ' ').slice(0, 70);
    try {
      await db.execute(sql);
      applied++;
      console.log(`  ok      ${label}`);
    } catch (err) {
      if (isAlreadyApplied(err)) {
        skipped++;
        console.log(`  skipped ${label}  (already applied)`);
        continue;
      }
      console.error(`  FAILED  ${label}`);
      throw err;
    }
  }

  console.log(`Done: ${applied} applied, ${skipped} already present.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
