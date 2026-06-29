// One-shot (re-runnable) import of
//   "CLIF Consortium Internal Tracker - Manuscripts.csv"
// into the Turso `manuscripts` table that backs /portal/status.
//
// Run from repo root with the Turso env vars loaded:
//   node --env-file=.env scripts/import-manuscripts-csv.mjs
//
// Behavior:
//   - Creates the `manuscripts` table if missing (matches migrations/006).
//   - Normalizes the free-text Status column to canonical tag slugs via the
//     shared src/lib/manuscript-status.js (so the page/form never drift).
//   - Upserts each row by `title` (idempotent). `sort_order` follows CSV order.
//   - Skips rows with no title.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { createClient } from '@libsql/client';
import { normalizeStatus } from '../src/lib/manuscript-status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(
  REPO_ROOT,
  'CLIF Consortium Internal Tracker - Manuscripts.csv'
);

function clean(value) {
  if (value === undefined || value === null) return null;
  // Collapse internal newlines (some quoted cells span lines) and trim.
  const trimmed = String(value).replace(/\s*\n\s*/g, ' ').trim();
  if (!trimmed) return null;
  if (trimmed === '#REF!') return null;
  return trimmed;
}

async function ensureTable(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS manuscripts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    clif_version TEXT,
    ats TEXT,
    status TEXT,
    github_repo TEXT,
    manuscript_link TEXT,
    lead_authors TEXT,
    journal TEXT,
    cite TEXT,
    contributing_sites TEXT,
    validation_buddy TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT,
    updated_by TEXT REFERENCES users(id)
  )`);
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_manuscripts_title ON manuscripts(title)'
  );
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error(
      'TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/import-manuscripts-csv.mjs'
    );
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  console.log('Ensuring manuscripts table…');
  await ensureTable(db);

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
  const now = new Date().toISOString();

  let order = 0;
  for (const row of rows) {
    const title = clean(row['Title']);
    if (!title) {
      skipped.push('(row with no title)');
      continue;
    }
    order += 1;

    const statusSlugs = normalizeStatus(row['Status']);
    const fields = {
      clif_version: clean(row['CLIF version']),
      ats: clean(row['ATS?']),
      status: statusSlugs.length ? statusSlugs.join(',') : null,
      github_repo: clean(row['Github repository']),
      manuscript_link: clean(row['Manuscript link']),
      lead_authors: clean(row['Lead authors']),
      // Header in the sheet is "Journal " (trailing space) — tolerate both.
      journal: clean(row['Journal'] ?? row['Journal ']),
      cite: clean(row['Cite']),
      contributing_sites: clean(row['Contributing Sites']),
      validation_buddy: clean(row['Validation buddy']),
      notes: clean(row['Notes']),
      sort_order: order,
    };

    const existing = await db.execute({
      sql: 'SELECT id FROM manuscripts WHERE title = ?',
      args: [title],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE manuscripts SET
                clif_version = ?, ats = ?, status = ?, github_repo = ?,
                manuscript_link = ?, lead_authors = ?, journal = ?, cite = ?,
                contributing_sites = ?, validation_buddy = ?, notes = ?,
                sort_order = ?, updated_at = ?
              WHERE id = ?`,
        args: [
          fields.clif_version,
          fields.ats,
          fields.status,
          fields.github_repo,
          fields.manuscript_link,
          fields.lead_authors,
          fields.journal,
          fields.cite,
          fields.contributing_sites,
          fields.validation_buddy,
          fields.notes,
          fields.sort_order,
          now,
          existing.rows[0].id,
        ],
      });
      updated++;
      console.log(`  ~ updated ${title}`);
    } else {
      await db.execute({
        sql: `INSERT INTO manuscripts
                (title, clif_version, ats, status, github_repo, manuscript_link,
                 lead_authors, journal, cite, contributing_sites,
                 validation_buddy, notes, sort_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          title,
          fields.clif_version,
          fields.ats,
          fields.status,
          fields.github_repo,
          fields.manuscript_link,
          fields.lead_authors,
          fields.journal,
          fields.cite,
          fields.contributing_sites,
          fields.validation_buddy,
          fields.notes,
          fields.sort_order,
          now,
        ],
      });
      inserted++;
      console.log(`  + inserted ${title}`);
    }
  }

  console.log('\nDone.');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  if (skipped.length) {
    console.log(`  Skipped: ${skipped.length}`);
    for (const s of skipped) console.log(`    - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
