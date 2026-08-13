// Preprocess the raw aggregation export into the derivation input:
//   src/data/_aggregated_new  ->  src/data/_aggregated
//
//   node scripts/preprocess-aggregated.mjs [--dry-run]
//
// Both directories are gitignored; the refresh scripts
// (refresh-cohort-tableone.mjs, refresh-cohort-ecdf.py) read only the
// processed _aggregated, so nothing raw ever reaches the tracked data.
// The steps applied here are documented in src/data/processing.md — keep
// the two in sync when adding a step.
//
// Every file is copied through unchanged except:
//   - table_one*.csv (all 15: overall, overall_ward, per-stratum, by-year and
//     _vs_ variants), which pass through the STEPS list below;
//   - demographic_crosstab_race_ethnicity_sex.csv (one per cohort), which
//     passes through transformCrosstab().
//
// Cell algebra for folding rows together, per src/data/processing.md:
//   "65,491 (64.9%)" -> count 65491, pct 64.9. Counts sum. The folded
//   percentage is recomputed as count / denominator, where the denominator is
//   back-solved from the group's largest percentage-bearing row in the same
//   column (n*100/p) — summing the components' already-rounded percentages
//   accumulates error (three 0.0% rows can hide a true 0.1%), and the
//   dashboard's denominatorBasis back-solver verifies every stated percentage
//   to ±0.06pp against the export's own arithmetic.
//   "<10" (suppressed) -> contributes 0 (known values only, a lower bound).
//   blank              -> contributes nothing; a cell is emitted blank only
//                         when every component was blank.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src', 'data', '_aggregated_new');
const OUT = join(ROOT, 'src', 'data', '_aggregated');
const DRY = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Cell parsing / emitting
// ---------------------------------------------------------------------------

/** Parse "65,491 (64.9%)" / "193 (0.2%)" / "48" / "<10" / "" into parts. */
function parseCell(cell) {
  const v = cell.trim();
  if (v === '') return { blank: true, n: 0, p: 0 };
  if (v === '<10') return { suppressed: true, n: 0, p: 0 };
  const m = v.match(/^([\d,]+)(?:\s*\(([\d.]+)%\))?$/);
  if (!m) return null; // not a count cell — caller decides what that means
  return {
    n: parseInt(m[1].replace(/,/g, ''), 10),
    p: m[2] !== undefined ? parseFloat(m[2]) : null,
  };
}

const fmtCount = (n) => n.toLocaleString('en-US');

/**
 * Sum a column's cells across the folded rows back into one display cell.
 *
 * `groupCells` are ALL of the group's cells in this column (kept + folded);
 * the one with the largest stated percentage pins the column's denominator
 * (n*100/p), and the folded percentage is recomputed from it. A rounded
 * reference percentage p carries ±0.05pp, so the denominator is off by at
 * most 0.05/p relative — anchoring on the largest p makes that error smaller
 * than the display rounding for every cell it prices.
 */
function foldCells(cells, groupCells, context) {
  const parsed = cells.map((c) => {
    const p = parseCell(c);
    if (p === null) throw new Error(`unparseable cell "${c}" in ${context}`);
    return p;
  });
  if (parsed.every((p) => p.blank)) return '';
  const n = parsed.reduce((s, p) => s + p.n, 0);
  const hasPct = parsed.some((p) => p.p !== null && !p.blank && !p.suppressed);
  if (!hasPct) return fmtCount(n);

  let anchor = null;
  for (const c of groupCells) {
    const p = parseCell(c);
    if (p && p.p != null && p.p > 0 && p.n > 0 && (!anchor || p.p > anchor.p)) anchor = p;
  }
  const pct = anchor
    ? (n / (anchor.n * 100 / anchor.p)) * 100
    : parsed.reduce((s, p) => s + (p.p ?? 0), 0); // no anchor: fall back to summing
  return `${fmtCount(n)} (${pct.toFixed(1)}%)`;
}

// ---------------------------------------------------------------------------
// Row-group folding
// ---------------------------------------------------------------------------

