// Sync DB users.role to match the steering committee section of
// src/pages/team.astro. Anyone in the hardcoded list becomes role='steering';
// anyone currently 'steering' but NOT in the list is demoted to 'member'.
// role='admin' is never modified.
//
// Run:
//   node --env-file=.env scripts/sync-steering-roles.mjs           # dry-run
//   node --env-file=.env scripts/sync-steering-roles.mjs --apply

import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');

// Manual overrides for cases where fuzzy name matching fails (married names,
// hyphenations that confuse last-name extraction, etc.). Keyed by team.astro
// name; value is the canonical email of the matching DB user.
const EMAIL_OVERRIDES = {
  'Catherine Gao': 'cathy.a.gao@gmail.com',
};

// Pulled from src/pages/team.astro "CLIF Steering Committee" section.
const STEERING_NAMES = [
  'Nicholas Ingraham',
  'Catherine Gao',     // DB: Cathy Gao-Howard
  'Chad Hochberg',
  'Kaveri Chhikara',
  'Vaishvik Chaudhari',
  'Pat Lyons',         // DB: Patrick G Lyons
  'J.C. Rojas',
  'William Parker',
  'Aartik Sarma',
  'Andre Amaral',      // DB: Andre C K B Amaral
  'Alexander Ortiz',   // DB: Alex Ortiz
  'Anna Barker',
  'Casey Eddington',
  'Edward Schenck',    // DB: Edward J Schenck
  'Kevin Buell',
  'Nathan Mesfin',
  'Siva Bhavani',
  'Snigdha Jain',
];

function norm(s) {
  return (s || '').toLowerCase().replace(/[.,'`-]/g, '').replace(/\s+/g, ' ').trim();
}

function nameTokens(s) {
  return norm(s).split(' ').filter(Boolean);
}

function lastName(s) {
  const t = nameTokens(s);
  return t[t.length - 1] || '';
}

function firstInitial(s) {
  const t = nameTokens(s);
  return (t[0] || '')[0] || '';
}

function findMatch(targetName, users) {
  if (EMAIL_OVERRIDES[targetName]) {
    const wanted = EMAIL_OVERRIDES[targetName].toLowerCase();
    const u = users.find((x) => String(x.email || '').toLowerCase() === wanted);
    if (u) return { user: u, how: `override → ${u.email}` };
  }

  const tNorm = norm(targetName);
  const exact = users.find((u) => norm(u.full_name) === tNorm);
  if (exact) return { user: exact, how: 'exact' };

  const tLast = lastName(targetName);
  const tInitial = firstInitial(targetName);
  const candidates = users.filter((u) => {
    const last = lastName(u.full_name);
    const fi = firstInitial(u.full_name);
    return last === tLast && fi === tInitial;
  });
  if (candidates.length === 1) return { user: candidates[0], how: `last-name + first-initial (${tInitial}. ${tLast})` };
  if (candidates.length > 1) return { ambiguous: candidates };

  // Last-name only, single match
  const byLast = users.filter((u) => lastName(u.full_name) === tLast);
  if (byLast.length === 1) return { user: byLast[0], how: `last-name only (${tLast})` };
  if (byLast.length > 1) return { ambiguous: byLast };

  return null;
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
console.log(APPLY ? 'Mode: APPLY' : 'Mode: dry-run (no changes)');

const { rows: users } = await db.execute('SELECT id, full_name, email, role FROM users');

const matchedIds = new Set();
const promotions = [];
const unmatched = [];
const ambiguous = [];

for (const target of STEERING_NAMES) {
  const m = findMatch(target, users);
  if (!m) {
    unmatched.push(target);
    continue;
  }
  if (m.ambiguous) {
    ambiguous.push({ target, candidates: m.ambiguous });
    continue;
  }
  matchedIds.add(m.user.id);
  if (m.user.role !== 'steering' && m.user.role !== 'admin') {
    promotions.push({ user: m.user, target, how: m.how, oldRole: m.user.role });
  } else if (m.user.role === 'admin') {
    console.log(`  · ${target} → ${m.user.full_name} <${m.user.email}> already admin (untouched, but counted as steering)`);
  }
}

const demotions = users.filter(
  (u) => u.role === 'steering' && !matchedIds.has(u.id)
);

console.log(`\nPromotions to steering (${promotions.length}):`);
for (const p of promotions) {
  console.log(`  ${p.target} → ${p.user.full_name} <${p.user.email}> [${p.how}]  ${p.oldRole} → steering`);
}

console.log(`\nDemotions from steering to member (${demotions.length}):`);
for (const u of demotions) {
  console.log(`  ${u.full_name} <${u.email}>  steering → member`);
}

if (unmatched.length) {
  console.log(`\nNot matched in DB (${unmatched.length}) — likely no portal account yet:`);
  for (const n of unmatched) console.log(`  - ${n}`);
}
if (ambiguous.length) {
  console.log(`\nAmbiguous matches (${ambiguous.length}) — review manually:`);
  for (const a of ambiguous) {
    console.log(`  - ${a.target}:`);
    for (const c of a.candidates) console.log(`      ${c.full_name} <${c.email}> role=${c.role}`);
  }
}

if (APPLY) {
  for (const p of promotions) {
    await db.execute({
      sql: 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
      args: ['steering', new Date().toISOString(), p.user.id],
    });
  }
  for (const u of demotions) {
    await db.execute({
      sql: 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
      args: ['member', new Date().toISOString(), u.id],
    });
  }
  console.log(`\nApplied: ${promotions.length} promotion(s), ${demotions.length} demotion(s).`);
} else {
  console.log('\nDry-run only. Re-run with --apply to commit.');
}
