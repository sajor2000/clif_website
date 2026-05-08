// Heuristic duplicate finder. Read-only.
// Groups users by normalized last name and reports likely-same-person pairs:
//   STRONG: one first name is a prefix of the other (Alex / Alexander)
//   MEDIUM: same first initial, both names short
//   WEAK:   same last name only, different first names — printed last for triage
//
// Run: node --env-file=.env scripts/find-fuzzy-duplicates.mjs

import { createClient } from '@libsql/client';

function norm(s) {
  return (s || '').toLowerCase().replace(/[.,'`]/g, '').replace(/\s+/g, ' ').trim();
}

function nameParts(full) {
  const tokens = norm(full).split(' ').filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return { first: tokens[0], middle: [], last: tokens[0] };
  return { first: tokens[0], middle: tokens.slice(1, -1), last: tokens[tokens.length - 1] };
}

function emailDomain(e) {
  const at = (e || '').lastIndexOf('@');
  return at < 0 ? '' : e.slice(at + 1).toLowerCase();
}

function classify(a, b) {
  const pa = nameParts(a.full_name);
  const pb = nameParts(b.full_name);
  if (!pa || !pb) return null;
  if (pa.last !== pb.last) return null;

  if (pa.first === pb.first) {
    return { tier: 'EXACT', reason: 'same first + last name' };
  }
  if (pa.first.startsWith(pb.first) || pb.first.startsWith(pa.first)) {
    return { tier: 'STRONG', reason: `first-name prefix (${pa.first}/${pb.first})` };
  }
  if (pa.first[0] === pb.first[0]) {
    return { tier: 'MEDIUM', reason: `same first initial + last name` };
  }
  return { tier: 'WEAK', reason: 'same last name only' };
}

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const { rows } = await db.execute('SELECT id, email, work_email, google_id, full_name, institution, role FROM users WHERE is_approved = 1 ORDER BY full_name');

  const tiers = { STRONG: [], MEDIUM: [], WEAK: [] };

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const cls = classify(rows[i], rows[j]);
      if (!cls || cls.tier === 'EXACT') continue;
      const sameDomain = emailDomain(rows[i].email) === emailDomain(rows[j].email);
      const sameInstitution = norm(rows[i].institution) === norm(rows[j].institution) && norm(rows[i].institution) !== '';
      tiers[cls.tier].push({ a: rows[i], b: rows[j], reason: cls.reason, sameDomain, sameInstitution });
    }
  }

  function printPair(p, tier) {
    const flags = [];
    if (p.sameInstitution) flags.push('same institution');
    if (p.sameDomain) flags.push('same email domain');
    const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
    console.log(`\n  [${tier}] ${p.a.full_name}  ↔  ${p.b.full_name}  (${p.reason})${flagStr}`);
    for (const r of [p.a, p.b]) {
      const tag = r.google_id ? 'OAuth' : 'stub ';
      console.log(`     [${tag}] ${r.email}${r.work_email ? ` (work: ${r.work_email})` : ''}  inst=${r.institution || '—'}  role=${r.role}`);
    }
  }

  for (const tier of ['STRONG', 'MEDIUM', 'WEAK']) {
    if (tiers[tier].length === 0) continue;
    console.log(`\n=== ${tier} candidates (${tiers[tier].length}) ===`);
    // Sort: same-institution first, then same-domain, then alpha
    tiers[tier].sort((x, y) => {
      if (x.sameInstitution !== y.sameInstitution) return x.sameInstitution ? -1 : 1;
      if (x.sameDomain !== y.sameDomain) return x.sameDomain ? -1 : 1;
      return x.a.full_name.localeCompare(y.a.full_name);
    });
    for (const p of tiers[tier]) printPair(p, tier);
  }

  const total = tiers.STRONG.length + tiers.MEDIUM.length + tiers.WEAK.length;
  console.log(`\nDone. ${total} candidate pair(s) flagged.`);
  if (tiers.STRONG.length === 0 && tiers.MEDIUM.length === 0) {
    console.log('No high-confidence duplicates remaining.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