/**
 * Fold a table_one row group: rows are `<prefix><label>`. Pass exactly one of
 *   keep: [...] — every label NOT listed is summed into the `into` row
 *   fold: [...] — only the listed labels are summed into the `into` row
 * (keep-lists for "everything else is noise" rules; fold-lists when the rule
 * names its victims, so an unexpected new label stays visible instead of
 * silently disappearing into `other`).
 *
 * Group rows are collected wherever they appear — the export appends
 * late-discovered labels (Missing, hospice, psych in the `_vs_` files) at
 * the bottom of the sheet rather than into the group's block. All of them
 * are one variable group under the single header, so the rebuilt group
 * (kept rows in original order + one folded row) replaces the block at the
 * first group row's position and the strays are dropped from where they lay.
 */
function foldRowGroup(rows, { matchPrefix, keep, fold, into, file }) {
  if ((keep && fold) || (!keep && !fold)) {
    throw new Error(`pass exactly one of keep/fold for "${matchPrefix}"`);
  }
  // A group row is `<prefix><label>` — including a blank label (the export
  // emits e.g. "Initial ventilator mode: " for an unnamed category; trim()
  // would eat the trailing space, so match against the trimmed prefix too).
  const isGroupRow = (r) => {
    const t = r[0].trim();
    return t.startsWith(matchPrefix) || t === matchPrefix.trimEnd();
  };
  const idx = [];
  rows.forEach((r, i) => {
    if (isGroupRow(r)) idx.push(i);
  });
  if (idx.length === 0) return { rows, folded: 0 };

  const label = (r) => r[0].trim().slice(matchPrefix.length); // '' for blank-label rows
  const indent = rows[idx[0]][0].match(/^\s*/)[0];
  const width = rows[idx[0]].length;

  const shouldFold = keep ? (l) => !keep.includes(l) : (l) => fold.includes(l);
  const keptRows = [];
  const foldRows = [];
  for (const i of idx) {
    (shouldFold(label(rows[i])) ? foldRows : keptRows).push(rows[i]);
  }
  if (foldRows.length === 0) return { rows, folded: 0 };

  const foldedRow = [`${indent}${matchPrefix}${into}`];
  const groupRows = [...keptRows, ...foldRows];
  for (let c = 1; c < width; c++) {
    foldedRow.push(
      foldCells(
        foldRows.map((r) => r[c] ?? ''),
        groupRows.map((r) => r[c] ?? ''),
        `${file} col ${c} "${matchPrefix}${into}"`
      )
    );
  }

  const out = [];
  rows.forEach((r, i) => {
    if (i === idx[0]) {
      out.push(...keptRows, foldedRow);
    } else if (!isGroupRow(r)) {
      out.push(r);
    }
  });
  return { rows: out, folded: foldRows.length };
}

/**
 * Relabel a row group in place: `<oldPrefix><label>` -> `<newPrefix><mapped>`,
 * preserving indentation. Labels absent from `labels` keep their name under
 * the new prefix. Values are untouched — this is a rename, never arithmetic.
 */
function relabelRowGroup(rows, { oldPrefix, newPrefix, labels }) {
  let renamed = 0;
  const out = rows.map((r) => {
    const t = r[0].trim();
    if (!t.startsWith(oldPrefix) && t !== oldPrefix.trimEnd()) return r;
    const indent = r[0].match(/^\s*/)[0];
    const label = t.slice(oldPrefix.length);
    renamed++;
    return [`${indent}${newPrefix}${labels[label] ?? label}`, ...r.slice(1)];
  });
  return { rows: out, renamed };
}

// ---------------------------------------------------------------------------
// Steps — mirror src/data/processing.md. Each gets (rows, file) and returns
// { rows, note }.
// ---------------------------------------------------------------------------

