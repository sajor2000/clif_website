#!/usr/bin/env node
/**
 * Regenerate the cohort dashboard's table_one CSVs from the raw export.
 *
 *   node scripts/refresh-cohort-tableone.mjs [--dry-run]
 *
 * WHY THIS EXISTS
 * ---------------
 * src/data/cohorts/ was originally derived from src/data/07202026/ by hand.
 * That is how the Sunnybrook column silently disappeared from every table_one
 * file while surviving in the files that were not re-derived. This script makes
 * the derivation reproducible, so a refresh can never quietly drop a site.
 *
 * SCOPE — table_one files only.
 * The raw export contains only tableone/ data. The other files under
 * src/data/cohorts/ (mortality_rates, strobe_counts, code_status, upset_data,
 * comorbidities, demographic_crosstab, medications_hourly, sofa_mortality,
 * pressure_control, tidal_volume) have NO source in 07202026/ and are left
 * untouched. They came from a different export.
 *
 * TWO TRANSFORMS
 * 1. copy  — same column shape, destination just has a different filename.
 * 2. split — a `<a>_vs_<b>` file holds two cohorts side by side as `a__<Site>`
 *            and `b__<Site>`. Take one group's columns and rewrite the prefix
 *            to `Overall__`, which is the shape the components expect.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const RAW = join(ROOT, 'src', 'data', '07202026');
const OUT = join(ROOT, 'src', 'data', 'cohorts');
const dryRun = process.argv.includes('--dry-run');

/** Parse CSV into rows of fields. Handles quoted fields containing commas and
 *  newlines — the Variable column has both, so naive line splitting corrupts it. */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Re-emit a field, quoting only when required, to keep diffs minimal. */
function emitField(v) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
const emitCSV = (rows) => rows.map((r) => r.map(emitField).join(',')).join('\n') + '\n';

/** Keep the Variable column plus every `<group>__<Site>` column, renaming the
 *  group to Overall. Throws if the group is absent — a silent empty file is
 *  exactly the failure mode this script exists to prevent. */
function splitGroup(text, group) {
  const rows = parseCSV(text);
  const header = rows[0];
  const keep = [0];
  const outHeader = [header[0]];
  for (let i = 1; i < header.length; i++) {
    const sep = header[i].indexOf('__');
    if (sep === -1) continue;
    if (header[i].slice(0, sep) !== group) continue;
    keep.push(i);
    outHeader.push(`Overall__${header[i].slice(sep + 2)}`);
  }
  if (keep.length === 1) throw new Error(`no columns for group "${group}"`);
  return emitCSV([outHeader, ...rows.slice(1).map((r) => keep.map((i) => r[i] ?? ''))]);
}

// src -> dest, relative to RAW and OUT. `group` present means split.
const JOBS = [
  { src: 'overall/tableone/table_one_overall.csv', dest: 'overall/table_one_overall.csv' },
  { src: 'overall/tableone/table_one_by_year.csv', dest: 'overall/table_one_by_year.csv' },
  { src: 'overall_ward/tableone/table_one_overall.csv', dest: 'overall_ward/table_one_overall.csv' },
  { src: 'overall_ward/tableone/table_one_by_year.csv', dest: 'overall_ward/table_one_by_year.csv' },
  { src: 'strata/icu/tableone/table_one_icu_by_year.csv', dest: 'icu/table_one_by_year.csv' },
  { src: 'strata/vaso/tableone/table_one_vaso_by_year.csv', dest: 'vaso/table_one_by_year.csv' },
  { src: 'strata/advanced_resp/tableone/table_one_advanced_resp_by_year.csv', dest: 'advanced_resp/table_one_by_year.csv' },
  { src: 'strata/deaths/tableone/table_one_deaths_by_year.csv', dest: 'deaths/table_one_by_year.csv' },
  { src: 'strata/vaso/tableone/table_one_vaso_icu_vs_no_icu.csv', dest: 'vaso__icu/table_one_by_year.csv', group: 'icu' },
  { src: 'strata/vaso/tableone/table_one_vaso_icu_vs_no_icu.csv', dest: 'vaso__no_icu/table_one_by_year.csv', group: 'no_icu' },
  { src: 'strata/vaso/tableone/table_one_vaso_ed_icu_vs_ed_ward.csv', dest: 'vaso__ed_icu/table_one_by_year.csv', group: 'ed_icu' },
  { src: 'strata/vaso/tableone/table_one_vaso_ed_icu_vs_ed_ward.csv', dest: 'vaso__ed_ward/table_one_by_year.csv', group: 'ed_ward' },
  { src: 'strata/advanced_resp/tableone/table_one_advanced_resp_icu_vs_no_icu.csv', dest: 'advanced_resp__icu/table_one_by_year.csv', group: 'icu' },
  { src: 'strata/advanced_resp/tableone/table_one_advanced_resp_icu_vs_no_icu.csv', dest: 'advanced_resp__no_icu/table_one_by_year.csv', group: 'no_icu' },
];

const sitesOf = (text) => {
  const header = parseCSV(text)[0];
  return [...new Set(header.slice(1).map((h) => h.split('__')[1]).filter(Boolean))].sort();
};

let changed = 0;
for (const job of JOBS) {
  const srcPath = join(RAW, job.src);
  const destPath = join(OUT, job.dest);
  if (!existsSync(srcPath)) {
    console.error(`MISSING SOURCE  ${job.src}`);
    process.exitCode = 1;
    continue;
  }
  const raw = readFileSync(srcPath, 'utf-8');
  let out;
  try {
    out = job.group ? splitGroup(raw, job.group) : raw;
  } catch (e) {
    console.error(`FAILED  ${job.dest}: ${e.message}`);
    process.exitCode = 1;
    continue;
  }
  const before = existsSync(destPath) ? readFileSync(destPath, 'utf-8') : null;
  const beforeSites = before ? sitesOf(before) : [];
  const afterSites = sitesOf(out);
  const added = afterSites.filter((s) => !beforeSites.includes(s));
  const dropped = beforeSites.filter((s) => !afterSites.includes(s));

  const same = before === out;
  const note = [
    added.length ? `+sites ${added.join(',')}` : '',
    dropped.length ? `-SITES ${dropped.join(',')}` : '',
  ].filter(Boolean).join(' ');
  console.log(`${same ? 'unchanged' : dryRun ? 'would write' : 'wrote    '}  ${job.dest}  (${afterSites.length} sites) ${note}`);
  if (dropped.length) console.error(`  WARNING: ${job.dest} loses site(s) ${dropped.join(',')} — check the export`);

  if (!same && !dryRun) {
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, out);
    changed++;
  }
}
console.log(`\n${dryRun ? 'dry run — no files written' : `${changed} file(s) written`}`);
