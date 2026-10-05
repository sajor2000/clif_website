// Load the TableOne run's raw-name → mCIDE-category mappings into Turso for
// the members-only mCIDE Surveyor (/portal/mapping-review).
//
// Input: the merged mcide export, one CSV per (table, name column, category
// column) shaped `<x>_name,<x>_category[,extra...],N__<Site>...,N__ALL`. The
// repo is public, so nothing here is written under the repo; the script talks
// straight to the database the site runs on.
//
// Usage:
//   node --env-file=.env scripts/build-mcide-mappings.mjs [--box <dir>] [--dry-run <outdir>] [--offline]
//
// --dry-run writes each field's doc and summary as JSON into <outdir> instead
// of touching the database. --offline skips fetching the mCIDE CSVs from
// GitHub and reuses the last fetched copy. Every real run replaces the
// previous load.
//
// Node 22.18+ strips the types from the shared helpers imported below.

/* global fetch */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { createClient } from '@libsql/client';
import { tableNameFor, categoryColumnsFor, resolveField } from './build-mcide-coverage.mjs';
import { norm, isUnmapped, isVague, statusFor } from '../src/utils/mcideMappings.ts';

const REPO = process.cwd();

const DEFAULT_BOX = path.join(
  process.env.HOME ?? '',
  'Library/CloudStorage/Box-Box/CLIF/Projects/CLIF-TableOne-2026/_aggregated/overall/mcide'
);
const DEFAULT_REPORT = path.join(REPO, 'scripts/.out/mcide-mappings-offschema.csv');
const CONCEPTS = path.join(REPO, 'public/data/mcide/mcide_concepts.json');
const OFFICIAL_CACHE = path.join(REPO, 'scripts/.out/mcide-official.json');

/**
 * Where the permissible values come from: the bundled 2.1 concepts plus the
 * live mCIDE CSVs the data dictionaries link to, on both branches. Sites on
 * the TableOne run already use 3.0 additions (the 126 intermittent meds from
 * #200/#221, for instance), and judging those against 2.1 alone would call
 * most of a field off-schema.
 */
const DDLS = [
  path.join(REPO, 'src/content/v-2-1-0-ddl.sql'),
  path.join(REPO, 'src/content/v-3-0-0-ddl.sql'),
];

/** Provenance shown in the tool. Update when a newer run is ingested. */
export const RUN = { label: 'CLIF TableOne, Sep 2026', mcide_version: '2.1 + 3.0' };

/**
 * Long-tail cap, applied only to a field with more than APPLY_ABOVE_ROWS
 * distinct (name, category) pairs. Such a field keeps a row when the
 * consortium total reaches MIN_TOTAL or the row is among a site's
 * TOP_PER_SITE biggest names. Only the position export trips it (423k rows,
 * mostly one-off free-text concatenations all mapped to not_prone); every
 * other field — including the 84k organism names a new site may well search
 * for — is stored whole.
 */
export const CAP = { APPLY_ABOVE_ROWS: 100000, MIN_TOTAL: 10, TOP_PER_SITE: 500 };

/**
 * Left out of the review, per the consortium: the microbiology exports
 * (organism, fluid, method) and ADT location names.
 */
export const EXCLUDED_TABLES = new Set(['microbiology_culture', 'microbiology_nonculture', 'adt']);

const SITE_PREFIX = 'N__';
const TOTAL_COLUMN = 'N__ALL';

/** Parsed export file: which columns play which role. */
export function describeColumns(columns) {
  const nameCol = columns.find((c) => c.endsWith('_name'));
  const catCol = categoryColumnsFor(columns)[0];
  const siteCols = columns.filter((c) => c.startsWith(SITE_PREFIX) && c !== TOTAL_COLUMN);
  const extras = columns.filter(
    (c) => c !== nameCol && c !== catCol && !c.startsWith(SITE_PREFIX)
  );
  return { nameCol, catCol, siteCols, extras };
}