const STEPS = [
  {
    name: 'admission-location: fold tail into other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'First admission location: ',
        keep: ['ed', 'ward', 'icu', 'procedural'],
        into: 'other',
        file,
      });
      return { rows: out, note: folded ? `${folded} location rows -> other` : 'no location rows' };
    },
  },
  {
    name: 'admission-type: fold tail into other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'Admission type: ',
        keep: ['ed', 'osh', 'facility', 'direct'],
        into: 'other',
        file,
      });
      return { rows: out, note: folded ? `${folded} type rows -> other` : 'no type rows' };
    },
  },
  {
    name: 'imv-start-location: fold tail into other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'First location at IMV start: ',
        keep: ['icu', 'ed', 'ward', 'procedural'],
        into: 'other',
        file,
      });
      return { rows: out, note: folded ? `${folded} IMV rows -> other` : 'no IMV rows' };
    },
  },
  {
    name: 'initial-vent-mode: fold tail into other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'Initial ventilator mode: ',
        keep: [
          'assist control-volume control',
          'pressure-regulated volume control',
          'pressure control',
          'pressure support/cpap',
          'simv',
        ],
        into: 'other',
        file,
      });
      return { rows: out, note: folded ? `${folded} vent-mode rows -> other` : 'no vent-mode rows' };
    },
  },
  {
    name: 'extubation-outcome: fold unknown/failed_attempt into other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'Extubation outcome: ',
        fold: ['unknown', 'failed_attempt'],
        into: 'other',
        file,
      });
      return { rows: out, note: folded ? `${folded} extubation rows -> other` : 'no extubation rows' };
    },
  },
  {
    // Runs after the fold above, so `other` is already assembled.
    name: 'extubation-outcome: rename to Terminal IMV outcome',
    apply(rows) {
      const { rows: out, renamed } = relabelRowGroup(rows, {
        oldPrefix: 'Extubation outcome: ',
        newPrefix: 'Terminal IMV outcome: ',
        labels: {
          extubated: 'discharged not on IMV',
          death_on_imv: 'dead',
          discharged_on_imv: 'discharge on IMV',
        },
      });
      return { rows: out, note: renamed ? `${renamed} rows renamed` : 'no extubation rows' };
    },
  },
  {
    // Matches the crosstab treatment (transformCrosstab below): the rare race
    // categories merge into the export's own Other row, so the Race group
    // reads identically in the table_ones and the crosstab. 'Other' itself is
    // in the fold list so the existing row and the tails sum into one row.
    name: 'race: fold tail into Other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'Race: ',
        fold: ['Other', 'american indian or alaska native', 'native hawaiian or other pacific islander', 'unknown'],
        into: 'Other',
        file,
      });
      return { rows: out, note: folded ? `${folded} race rows -> Other` : 'no race rows' };
    },
  },
  {
    // Dropped, not folded — unlike the folds there is no sibling to absorb
    // them. Sex: Other is 190 patients consortium-wide (0.0%);
    // Ethnicity: Other (~11% of encounters) is dropped by product decision —
    // the remaining rows are Non-Hispanic / Hispanic only.
    name: 'demographics: drop Other rows',
    apply(rows) {
      const DROP = ['Sex: Other', 'Ethnicity: Other'];
      const out = rows.filter((r) => !DROP.includes(r[0].trim()));
      const dropped = rows.length - out.length;
      return { rows: out, note: dropped ? `${dropped} Other row(s) dropped` : 'no Other rows' };
    },
  },
];

// ---------------------------------------------------------------------------
// Race x Ethnicity x Sex crosstab (two header rows: ethnicity group over sex;
// last row and column are margins; cells are plain patient counts).
//
// Rules (decided 2026-08-13, see src/data/processing.md):
//   - keep only the Non-Hispanic / Hispanic x Female / Male data columns —
//     the sex "Unknown" sub-columns AND the ethnicity "Unknown" group drop;
//   - fold the race rows American Indian or Alaska Native, Native Hawaiian or
//     Other Pacific Islander, Other, and Unknown into one "Other" row (any
//     unexpected new race label stays visible on its own row);
//   - recompute the Total column and Total row from the surviving cells, so
//     the table stays internally consistent.
// ---------------------------------------------------------------------------

const CROSSTAB_FOLD_RACES = [
  'American Indian or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Other',
  'Unknown',
];

