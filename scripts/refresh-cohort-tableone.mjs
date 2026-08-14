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
 * ONE TRANSFORM
 * copy — same column shape, destination just has a different filename (plus
 *        dropShiftedYears() column filtering on the way through).
 *
 * Sub-cohort splits (advanced_resp__icu, vaso__ed_ward, ...) were removed in
 * Aug 2026 along with their `_vs_` split transform: the dashboard dropped its
 * third-level picker (SUBCOHORTS is empty in src/utils/cohortData.ts) and the
 * data was deleted rather than shipped unread. See src/data/processing.md.
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

/**
 * Drop columns whose group is not a real calendar year.
 *
 * MIMIC-IV de-identifies by shifting each patient's dates forward by a random
 * per-patient offset, so its admissions land in 2110-2211. Those columns are
 * dense for MIMIC and empty for all eleven other sites, and carrying them
 * sextuples every by-year file (716KB against 122KB for the overall cohort)
 * with a century that never happened. MIMIC keeps its `Overall` column and so
 * remains in every all-years view.
 *
 * Mirrors isCalendarYear() in src/utils/cohortData.ts, which guards the parser
 * for anything that reaches src/data/cohorts/ without passing through here.
 * Keep the two in step.
 */
// Only a group that LOOKS like a year is judged as one. The ancillary files
// group by metric — `count__Emory`, `cisatracurium_n__Emory` — and must pass
// through untouched; an earlier version of this rule kept only calendar years
// and so proposed emptying every one of them.
const MAX_YEAR = new Date().getFullYear() + 1;
function isShiftedYear(group) {
  const g = group.trim();
  if (!/^\d{4}$/.test(g)) return false;
  const y = parseInt(g, 10);
  return y < 1990 || y > MAX_YEAR;
}

/** Strip date-shifted columns, reporting what went. */
function dropShiftedYears(text, label) {
  const rows = parseCSV(text);
  const header = rows[0];
  const keep = [];
  const dropped = new Set();
  for (let i = 0; i < header.length; i++) {
    const sep = header[i].indexOf('__');
    if (i === 0 || sep === -1) {
      keep.push(i);
      continue;
    }
    const group = header[i].slice(0, sep);
    if (isShiftedYear(group)) dropped.add(group);
    else keep.push(i);
  }
  if (!dropped.size) return text;
  console.log(
    `  dropped ${dropped.size} date-shifted year column-group(s) from ${label} ` +
      `(${[...dropped].sort()[0]}-${[...dropped].sort().pop()})`
  );
  return emitCSV(rows.map((r) => keep.map((i) => r[i] ?? '')));
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

// Ancillary files: destination name -> export basename. Same for every cohort
// that has them; a cohort simply lacking one is reported, not fatal.
const ANCILLARY = {
  'demographic_crosstab_race_ethnicity_sex.csv': 'demographic_crosstab_race_ethnicity_sex.csv',
  'medications_hourly_data.csv': 'medications_hourly_data.csv',
  // sofa_mortality_summary / strobe_counts / upset_data /
  // code_status_combined_summary / mortality_rates / comorbidities_per_1000_*
  // were untracked in Aug 2026:
  // nothing rendered them (their only reader, CohortOutcomes.astro, was never
  // wired up) and several carried literal sub-10 counts, which the tracked,
  // public data must not (the table_ones suppress to "<10"). Re-add here —
  // with n<10 suppression — if an outcomes view ships. The preprocessing
  // repairs (Steps 3-4 in src/data/processing.md) still run on _aggregated,
  // so the local derivation stays correct in the meantime.
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
    out = dropShiftedYears(raw, job.dest);
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
