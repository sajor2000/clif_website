// Read-only: print rows whose full_name matches a substring (case-insensitive).
// Usage: node --env-file=.env scripts/find-by-name.mjs <substring>

import { createClient } from '@libsql/client';

const needle = (process.argv[2] || '').toLowerCase();
if (!needle) {
  console.error('Usage: node --env-file=.env scripts/find-by-name.mjs <name-substring>');
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const { rows } = await db.execute('SELECT id, email, work_email, google_id, full_name, institution, role FROM users');
const matches = rows.filter((r) => (r.full_name || '').toLowerCase().includes(needle));

if (matches.length === 0) {
  console.log(`No users matching "${needle}".`);
  process.exit(0);
}

for (const r of matches) {
  const tag = r.google_id ? 'OAuth' : 'stub ';
  console.log(`[${tag}] ${r.full_name || '—'} <${r.email}>${r.work_email ? `  work=${r.work_email}` : ''}  inst=${r.institution || '—'}  role=${r.role}`);
}