function transformCrosstab(rows, file) {
  const [ethRow, sexRow, ...body] = rows;
  if (!ethRow || !sexRow) throw new Error(`missing header rows in ${file}`);

  const keepCols = [];
  for (let c = 1; c < ethRow.length; c++) {
    const eth = (ethRow[c] ?? '').trim();
    const sex = (sexRow[c] ?? '').trim();
    if ((eth === 'Non-Hispanic' || eth === 'Hispanic') && (sex === 'Female' || sex === 'Male')) {
      keepCols.push(c);
    }
  }
  if (keepCols.length !== 4) {
    throw new Error(`expected 4 ethnicity x sex columns in ${file}, found ${keepCols.length}`);
  }

  const toInt = (v) => {
    const t = (v ?? '').trim();
    if (t === '') return 0;
    const n = parseInt(t.replace(/,/g, ''), 10);
    if (Number.isNaN(n)) throw new Error(`unparseable crosstab cell "${v}" in ${file}`);
    return n;
  };

  const keptRows = [];
  const folded = new Array(keepCols.length).fill(0);
  let sawFold = false;
  for (const r of body) {
    const race = (r[0] ?? '').trim();
    if (race.toLowerCase() === 'total') continue; // recomputed below
    const cells = keepCols.map((c) => toInt(r[c]));
    if (CROSSTAB_FOLD_RACES.includes(race)) {
      cells.forEach((n, i) => { folded[i] += n; });
      sawFold = true;
    } else {
      keptRows.push([race, ...cells]);
    }
  }
  if (sawFold) keptRows.push(['Other', ...folded]);

  const withTotals = keptRows.map((r) => [...r, r.slice(1).reduce((s, n) => s + n, 0)]);
  const totalRow = ['Total'];
  for (let i = 1; i <= keepCols.length + 1; i++) {
    totalRow.push(withTotals.reduce((s, r) => s + r[i], 0));
  }

  const outEth = ['', ...keepCols.map((c) => ethRow[c].trim()), 'Total'];
  const outSex = ['', ...keepCols.map((c) => sexRow[c].trim()), ''];
  return [outEth, outSex, ...withTotals.map((r) => r.map(String)), totalRow.map(String)];
}

// ---------------------------------------------------------------------------
// CSV I/O (RFC-4180 emit, quoting only when required — keeps diffs minimal)
// ---------------------------------------------------------------------------

const emitField = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const emitCSV = (rows) => rows.map((r) => r.map(emitField).join(',')).join('\n') + '\n';

// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(SRC)) {
    console.error(`Raw export not found at ${SRC}`);
    process.exit(1);
  }

  const tableOnes = globSync('**/table_one*.csv', { cwd: SRC }).sort();
  if (tableOnes.length === 0) {
    console.error('No table_one*.csv found in the export — wrong directory?');
    process.exit(1);
  }
  console.log(`${DRY ? '[dry-run] ' : ''}${tableOnes.length} table_one files to process`);

  if (!DRY) {
    rmSync(OUT, { recursive: true, force: true });
    cpSync(SRC, OUT, {
      recursive: true,
      filter: (p) => !p.endsWith('.DS_Store'),
    });
  }

  for (const rel of tableOnes) {
    const raw = readFileSync(join(SRC, rel), 'utf-8');
    let rows = parse(raw, { relax_column_count: true });
    const notes = [];
    for (const step of STEPS) {
      const res = step.apply(rows, rel);
      rows = res.rows;
      notes.push(`${step.name}: ${res.note}`);
    }
    if (!DRY) writeFileSync(join(OUT, rel), emitCSV(rows));
    console.log(`  ${rel}\n    ${notes.join('\n    ')}`);
  }

  const crosstabs = globSync('**/demographic_crosstab_race_ethnicity_sex.csv', { cwd: SRC }).sort();
  console.log(`${DRY ? '[dry-run] ' : ''}${crosstabs.length} crosstab files to process`);
  for (const rel of crosstabs) {
    const raw = readFileSync(join(SRC, rel), 'utf-8');
    const out = transformCrosstab(parse(raw, { relax_column_count: true }), rel);
    if (!DRY) writeFileSync(join(OUT, rel), emitCSV(out));
    console.log(`  ${rel}: ${out.length - 4} race rows + Other, unknown columns dropped, totals recomputed`);
  }

  console.log(DRY ? '\nDry run only — nothing written.' : `\nWrote ${relative(ROOT, OUT)}`);
}

main();
