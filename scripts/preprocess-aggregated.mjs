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
    name: 'extubation-outcome: fold unknown/failed_attempt/discharged_on_imv into other',
    apply(rows, file) {
      const { rows: out, folded } = foldRowGroup(rows, {
        matchPrefix: 'Extubation outcome: ',
        // `discharged_on_imv` folds too (decided 2026-08-14): extubation is
        // inferred from a charting pattern, so that bucket is "survived to
        // discharge with no charted extubation" — mostly charting that simply
        // ended, with true vent-facility discharges an unquantifiable subset.
        // At 21% of IMV hospitalizations it reads as a clinical claim it
        // cannot support, so it joins the documentation buckets in `other`.
        fold: ['unknown', 'failed_attempt', 'discharged_on_imv'],
        into: 'other',
        file,
      });
      return { rows: out, note: folded ? `${folded} extubation rows -> other` : 'no extubation rows' };
    },
  },
  {
    // Runs after the fold above, so `other` is already assembled.
    //
    // The group KEEPS the export's own name — an earlier rename to
    // "Terminal IMV outcome" overclaimed: the status is classified from the
    // first real ventilation episode (extubation_calculator.py:245), so a
    // patient extubated once and later reintubated and dying on the vent
    // still reads `extubated`, and "terminal" it is not.
    name: 'extubation-outcome: honest row labels',
    apply(rows) {
      const { rows: out, renamed } = relabelRowGroup(rows, {
        oldPrefix: 'Extubation outcome: ',
        newPrefix: 'IMV outcome: ',
        labels: {
          death_on_imv: 'died, no extubation recorded',
          // `extubated` keeps the export's own truthful word.
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
  {
    // The export indents the four initial-ventilator-settings medians at the
    // same depth as the `Initial ventilator mode:` categories above them, so
    // the Table view renders them as apparent children of that group (their
    // names carry no `Prefix:` stem, so no header of their own is synthesized).
    // They are standalone first-24h settings rows — de-indent to depth 0, so
    // they read like their neighbour `Time to extubation`.
    name: 'vent-settings: de-indent from under Initial ventilator mode',
    apply(rows) {
      const SETTINGS = [
        'FiO2 (%), median [Q1, Q3]',
        'PEEP (cmH2O), median [Q1, Q3]',
        'Respiratory rate (breaths/min), median [Q1, Q3]',
        'Tidal volume (mL), median [Q1, Q3]',
      ];
      let n = 0;
      const out = rows.map((r) => {
        if (!/^\s/.test(r[0]) || !SETTINGS.includes(r[0].trim())) return r;
        n++;
        return [r[0].trim(), ...r.slice(1)];
      });
      return { rows: out, note: n ? `${n} settings row(s) de-indented` : 'no settings rows' };
    },
  },
  {
    // MIMIC's de-identification shifts dates (~2110-2211). Its own cell keeps
    // the shifted range — that is what MIMIC's data really says — but the
    // consortium min-max must not read "2011-2211", so each __ALL recomputes
    // from the sites whose range starts in the past.
    name: 'years: recompute __ALL without date-shifted sites',
    apply(rows) {
      const header = rows[0];
      const row = rows.find((r) => r[0].trim() === 'Years');
      if (!row) return { rows, note: 'no Years row' };
      const nowYear = new Date().getFullYear();
      const groups = new Map(); // column group -> { sites: [idx...], all: idx }
      header.forEach((h, i) => {
        const m = h.match(/^(.*)__(.*)$/);
        if (!m) return;
        const g = groups.get(m[1]) ?? { sites: [], all: -1 };
        if (m[2] === 'ALL') g.all = i;
        else g.sites.push(i);
        groups.set(m[1], g);
      });
      let recomputed = 0;
      for (const g of groups.values()) {
        if (g.all === -1) continue;
        const spans = g.sites
          .map((i) => (row[i] ?? '').trim().match(/^(\d{4})-(\d{4})$/))
          .filter(Boolean)
          .map((m) => [Number(m[1]), Number(m[2])])
          .filter(([start]) => start <= nowYear);
        if (spans.length === 0) continue;
        row[g.all] = `${Math.min(...spans.map((s) => s[0]))}-${Math.max(...spans.map((s) => s[1]))}`;
        recomputed++;
      }
      return { rows, note: `${recomputed} Years __ALL recomputed` };
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
// Michigan batching repair (decided 2026-08-14, see src/data/processing.md).
// Michigan ran TableOne in batches after OOM failures: their table_one and
// SOFA files cover 2023-2024 only, while their strobe_counts and upset_data
// were computed on the full multi-year database (66,799 critically-ill
// encounter blocks vs table_one's 17,135). The two file families therefore
// describe different cohorts, so Michigan's column is dropped from
// strobe_counts/upset_data (precedent: the deaths cohort omits OHSU/UCMC/UCSF
// the same way) and every __ALL is recomputed from the surviving sites.
//
// Michigan's SOFA rows DO sit on the same 2023-24 denominator as their
// table_one and are kept — but the upstream merge appended them under integer
// score labels ("0") instead of merging with the float-labelled block ("0.0").
// transformSofa canonicalises the score key, merges the split rows, and
// recomputes every __ALL: counts by summing sites, mortality by pooling
// deaths/encounters — which also repairs the pre-existing summed-percentage
// __ALL bug (rates up to 800% in the deaths stratum).
// ---------------------------------------------------------------------------

const DROP_SITES = ['Michigan'];

// Numerator/denominator row pairs for strobe *_pct rows. The __ALL percentage
// is pooled from the recomputed count __ALLs — never summed across sites.
const STROBE_PCT_ROWS = {
  sepsis_incidence_pct: ['sepsis_encounters', '5_all_critically_ill'],
  sepsis_icu_pct: ['sepsis_icu_encounters', '1_icu_encounters'],
  sepsis_advanced_resp_pct: ['sepsis_advanced_resp_encounters', '2_advanced_resp_support_hospitalizations'],
  sepsis_vaso_pct: ['sepsis_vaso_encounters', '3_vasoactive_hospitalizations'],
  sepsis_other_ci_pct: ['sepsis_other_ci_encounters', '4_other_critically_ill'],
};

const cellNum = (v) => {
  const t = (v ?? '').trim();
  if (t === '') return null;
  const n = Number(t.replace(/,/g, ''));
  if (Number.isNaN(n)) throw new Error(`unparseable numeric cell "${v}"`);
  return n;
};

/** Drop the `<prefix>__<site>` columns for DROP_SITES and return the header
 *  indices of the surviving per-site columns and the __ALL column. */
function dropSiteColumns(rows, prefix, file) {
  const header = rows[0];
  // Not every file carries the dropped site (overall_ward's pipeline never
  // included Michigan) — dropping is conditional, recomputing __ALL is not.
  const dropIdx = new Set(
    header.map((h, i) => (DROP_SITES.some((s) => h === `${prefix}__${s}`) ? i : -1)).filter((i) => i >= 0)
  );
  const out = rows.map((r) => r.filter((_, i) => !dropIdx.has(i)));
  const siteIdx = out[0]
    .map((h, i) => (h.startsWith(`${prefix}__`) && h !== `${prefix}__ALL` ? i : -1))
    .filter((i) => i >= 0);
  const allIdx = out[0].indexOf(`${prefix}__ALL`);
  if (allIdx === -1) throw new Error(`no ${prefix}__ALL column in ${file}`);
  return { rows: out, siteIdx, allIdx };
}

function transformStrobe(rows, file) {
  const { rows: out, siteIdx, allIdx } = dropSiteColumns(rows, 'count_value', file);
  const sums = new Map();
  for (const r of out.slice(1)) {
    const name = r[0].trim();
    if (name.endsWith('_pct')) continue;
    const sum = siteIdx.reduce((s, i) => s + (cellNum(r[i]) ?? 0), 0);
    sums.set(name, sum);
    r[allIdx] = String(sum);
  }
  for (const r of out.slice(1)) {
    const name = r[0].trim();
    if (!name.endsWith('_pct')) continue;
    const pair = STROBE_PCT_ROWS[name];
    if (!pair) throw new Error(`no numerator/denominator mapping for strobe row "${name}" in ${file}`);
    const [num, den] = pair.map((n) => {
      if (!sums.has(n)) throw new Error(`strobe row "${n}" (needed by "${name}") missing in ${file}`);
      return sums.get(n);
    });
    r[allIdx] = den > 0 ? ((num / den) * 100).toFixed(1) : '';
  }
  return out;
}

function transformUpset(rows, file) {
  const { rows: out, siteIdx, allIdx } = dropSiteColumns(rows, 'n', file);
  for (const r of out.slice(1)) {
    r[allIdx] = String(siteIdx.reduce((s, i) => s + (cellNum(r[i]) ?? 0), 0));
  }
  return out;
}

const SOFA_COUNT_METRICS = ['total_encounters', 'n_encounters', 'n_deaths'];

function transformSofa(rows, file) {
  const header = rows[0];
  // metric -> { sites: [idx...], all: idx }
  const metrics = new Map();
  for (let c = 1; c < header.length; c++) {
    const m = header[c].match(/^(.*)__([^_].*)$/);
    if (!m) throw new Error(`unrecognised column "${header[c]}" in ${file}`);
    const entry = metrics.get(m[1]) ?? { sites: [], all: -1 };
    if (m[2] === 'ALL') entry.all = c;
    else entry.sites.push(c);
    metrics.set(m[1], entry);
  }
  for (const need of [...SOFA_COUNT_METRICS, 'mortality_rate_percent', 'ci_lower_95', 'ci_upper_95', 'ci_margin_95']) {
    if (!metrics.has(need) || metrics.get(need).all === -1) {
      throw new Error(`metric "${need}" (with __ALL) missing in ${file}`);
    }
  }

  // Merge rows that share a numeric score ("0.0" and "0" are the same row
  // split by the upstream merge; their per-site cells are disjoint).
  const byScore = new Map();
  for (const r of rows.slice(1)) {
    const k = Number(r[0]);
    if (Number.isNaN(k)) throw new Error(`non-numeric sofa_score "${r[0]}" in ${file}`);
    const acc = byScore.get(k);
    if (!acc) {
      byScore.set(k, [...r]);
      continue;
    }
    for (let c = 1; c < header.length; c++) {
      if (header[c].endsWith('__ALL')) continue; // recomputed below
      const a = (acc[c] ?? '').trim();
      const b = (r[c] ?? '').trim();
      if (a !== '' && b !== '' && a !== b) {
        throw new Error(`conflicting values for sofa_score ${k}, column "${header[c]}" in ${file}: "${a}" vs "${b}"`);
      }
      if (a === '') acc[c] = b;
    }
  }

  const out = [header];
  for (const k of [...byScore.keys()].sort((a, b) => a - b)) {
    const r = byScore.get(k);
    r[0] = k.toFixed(1);
    const sums = {};
    for (const name of SOFA_COUNT_METRICS) {
      const { sites, all } = metrics.get(name);
      sums[name] = sites.reduce((s, i) => s + (cellNum(r[i]) ?? 0), 0);
      r[all] = String(sums[name]);
    }
    const p = sums.n_encounters > 0 ? sums.n_deaths / sums.n_encounters : 0;
    const rate = p * 100;
    const margin = sums.n_encounters > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / sums.n_encounters) * 100 : 0;
    r[metrics.get('mortality_rate_percent').all] = rate.toFixed(2);
    r[metrics.get('ci_lower_95').all] = Math.max(0, rate - margin).toFixed(2);
    r[metrics.get('ci_upper_95').all] = Math.min(100, rate + margin).toFixed(2);
    r[metrics.get('ci_margin_95').all] = margin.toFixed(2);
    out.push(r);
  }
  return out;
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

  const special = [
    ['**/strobe_counts.csv', transformStrobe, `dropped ${DROP_SITES.join('/')}, __ALL recomputed (pcts pooled)`],
    ['**/upset_data.csv', transformUpset, `dropped ${DROP_SITES.join('/')}, n__ALL recomputed`],
    ['**/sofa_mortality_summary*.csv', transformSofa, 'split score rows merged, __ALL recomputed (mortality pooled)'],
  ];
  for (const [pattern, transform, note] of special) {
    // Only the roots the cohort refresh consumes — the export also carries a
    // stray single-site tableone/ dir with a different column scheme.
    const files = globSync(pattern, { cwd: SRC })
      .filter((f) => /^(overall|overall_ward|strata)\//.test(f))
      .sort();
    console.log(`${DRY ? '[dry-run] ' : ''}${files.length} ${pattern} files to process`);
    for (const rel of files) {
      const raw = readFileSync(join(SRC, rel), 'utf-8');
      const out = transform(parse(raw, { relax_column_count: true }), rel);
      if (!DRY) writeFileSync(join(OUT, rel), emitCSV(out));
      console.log(`  ${rel}: ${note}`);
    }
  }

  console.log(DRY ? '\nDry run only — nothing written.' : `\nWrote ${relative(ROOT, OUT)}`);
}

main();
