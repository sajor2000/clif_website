// Read-only: for each site, how many approved members can be named as authors
// on a project run. A member belongs to a site when their profile institution
// equals the site's institution or site name (the rule in
// src/lib/project-run-authors.ts). Sites with 0 need their members to fix the
// institution on their profile, or the site's institution to be corrected.
//
// Usage:
//   node --env-file=.env scripts/check-site-rosters.mjs

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/check-site-rosters.mjs');
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const norm = (s) => String(s || '').trim().toLowerCase();

const sites = (await db.execute('SELECT site_name, institution FROM site_details ORDER BY site_name')).rows;
const users = (
  await db.execute({
    sql: 'SELECT institution FROM users WHERE is_approved = 1 AND LOWER(email) != ?',
    args: ['clifconsortium@gmail.com'],
  })
).rows;

const perInstitution = new Map();
for (const u of users) perInstitution.set(norm(u.institution), (perInstitution.get(norm(u.institution)) || 0) + 1);

const matched = new Set();
console.log('Members who can be named as authors, per site:\n');
for (const s of sites) {
  const keys = [...new Set([norm(s.institution), norm(s.site_name)].filter(Boolean))];
  const n = keys.reduce((sum, k) => sum + (perInstitution.get(k) || 0), 0);
  keys.forEach((k) => matched.add(k));
  console.log(`  ${String(n).padStart(3)}  ${s.site_name}${n === 0 ? `   <-- none (site institution: ${s.institution || 'not set'})` : ''}`);
}

const unmatched = [...perInstitution.entries()].filter(([k]) => !matched.has(k));
if (unmatched.length) {
  console.log('\nMember institutions that match no site:\n');
  for (const [k, n] of unmatched) console.log(`  ${String(n).padStart(3)}  ${k || '(blank)'}`);
}