/** Site record count from a cell: exports carry `1210371.0`, blanks and `nan`. */
export function countOf(cell) {
  const n = Number.parseFloat(cell);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Fold one export file's rows into `field` (a Map of `name\tcategory` → row).
 * Variants of the same field (labs with and without a LOINC column) land in
 * the same map, summing site counts, so a site that exported both shapes is
 * not double-listed.
 */
export function foldRows(field, rows, roles, official) {
  for (const raw of rows) {
    const name = String(raw[roles.nameCol] ?? '').trim();
    const category = String(raw[roles.catCol] ?? '').trim();
    const key = `${name}\t${category}`;
    let row = field.get(key);
    if (!row) {
      row = { n: name, c: category, s: statusFor(category, official), k: {} };
      const x = {};
      for (const col of roles.extras) {
        const v = String(raw[col] ?? '').trim();
        if (v && !isUnmapped(v)) x[col] = v;
      }
      if (Object.keys(x).length > 0) row.x = x;
      field.set(key, row);
    }
    for (const col of roles.siteCols) {
      const n = countOf(raw[col]);
      if (n > 0) row.k[col.slice(SITE_PREFIX.length)] = (row.k[col.slice(SITE_PREFIX.length)] ?? 0) + n;
    }
  }
}

function total(row) {
  let t = 0;
  for (const v of Object.values(row.k)) t += v;
  return t;
}

/**
 * Apply the long-tail cap. Returns the kept rows and, per site, what was
 * dropped, so the UI can state the omission instead of hiding it.
 */
export function applyCap(rows, cap = CAP) {
  if (rows.length <= (cap.APPLY_ABOVE_ROWS ?? 0)) return { rows, tail: {} };
  const keep = new Set();
  const bySite = new Map();
  for (const row of rows) {
    if (total(row) >= cap.MIN_TOTAL) keep.add(row);
    for (const [site, n] of Object.entries(row.k)) {
      if (!bySite.has(site)) bySite.set(site, []);
      bySite.get(site).push([n, row]);
    }
  }
  for (const list of bySite.values()) {
    list.sort((a, b) => b[0] - a[0]);
    for (const [, row] of list.slice(0, cap.TOP_PER_SITE)) keep.add(row);
  }
  const tail = {};
  for (const row of rows) {
    if (keep.has(row)) continue;
    for (const [site, n] of Object.entries(row.k)) {
      tail[site] ??= { names: 0, records: 0 };
      tail[site].names += 1;
      tail[site].records += n;
    }
  }
  return { rows: rows.filter((r) => keep.has(r)), tail };
}

const STATUSES = ['valid', 'case_variant', 'off_schema', 'unmapped'];

function emptyShare() {
  return Object.fromEntries(STATUSES.map((s) => [s, 0]));
}

/** Names (by norm) that at least two sites send to different categories. */
export function conflictNorms(rows) {
  const cats = new Map(); // norm -> Map(category -> Set(site))
  for (const row of rows) {
    if (isUnmapped(row.c)) continue;
    const key = norm(row.n);
    if (!key) continue;
    if (!cats.has(key)) cats.set(key, new Map());
    const byCat = cats.get(key);
    if (!byCat.has(row.c)) byCat.set(row.c, new Set());
    for (const site of Object.keys(row.k)) byCat.get(row.c).add(site);
  }
  const out = new Map(); // norm -> Set(site) involved
  for (const [key, byCat] of cats) {
    if (byCat.size < 2) continue;
    const sites = new Set();
    for (const s of byCat.values()) for (const site of s) sites.add(site);
    out.set(key, sites);
  }
  return out;
}

/** The landing-page scorecard for one field. */
export function summarize(doc) {
  const conflicts = conflictNorms(doc.rows);
  const perSite = {};
  const share = emptyShare();
  const categories = new Set();
  const vague = new Map();
  let names = 0;
  let records = 0;

  for (const site of doc.sites) {
    perSite[site] = { names: 0, records: 0, categories: new Set(), share: emptyShare(), conflicts: 0 };
  }

  for (const row of doc.rows) {
    const t = total(row);
    names += 1;
    records += t;
    share[row.s] += t;
    if (!isUnmapped(row.c)) categories.add(row.c);
    const inConflict = conflicts.get(norm(row.n));
    for (const [site, n] of Object.entries(row.k)) {
      const ps = perSite[site];
      if (!ps) continue;
      ps.names += 1;
      ps.records += n;
      ps.share[row.s] += n;
      if (!isUnmapped(row.c)) ps.categories.add(row.c);
      if (inConflict?.has(site)) ps.conflicts += 1;
    }
    if (isVague(row.c)) {
      const label = isUnmapped(row.c) ? '(unmapped)' : row.c;
      if (!vague.has(label)) vague.set(label, { category: label, names: 0, records: 0, k: {} });
      const b = vague.get(label);
      b.names += 1;
      b.records += t;
      for (const [site, n] of Object.entries(row.k)) b.k[site] = (b.k[site] ?? 0) + n;
    }
  }

  const toShare = (s, denom) =>
    Object.fromEntries(STATUSES.map((k) => [k, denom ? s[k] / denom : 0]));

  return {
    table: doc.table,
    field: doc.field,
    nameCol: doc.nameCol,
    sites: doc.sites,
    names,
    records,
    categories: categories.size,
    conflicts: conflicts.size,
    share: toShare(share, records),
    perSite: Object.fromEntries(
      Object.entries(perSite).map(([site, ps]) => [
        site,
        {
          names: ps.names,
          records: ps.records,
          categories: ps.categories.size,
          share: toShare(ps.share, ps.records),
          conflicts: ps.conflicts,
        },
      ])
    ),
    vague: [...vague.values()].sort((a, b) => b.records - a.records),
    tail: doc.tail,
  };
}

function parseArgs(argv) {
  const args = { box: DEFAULT_BOX, report: DEFAULT_REPORT, 'dry-run': null, offline: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i].replace(/^--/, '');
    if (flag === 'offline') args.offline = true;
    else if (flag in args && argv[i + 1]) args[flag] = argv[++i];
  }
  return args;
}

