#!/usr/bin/env node
/**
 * Regenerate everything under src/data/cohorts/ from the raw export.
 *
 *   node scripts/refresh-cohort-tableone.mjs [--dry-run]
 *
 * WHY THIS EXISTS
 * ---------------
 * src/data/cohorts/ was originally derived by hand. That is how the Sunnybrook
 * column silently disappeared from every table_one file while surviving in the
 * files that were not re-derived. This script makes the derivation
 * reproducible, so a refresh can never quietly drop a site.
 *
 * SCOPE
 * -----
 * The previous export (07202026) shipped only tableone/ data, so this script
 * covered table_one files alone and the other ten files per cohort were left
 * untouched from an older, unrelated export. The _aggregated export carries all
 * of them, so every file under src/data/cohorts/ is now derived here and the
 * split-provenance problem is gone.
 *
 * THREE TRANSFORMS
 * 1. copy  — same column shape, destination just has a different filename.
 * 2. split — a `<a>_vs_<b>` table_one holds two cohorts side by side as
 *            `a__<Site>` and `b__<Site>`. Take one group's columns and rewrite
 *            the prefix to `Overall__`, the shape the components expect.
 * 3. suffix — sub-cohorts get their own ancillary files in the export, named
 *            `<base>_<group>.csv` (e.g. sofa_mortality_summary_icu.csv). No
 *            column surgery needed; they are copied like any other file.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const RAW = join(ROOT, 'src', 'data', '_aggregated');
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

// Where each cohort's files live inside the export.
const SRC_DIR = {
  overall: 'overall/tableone',
  overall_ward: 'overall_ward/tableone',
  icu: 'strata/icu/tableone',
  vaso: 'strata/vaso/tableone',
  advanced_resp: 'strata/advanced_resp/tableone',
  deaths: 'strata/deaths/tableone',
};

// Sub-cohorts read their parent's directory; ancillary files carry a suffix and
// table_one comes out of a side-by-side comparison file.
const SUBS = {
  vaso__icu: { parent: 'vaso', suffix: '_icu', from: 'table_one_vaso_icu_vs_no_icu.csv', group: 'icu' },
  vaso__no_icu: { parent: 'vaso', suffix: '_no_icu', from: 'table_one_vaso_icu_vs_no_icu.csv', group: 'no_icu' },
  vaso__ed_icu: { parent: 'vaso', suffix: '_ed_icu', from: 'table_one_vaso_ed_icu_vs_ed_ward.csv', group: 'ed_icu' },
  vaso__ed_ward: { parent: 'vaso', suffix: '_ed_ward', from: 'table_one_vaso_ed_icu_vs_ed_ward.csv', group: 'ed_ward' },
  advanced_resp__icu: { parent: 'advanced_resp', suffix: '_icu', from: 'table_one_advanced_resp_icu_vs_no_icu.csv', group: 'icu' },
  advanced_resp__no_icu: { parent: 'advanced_resp', suffix: '_no_icu', from: 'table_one_advanced_resp_icu_vs_no_icu.csv', group: 'no_icu' },
};

// Ancillary files: destination name -> export basename. Same for every cohort
// that has them; a cohort simply lacking one is reported, not fatal.
const ANCILLARY = {
  'comorbidities_per_1000_hospitalizations.csv': 'comorbidities_per_1000_hospitalizations.csv',
  'comorbidities_per_1000_hospitalizations_summary.csv': 'comorbidities_per_1000_hospitalizations_summary.csv',
  'demographic_crosstab_race_ethnicity_sex.csv': 'demographic_crosstab_race_ethnicity_sex.csv',
  'medications_hourly_data.csv': 'medications_hourly_data.csv',
  'sofa_mortality_summary.csv': 'sofa_mortality_summary.csv',
  'mortality_rates.csv': 'mortality_rates.csv',
  'strobe_counts.csv': 'strobe_counts.csv',
  'upset_data.csv': 'upset_data.csv',
  'code_status_combined_summary.csv': 'code_status_combined_summary.csv',
  // Renamed in the _aggregated export; same columns (hour_bin + <stat>__<Site>).
  'pressure_control_hourly.csv': 'pressure_control_pressure_control_mode.csv',
  'tidal_volume_hourly.csv': 'tidal_volume_volume_control_modes.csv',
};

// Only files that already exist for a cohort are refreshed, so the script does
// not invent new files that no component reads. Discovered from the tree.
function currentFiles(cohort) {
  const dir = join(OUT, cohort);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.csv'));
}

const JOBS = [];

// Top-level cohorts.
for (const [cohort, dir] of Object.entries(SRC_DIR)) {
  const byYear = cohort === 'overall' || cohort === 'overall_ward'
    ? 'table_one_by_year.csv'
    : `table_one_${cohort}_by_year.csv`;
  JOBS.push({ src: `${dir}/${byYear}`, dest: `${cohort}/table_one_by_year.csv` });
  if (currentFiles(cohort).includes('table_one_overall.csv')) {
    JOBS.push({ src: `${dir}/table_one_overall.csv`, dest: `${cohort}/table_one_overall.csv` });
  }
  for (const file of currentFiles(cohort)) {
    const base = ANCILLARY[file];
    if (base) JOBS.push({ src: `${dir}/${base}`, dest: `${cohort}/${file}` });
  }
}

// Sub-cohorts.
for (const [cohort, cfg] of Object.entries(SUBS)) {
  const dir = SRC_DIR[cfg.parent];
  JOBS.push({ src: `${dir}/${cfg.from}`, dest: `${cohort}/table_one_by_year.csv`, group: cfg.group });
  for (const file of currentFiles(cohort)) {
    const base = ANCILLARY[file];
    if (!base) continue;
    const suffixed = base.replace(/\.csv$/, `${cfg.suffix}.csv`);
    JOBS.push({ src: `${dir}/${suffixed}`, dest: `${cohort}/${file}` });
  }
}

/** Site codes appearing in a `<group>__<Site>` header row. */
const sitesOf = (text) => {
  const header = parseCSV(text)[0] || [];
  return [...new Set(header.slice(1).map((h) => h.split('__')[1]).filter(Boolean))].sort();
};

let changed = 0;
let missing = 0;
const allSites = new Set();

for (const job of JOBS) {
  const srcPath = join(RAW, job.src);
  const destPath = join(OUT, job.dest);
  if (!existsSync(srcPath)) {
    console.error(`MISSING SOURCE  ${job.src}`);
    missing++;
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
  afterSites.forEach((s) => allSites.add(s));
  const added = afterSites.filter((s) => !beforeSites.includes(s));
  const dropped = beforeSites.filter((s) => !afterSites.includes(s));

  const same = before === out;
  const note = [
    added.length ? `+sites ${added.join(',')}` : '',
    dropped.length ? `-SITES ${dropped.join(',')}` : '',
  ].filter(Boolean).join(' ');
  console.log(`${same ? 'unchanged ' : dryRun ? 'would write' : 'wrote     '} ${job.dest.padEnd(56)} (${afterSites.length} sites) ${note}`);
  if (dropped.length) console.error(`  WARNING: ${job.dest} loses site(s) ${dropped.join(',')} — check the export`);

  if (!same && !dryRun) {
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, out);
    changed++;
  }
}

console.log(`\n${JOBS.length} job(s), ${missing} missing source(s)`);
console.log(`site codes seen: ${[...allSites].sort().join(', ')}`);
console.log(dryRun ? 'dry run — no files written' : `${changed} file(s) written`);
