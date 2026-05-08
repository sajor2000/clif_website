// One-shot import of CLIF Consortium Internal Tracker - Member Details.csv
// into the Turso users table.
//
// Run from repo root with the Turso env vars loaded:
//   node --env-file=.env scripts/import-member-csv.mjs
//
// Behavior:
//   - Adds the new columns (degrees, orcid, github_username, gmail_personal,
//     affiliation, funding, conflicts_of_interest, member_status) if missing.
//   - Upserts each CSV row by lowercased email.
//     - Match: UPDATE the new fields + affiliation. Backfills full_name only
//       when currently NULL. Never touches role / is_approved / google_id /
//       avatar_url / institution.
//     - No match: INSERT a stub row with role='member', is_approved=1.
//   - Skips rows with no usable email.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(REPO_ROOT, 'CLIF Consortium Internal Tracker - Member Details.csv');

const NEW_COLUMNS = [
  'degrees',
  'orcid',
  'github_username',
  'gmail_personal',
  'affiliation',
  'funding',
  'conflicts_of_interest',
  'member_status',
];

const ALLOWED_MEMBER_STATUS = new Set(['Member', 'Collaborator', 'Intern', 'Data Scientist']);

function clean(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed === '#REF!') return null;
  return trimmed;
}

function pickFirstEmail(value) {
  const v = clean(value);
  if (!v) return null;
  // Some cells contain "primary / alt" — take first token that looks like an email.
  const candidate = v.split(/[\s,/;]+/).find((t) => t.includes('@'));
  return candidate ? candidate.toLowerCase() : null;
}

function normalizeOrcid(value) {
  const v = clean(value);
  if (!v) return null;
  // Strip any URL prefix and surrounding whitespace; store the bare 19-char id.
  const m = v.match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  return m ? m[1].toUpperCase() : v;
}

function normalizeMemberStatus(value) {
  const v = clean(value);
  if (!v) return null;
  return ALLOWED_MEMBER_STATUS.has(v) ? v : v; // keep as-is; admin can correct
}

async function ensureColumns(db) {
  const existing = await db.execute("SELECT name FROM pragma_table_info('users')");
  const have = new Set(existing.rows.map((r) => r.name));
  for (const col of NEW_COLUMNS) {
    if (!have.has(col)) {
      await db.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
      console.log(`  + added column users.${col}`);
    }
  }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/import-member-csv.mjs');
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  console.log('Ensuring schema columns…');
  await ensureColumns(db);

  console.log(`Reading ${CSV_PATH}`);
  const raw = await readFile(CSV_PATH, 'utf8');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });

  let updated = 0;
  let inserted = 0;
  const skipped = [];

  for (const row of rows) {
    const fullName = clean(row['Name']);
    const email = pickFirstEmail(row['Email']);
    if (!email) {
      skipped.push({ name: fullName || '(no name)', reason: 'no email' });
      continue;
    }

    const fields = {
      degrees: clean(row['Degrees']),
      orcid: normalizeOrcid(row['ORCID']),
      github_username: clean(row['Github username']),
      gmail_personal: pickFirstEmail(row['Gmail']),
      affiliation: clean(row['Affiliation']),
      funding: clean(row['Funding']),
      conflicts_of_interest: clean(row['Conflicts of Interest']),
      member_status: normalizeMemberStatus(row['Member status']),
    };

    const existing = await db.execute({
      sql: 'SELECT id, full_name FROM users WHERE LOWER(email) = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      const { id, full_name } = existing.rows[0];
      const setExprs = [
        'degrees = ?',
        'orcid = ?',
        'github_username = ?',
        'gmail_personal = ?',
        'affiliation = ?',
        'funding = ?',
        'conflicts_of_interest = ?',
        'member_status = ?',
        'updated_at = ?',
      ];
      const args = [
        fields.degrees,
        fields.orcid,
        fields.github_username,
        fields.gmail_personal,
        fields.affiliation,
        fields.funding,
        fields.conflicts_of_interest,
        fields.member_status,
        new Date().toISOString(),
      ];
      // Backfill full_name only when missing.
      if (!full_name && fullName) {
        setExprs.unshift('full_name = ?');
        args.unshift(fullName);
      }
      args.push(id);
      await db.execute({
        sql: `UPDATE users SET ${setExprs.join(', ')} WHERE id = ?`,
        args,
      });
      updated++;
      console.log(`  ~ updated ${email} (${fullName || full_name || 'unnamed'})`);
    } else {
      await db.execute({
        sql: `INSERT INTO users (email, full_name, role, is_approved,
                degrees, orcid, github_username, gmail_personal,
                affiliation, funding, conflicts_of_interest, member_status)
              VALUES (?, ?, 'member', 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          email,
          fullName,
          fields.degrees,
          fields.orcid,
          fields.github_username,
          fields.gmail_personal,
          fields.affiliation,
          fields.funding,
          fields.conflicts_of_interest,
          fields.member_status,
        ],
      });
      inserted++;
      console.log(`  + inserted ${email} (${fullName || 'unnamed'})`);
    }
  }

  console.log('\nDone.');
  console.log(`  Updated: ${updated}`);
  console.log(`  Inserted: ${inserted}`);
  if (skipped.length) {
    console.log(`  Skipped: ${skipped.length}`);
    for (const s of skipped) console.log(`    - ${s.name}: ${s.reason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