/**
 * `table.column` → permissible-values CSV URL, from the DDL column comments.
 * A column's COMMENT is JSON whose `permissible` is a markdown link to the
 * CSV on the CLIF repo; the DDL for each version links its own branch.
 */
export function permissibleLinks(ddl) {
  const out = new Map();
  let table = null;
  for (const line of ddl.split('\n')) {
    const t = line.match(/^\s*CREATE TABLE\s+(\w+)/i);
    if (t) {
      table = t[1];
      continue;
    }
    const c = line.match(/^\s*(\w+)\s+\w+.*COMMENT\s+'(\{.*\})'/);
    if (!c || !table) continue;
    const url = c[2].match(/\((https:\/\/github\.com\/[^)]+?\.csv)\)/)?.[1];
    if (url) out.set(`${table}.${c[1]}`, url);
  }
  return out;
}

/** The value column of a permissible-values CSV: the one named for the field, else the first. */
export function valuesFromCsv(text, column) {
  // The upstream CSVs are hand-edited: tolerate ragged rows and stray quotes.
  const rows = parse(text, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, relax_quotes: true });
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const col = cols.find((c) => c === column) ?? cols.find((c) => /categor/i.test(c)) ?? cols[0];
  return rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean);
}

/**
 * Permissible values per field: bundled 2.1 concepts plus whatever the two
 * DDLs link on GitHub. Fetched results are cached so --offline reruns (and a
 * flaky network) reuse them.
 */
export async function officialValues(concepts, { offline = false } = {}) {
  const byField = new Map(); // 'table.field' -> Map(lowerValue -> value)
  const add = (field, value) => {
    if (!byField.has(field)) byField.set(field, new Map());
    const m = byField.get(field);
    if (!m.has(value.toLowerCase())) m.set(value.toLowerCase(), value);
  };
  for (const c of concepts) add(`${c.table_name}.${c.field_name}`, String(c.value));

  let fetched = {};
  if (!offline) {
    const links = new Map();
    for (const ddl of DDLS) {
      if (!fs.existsSync(ddl)) continue;
      for (const [field, url] of permissibleLinks(fs.readFileSync(ddl, 'utf8'))) {
        if (!links.has(field)) links.set(field, new Set());
        links.get(field).add(url);
      }
    }
    for (const [field, urls] of links) {
      for (const url of urls) {
        // Some DDL links say /tree/ where they mean /blob/; raw serves both the same.
        const raw = url.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|tree)\//, 'https://raw.githubusercontent.com/$1/');
        try {
          const res = await fetch(raw);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const values = valuesFromCsv(await res.text(), field.split('.')[1]);
          fetched[field] = [...new Set([...(fetched[field] ?? []), ...values])];
        } catch (err) {
          console.warn(`  ${field}: could not fetch ${raw} (${err.message})`);
        }
      }
    }
    fs.mkdirSync(path.dirname(OFFICIAL_CACHE), { recursive: true });
    fs.writeFileSync(OFFICIAL_CACHE, JSON.stringify(fetched, null, 2));
  } else if (fs.existsSync(OFFICIAL_CACHE)) {
    fetched = JSON.parse(fs.readFileSync(OFFICIAL_CACHE, 'utf8'));
  } else {
    console.warn('--offline with no cached mCIDE CSVs; validating against the bundled 2.1 concepts only.');
  }
  for (const [field, values] of Object.entries(fetched)) for (const v of values) add(field, v);
  return byField;
}

/** Read every mapping export under `dir` into docs keyed by field. */
export function readExports(dir, officialByField) {

  const fields = new Map(); // field key -> { table, field, nameCol, catCol, sites:Set, rows:Map }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).sort();

  for (const file of files) {
    const rows = parse(fs.readFileSync(path.join(dir, file), 'utf8'), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);
    const roles = describeColumns(columns);
    // Category-only and name-only exports carry no mapping.
    if (!roles.nameCol || !roles.catCol) continue;

    const table = tableNameFor(path.basename(file, '.csv'), columns.filter((c) => !c.startsWith(SITE_PREFIX)));
    if (EXCLUDED_TABLES.has(table)) continue;
    const fieldKey = resolveField(table, roles.catCol);
    if (!fields.has(fieldKey)) {
      fields.set(fieldKey, {
        table: fieldKey.split('.')[0],
        field: fieldKey,
        nameCol: roles.nameCol,
        catCol: roles.catCol,
        sites: new Set(),
        rows: new Map(),
      });
    }
    const entry = fields.get(fieldKey);
    for (const col of roles.siteCols) entry.sites.add(col.slice(SITE_PREFIX.length));
    foldRows(entry.rows, rows, roles, officialByField.get(fieldKey));
  }

  const docs = [];
  for (const entry of fields.values()) {
    const all = [...entry.rows.values()].sort((a, b) => total(b) - total(a));
    const { rows, tail } = applyCap(all);
    // A site column exists in the export even when that site mapped nothing
    // for the field; only list sites that actually contributed records.
    const contributing = new Set();
    for (const row of all) for (const site of Object.keys(row.k)) contributing.add(site);
    docs.push({
      table: entry.table,
      field: entry.field,
      nameCol: entry.nameCol,
      catCol: entry.catCol,
      sites: [...entry.sites].filter((s) => contributing.has(s)).sort(),
      rows,
      tail,
      run: RUN,
    });
  }
  return docs.sort((a, b) => a.field.localeCompare(b.field));
}

function writeOffSchemaReport(file, docs) {
  const lines = ['field,value,status,site_count,sites,records'];
  for (const doc of docs) {
    for (const row of doc.rows) {
      if (row.s !== 'off_schema' && row.s !== 'case_variant') continue;
      const sites = Object.keys(row.k).sort();
      lines.push(
        `${doc.field},"${row.c.replace(/"/g, '""')}",${row.s},${sites.length},"${sites.join(' ')}",${total(row)}`
      );
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

async function load(db, docs) {
  // Replace, never accumulate: a re-run after a new TableOne drop must not
  // leave stale fields or names behind.
  await db.execute('DELETE FROM mcide_mapping_docs');
  await db.execute('DELETE FROM mcide_mapping_names');

  for (const doc of docs) {
    const summary = summarize(doc);
    const gz = zlib.gzipSync(JSON.stringify(doc), { level: 9 });
    await db.execute({
      sql: `INSERT INTO mcide_mapping_docs (field_key, table_name, run_label, summary, doc, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [doc.field, doc.table, RUN.label, JSON.stringify(summary), gz],
    });

    const stmts = doc.rows.map((row) => ({
      sql: `INSERT INTO mcide_mapping_names (field_key, name, norm, category, status, sites, n_all)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [doc.field, row.n, norm(row.n), row.c, row.s, JSON.stringify(row.k), total(row)],
    }));
    for (let i = 0; i < stmts.length; i += 500) {
      await db.batch(stmts.slice(i, i + 500), 'write');
    }
    console.log(`${doc.field}: ${doc.rows.length} rows, doc ${(gz.length / 1024).toFixed(0)} KB`);
  }

  try {
    await db.execute("INSERT INTO mcide_mapping_names_fts(mcide_mapping_names_fts) VALUES('rebuild')");
  } catch (err) {
    console.warn(`FTS index not rebuilt (${err.message}); lookup will use LIKE on norm.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.box)) {
    console.error(`Export folder not found: ${args.box}`);
    console.error('Pass --box <dir> if it is mounted elsewhere.');
    process.exit(1);
  }

  const concepts = JSON.parse(fs.readFileSync(CONCEPTS, 'utf8'));
  const official = await officialValues(concepts, { offline: args.offline });
  console.log(`permissible values: ${[...official.values()].reduce((n, m) => n + m.size, 0)} across ${official.size} fields`);
  const docs = readExports(args.box, official);
  if (docs.length === 0) {
    console.error('No mapping exports found — refusing to load an empty run.');
    process.exit(1);
  }
  writeOffSchemaReport(args.report, docs);

  if (args['dry-run']) {
    fs.mkdirSync(args['dry-run'], { recursive: true });
    for (const doc of docs) {
      fs.writeFileSync(path.join(args['dry-run'], `${doc.field}.doc.json`), JSON.stringify(doc));
      fs.writeFileSync(
        path.join(args['dry-run'], `${doc.field}.summary.json`),
        `${JSON.stringify(summarize(doc), null, 2)}\n`
      );
      console.log(`${doc.field}: ${doc.rows.length} rows, ${doc.sites.length} sites`);
    }
    console.log(`dry run: ${docs.length} fields written to ${args['dry-run']}`);
    return;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/build-mcide-mappings.mjs');
    process.exit(1);
  }
  const db = createClient({ url, authToken });
  await load(db, docs);
  console.log(`loaded ${docs.length} fields (${RUN.label})`);
}

// Only run when invoked directly, so the helpers can be unit tested.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
