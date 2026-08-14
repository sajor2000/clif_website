/**
 * Build the Data Explorer's per-cohort payloads (charts data, Table view,
 * denominator basis, partial-year flag) from the tracked cohort CSVs.
 *
 * Extracted from InteractiveDashboard.astro so the prerendered
 * /api/cohort-data/[cohort].json endpoint and the component share one
 * builder: the component server-renders only the default cohort's shell,
 * and the client fetches each cohort's payload on demand instead of the
 * page inlining ~10 MB of JSON for every visitor.
 */
import { type ParsedConsortiumData } from './csvParser';
import { parseCohortCSV, COHORTS, AGGREGATE_SITE } from './cohortData';
import { inferDenominatorBasis } from './denominatorBasis';
import { applySiteExclusions } from './siteExclusions';
import { withConsistentPercentages } from './consistentPercentages';
import fs from 'node:fs';
import path from 'node:path';

const cohortDir = path.join(process.cwd(), 'src', 'data', 'cohorts');

// Serialize a ParsedConsortiumData for the Charts view.
function toConsortiumJson(parsed: ParsedConsortiumData) {
  return {
    allSites: parsed.allSites,
    allYears: parsed.allYears,
    characteristics: parsed.characteristics.map((c) => ({
      variable: c.variable,
      sites: Object.fromEntries(
        Array.from(c.sites.entries()).map(([site, yearMap]) => [site, Object.fromEntries(yearMap)])
      ),
    })),
    siteYearData: parsed.siteYearData.map((d) => ({
      site: d.site,
      year: d.year,
      characteristics: Object.fromEntries(d.characteristics),
    })),
  };
}

/**
 * Display-only renames. The CSV name stays the lookup key everywhere — it is
 * how rows are found in the parsed data, how weights and denominators are
 * resolved, and what MISSING_SUPPRESSION keys off — so only rendered text
 * changes. Serialized to the client so the table, the charts and the CSV export
 * all read one map.
 *
 * "Encounter block" is the pipeline's internal term for a hospitalization; the
 * previous export called this row 'N: Hospitalizations', which is also what the
 * public /cohort dashboard shows. `Admission type: na` is that group's
 * missing-value bucket and reads as 'Missing', matching the sibling
 * `First admission location: Missing` row.
 */
export const DISPLAY_RENAMES: Record<string, string> = {
  'N: Encounter blocks': 'N: Hospitalizations',
  'Admission type: na': 'Admission type: Missing',
  // Re-based by withRebasedDenominators — the label has to say so, or two rows
  // in this section silently carry a different denominator from their siblings.
  'Intubated ≤24hr of admission, n (%)': 'Intubated ≤24hr of admission, n (% of IMV)',
  'Reintubation (≥2 IMV episodes), n (%)': 'Reintubation (≥2 IMV episodes), n (% of IMV)',
};
const displayName = (name: string) => DISPLAY_RENAMES[name.trim()] ?? name;

// Derive the Table view (characteristic x site, all-years "Overall" column) from
// the same parse — headers are the site codes plus the ALL consortium aggregate.
function deriveOverall(parsed: ParsedConsortiumData) {
  // Aggregate first, matching the public dashboard's "Consortium Aggregate"
  // leading column; allSites is already in SITE_ORDER.
  const sites = [AGGREGATE_SITE, ...parsed.allSites];

  // Some groups ship as a run of `Prefix: value` children with no header row of
  // their own — Race, Sex, Ethnicity, Admission type, First admission location,
  // First location at IMV start, Initial ventilator mode, Extubation outcome.
  // (Others, like 'Encounter Types', do carry a real header.) Synthesize the
  // missing parent so every indented run reads under a heading. Marked
  // `synthetic` so the CSV export can leave these invented rows out.
  // `characteristic` stays the full CSV name — search, the hidden-row check and
  // the CSV export all key off it. `label` is display-only: under a synthesized
  // header the group prefix is redundant, so 'Race: White' shows as 'White'
  // while still matching a search for "race".
  const rows: { characteristic: string; label?: string; depth: number; values: Record<string, string>; synthetic?: boolean }[] = [];
  const blank = Object.fromEntries(sites.map((s) => [s, '-']));

  // Neither the 07202026 nor the _aggregated export carries the `Years` row the
  // export before them did, so the Table view has no timespan of its own.
  // Derive it from which year columns each site actually populates.
  //
  // The by-year breakout now spans the same years as the Overall aggregate, so
  // this row and the Data Timespan tile agree — they disagreed while the
  // breakout began at 2022 and the tile hardcoded a 2011 start.
  //
  // MIMIC is the exception, and unavoidably so: its dates are shifted for
  // de-identification (see isShiftedYear), so it populates no year column and
  // this row can only read '-' for it, beside a real Overall count.
  const yearCols = parsed.allYears.filter((y) => /^\d{4}$/.test(y)).sort();
  const encRow = parsed.characteristics.find((c) => c.variable.trim() === 'N: Encounter blocks');
  if (encRow && yearCols.length) {
    const span: Record<string, string> = {};
    for (const s of sites) {
      const have = yearCols.filter((y) => {
        const v = encRow.sites.get(s)?.get(y);
        return v != null && v.trim() !== '' && v.trim() !== '-';
      });
      span[s] = have.length ? `${have[0]}-${have[have.length - 1]}` : '-';
    }
    rows.push({ characteristic: 'Years', depth: 0, values: span, synthetic: true });
  }
  let currentGroup: string | null = null;
  let prevName: string | null = null;
  // Header once per group per file. The sub-cohort exports append a few
  // stragglers ('First admission location: psych', 'Initial ventilator mode:
  // volume support', ...) after the medications block instead of merging them
  // with their siblings, which would otherwise emit the same header twice.
  const headed = new Set<string>();

  for (const c of parsed.characteristics) {
    const depth = c.depth ?? 0;
    // `(?:\s|$)` not just ': ' — one row is 'Initial ventilator mode:' with an
    // empty category, and treating it as a non-member would split the run and
    // emit a second header for the rest of the modes.
    const prefixMatch = depth > 0 ? c.variable.match(/^([^:]+):(?:\s|$)/) : null;
    const prefix = prefixMatch ? prefixMatch[1] : null;

    if (prefix !== currentGroup) {
      currentGroup = prefix;
      // `prevName !== prefix` leaves an existing real header alone.
      if (prefix && prevName !== prefix && !headed.has(prefix)) {
        headed.add(prefix);
        rows.push({ characteristic: prefix, depth: Math.max(0, depth - 1), values: { ...blank }, synthetic: true });
      }
    }

    const values: Record<string, string> = {};
    for (const s of sites) {
      const v = c.sites.get(s)?.get('Overall');
      values[s] = v && v !== '' ? v : '-';
    }
    // Drop the prefix once the group has a header. Falls back to the full name
    // when nothing follows the colon ('Initial ventilator mode:' has an empty
    // category) so the row never renders blank. Stripped off the *display* name,
    // so a renamed row ('Admission type: na') shows its new label ('Missing').
    const shown = displayName(c.variable);
    const stripped = prefix && headed.has(prefix) ? shown.slice(prefix.length + 1).trim() : '';
    rows.push({
      characteristic: c.variable,
      label: stripped || undefined,
      depth,
      values,
    });
    prevName = c.variable;
  }

  return { headers: sites, data: rows };
}

/**
 * Give a bare count row a denominator.
 *
 * The export ships a few totals with no denominator at all, while nearly every
 * other row is `n (%)`. Charted per site, a total measures hospital size as
 * much as the thing it counts: UPenn shows 66,877 sepsis events against Emory's
 * 34,305, but per 100 hospitalizations they are 33.8 and 34.0 — the same.
 *
 * The derived row is injected into the parse so every consumer picks it up
 * without knowing about it: sidebar, charts, table and CSV export all read the
 * same structures. The raw count stays, since it is the numerator and real data.
 *
 * Values carry a decimal on purpose — the n < 10 privacy rule exempts
 * non-integers, and a rate is not a patient count.
 */
const SEPSIS_EVENTS = 'Sepsis events (CDC ASE), n';
const SEPSIS_RATE = 'Sepsis events per 100 encounters';
const ENCOUNTERS = 'N: Encounter blocks';

const ICU_EPISODES = 'ICU episodes, total n';
const ICU_HOSPITALIZATIONS = 'Encounters with >=1 ICU episode, n (%)';
const ICU_EPISODE_RATE = 'ICU episodes per ICU hospitalization';

interface RateSpec {
  /** Row name to create. */
  name: string;
  /** Row supplying the numerator; the derived row is placed just after it. */
  numerator: string;
  /** Row supplying the population. */
  denominator: string;
  /** 100 for a per-100 rate, 1 for a mean per unit. */
  scale: number;
  decimals: number;
}

export const RATE_ROWS: RateSpec[] = [
  { name: SEPSIS_RATE, numerator: SEPSIS_EVENTS, denominator: ENCOUNTERS, scale: 100, decimals: 1 },
  // Episodes per ICU hospitalization, not per hospitalization: dividing by the
  // whole cohort would blend how many patients reach an ICU with how many
  // episodes each one has, and the first swamps the second. Against the ICU
  // population it reads as a mean — 1.06 to 1.16 across ten sites, and 1.67 at
  // UCSF, which the raw total hides completely.
  {
    name: ICU_EPISODE_RATE,
    numerator: ICU_EPISODES,
    denominator: ICU_HOSPITALIZATIONS,
    scale: 1,
    decimals: 2,
  },
];

function withRateRows(parsed: ParsedConsortiumData, specs: RateSpec[] = RATE_ROWS): ParsedConsortiumData {
  return specs.reduce(withRateRow, parsed);
}

function withRateRow(parsed: ParsedConsortiumData, spec: RateSpec): ParsedConsortiumData {
  const numerator = parsed.characteristics.find((c) => c.variable.trim() === spec.numerator);
  const denominator = parsed.characteristics.find((c) => c.variable.trim() === spec.denominator);
  if (!numerator || !denominator) return parsed;

  const num = (v: string | undefined) => {
    const m = (v ?? '').match(/^\s*([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  };
  const rate = (e: number, n: number) => ((e / n) * spec.scale).toFixed(spec.decimals);

  const sites = new Map<string, Map<string, string>>();
  const pooled = new Map<string, { e: number; n: number }>();
  for (const [site, yearMap] of numerator.sites) {
    // The consortium rate is pooled from the sites below rather than read off
    // the export's own ALL column. A site withdrawn from these rows (see
    // siteExclusions) has no numerator cell here, and pooling drops its
    // denominator at the same time — reading the ALL column would keep it and
    // understate the rate by that site's whole share of the cohort.
    if (site === AGGREGATE_SITE) continue;
    const out = new Map<string, string>();
    for (const [year, raw] of yearMap) {
      const e = num(raw);
      const n = num(denominator.sites.get(site)?.get(year));
      if (e != null && n) {
        out.set(year, rate(e, n));
        const acc = pooled.get(year) ?? { e: 0, n: 0 };
        acc.e += e;
        acc.n += n;
        pooled.set(year, acc);
      }
    }
    if (out.size) sites.set(site, out);
  }
  if (!sites.size) return parsed;

  const aggregate = new Map<string, string>();
  for (const [year, { e, n }] of pooled) {
    if (n > 0) aggregate.set(year, rate(e, n));
  }
  if (aggregate.size) sites.set(AGGREGATE_SITE, aggregate);

  // Placed directly after the raw count so the two read together.
  const characteristics = [...parsed.characteristics];
  const at = characteristics.indexOf(numerator);
  characteristics.splice(at + 1, 0, { variable: spec.name, sites, depth: numerator.depth ?? 0 });

  const siteYearData = parsed.siteYearData.map((d) => {
    const v = sites.get(d.site)?.get(d.year);
    if (v == null) return d;
    const chars = new Map(d.characteristics);
    chars.set(spec.name, v);
    return { ...d, characteristics: chars };
  });

  return { ...parsed, characteristics, siteYearData };
}

/**
 * Re-base two respiratory rows onto the population that can actually appear in
 * their numerator.
 *
 * The export divides both by N_enc — every hospitalization in the cohort — but
 * neither numerator can come from outside the ventilated population:
 *
 *   Intubated <=24hr   requires an IMV episode AND `pre_admission_imv == 0`
 *                      (extubation_calculator.py:237), so the 95,445 patients
 *                      already ventilated on arrival are excluded from the
 *                      numerator while still sitting in the denominator.
 *   Reintubation       requires >=2 IMV episodes, so it is undefined for
 *                      anyone never ventilated.
 *
 * Against N_enc, "intubated early" reads 4.9% and mostly reports how few of a
 * site's admissions are ever ventilated — case mix, not timing. Re-based it is
 * 26.2%, and comparable across sites. The section already does this for
 * `Extubation failure <=48hr, n (% of extubated)`; these two rows are the
 * stragglers.
 *
 * Rewrites the stated percentage in place, per site and per year, so the table,
 * the CSV export and the charts all read one number. The count is untouched —
 * it is real data — and DISPLAY_RENAMES carries the new denominator into the
 * row label, following the export's own `(% of extubated)` convention.
 *
 * Cells whose numerator or denominator is suppressed or absent are left exactly
 * as the export wrote them: a corrected percentage is not worth inventing a
 * denominator for.
 */
const IMV_ROW = 'Invasive mechanical ventilation, n (%)';
const PRE_ADMIT_IMV_ROW = 'Pre-admit IMV (excluded from time-to-extubation), n (%)';
const REBASED_ROWS: Record<string, { of: string; less?: string }> = {
  'Intubated ≤24hr of admission, n (%)': { of: IMV_ROW, less: PRE_ADMIT_IMV_ROW },
  'Reintubation (≥2 IMV episodes), n (%)': { of: IMV_ROW },
};

function withRebasedDenominators(parsed: ParsedConsortiumData): ParsedConsortiumData {
  const row = (name: string) => parsed.characteristics.find((c) => c.variable.trim() === name);
  const count = (v: string | undefined) => {
    const m = (v ?? '').match(/^\s*([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  };

  const imv = row(IMV_ROW);
  if (!imv) return parsed;

  // site -> year -> corrected cell, so siteYearData can be patched in step two.
  const rewritten = new Map<string, Map<string, string>>();

  for (const [name, basis] of Object.entries(REBASED_ROWS)) {
    const target = row(name);
    if (!target) continue;
    const source = basis.of === IMV_ROW ? imv : row(basis.of);
    if (!source) continue;

    for (const [site, years] of target.sites) {
      for (const [year, raw] of years) {
        const n = count(raw);
        const base = count(source.sites.get(site)?.get(year));
        if (n == null || base == null) continue;
        const exclude = basis.less ? count(row(basis.less)?.sites.get(site)?.get(year)) ?? 0 : 0;
        const denom = base - exclude;
        if (denom <= 0) continue;
        const cell = `${n.toLocaleString()} (${((n / denom) * 100).toFixed(1)}%)`;
        years.set(year, cell);
        ((rewritten.get(name) ?? rewritten.set(name, new Map()).get(name))!).set(`${site} ${year}`, cell);
      }
    }
  }
  if (!rewritten.size) return parsed;

  const siteYearData = parsed.siteYearData.map((d) => {
    let chars: Map<string, string> | null = null;
    for (const [name, cells] of rewritten) {
      const cell = cells.get(`${d.site} ${d.year}`);
      if (cell == null) continue;
      chars ??= new Map(d.characteristics);
      // The parse may hold the row under its untrimmed name.
      const key = [...chars.keys()].find((k) => k.trim() === name) ?? name;
      chars.set(key, cell);
    }
    return chars ? { ...d, characteristics: chars } : d;
  });

  return { ...parsed, siteYearData };
}


/**
 * The year the data drop cuts off in, or null if the last year looks complete.
 *
 * Only ever the LATEST year, and only when it is far below the one before it.
 * The early years are small too — 2011 has 5,726 hospitalizations against a
 * 101,385 median — but for an entirely different reason: one site contributed
 * that year, against ten in 2024. That is site coverage, which the Data
 * Coverage banner and the per-site Years row already speak to, and calling it a
 * partial year would be wrong.
 *
 * Derived rather than written down: the note used to name 2025, which this
 * export shows is complete.
 */
function partialYearOf(parsed: ParsedConsortiumData): string | null {
  const years = parsed.allYears.filter((y) => /^\d{4}$/.test(y)).sort();
  if (years.length < 2) return null;

  const enc = parsed.characteristics.find((c) => c.variable.trim() === 'N: Encounter blocks');
  if (!enc) return null;
  const total = (year: string) => {
    const raw = enc.sites.get(AGGREGATE_SITE)?.get(year);
    const m = (raw ?? '').match(/^\s*([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  };

  const last = years[years.length - 1];
  const previous = total(years[years.length - 2]);
  const latest = total(last);
  if (latest == null || previous == null || previous === 0) return null;

  return latest < previous * 0.6 ? last : null;
}

/** Percentages recomputed to match their own count, reported once per build. */
const percentRewrites: string[] = [];

function loadCohort(key: string) {
  const csv = fs.readFileSync(path.join(cohortDir, key, 'table_one_by_year.csv'), 'utf-8');
  // Exclusions come first: the derived rates are then computed from what
  // survives, for the excluded site and for the consortium alike.
  // Consistency runs last of the value-rewriting steps, so it sees the
  // percentages the re-basing already settled and leaves them alone.
  const consistent = withConsistentPercentages(
    withRebasedDenominators(withRateRows(applySiteExclusions(parseCohortCSV(csv)))),
    { skip: Object.keys(REBASED_ROWS) }
  );
  percentRewrites.push(
    ...consistent.rewrites.map((r) => `${key}: ${r.row} @ ${r.site}/${r.year}  ${r.was} -> ${r.now}`)
  );
  const parsed = consistent.parsed;
  return {
    consortium: toConsortiumJson(parsed),
    overall: deriveOverall(parsed),
    // Which population the export divided each row by, back-solved from its own
    // arithmetic (see denominatorBasis.ts). The Charts view has to recompute
    // percentages in order to pool a filtered subset of sites and years, and
    // without this it divides everything by all hospitalizations — reporting
    // Propofol during IMV at 9.0% where the Table view, reading the export's own
    // cell, says 39.2%. The re-based rows are excluded: their denominator is a
    // difference of two rows, which no single row can express, and the client
    // already carries it in REBASED_BASIS.
    basis: inferDenominatorBasis(parsed, { skip: Object.keys(REBASED_ROWS) }),
    // Null when the last year looks complete; the note then never shows.
    partialYear: partialYearOf(parsed),
    parsed,
  };
}

export type ExplorerPayload = {
  consortium: ReturnType<typeof toConsortiumJson>;
  overall: ReturnType<typeof deriveOverall>;
  basis: Record<string, string>;
  partialYear: string | null;
};

let cache: {
  payloads: Record<string, ExplorerPayload>;
  parsedByKey: Record<string, ParsedConsortiumData>;
} | null = null;

/** All cohorts' payloads, built once per process and shared between the
 *  component (SSR shell) and the /api/cohort-data endpoint. */
export function getExplorerData() {
  if (cache) return cache;
  const payloads: Record<string, ExplorerPayload> = {};
  const parsedByKey: Record<string, ParsedConsortiumData> = {};
  for (const c of COHORTS) {
    const { consortium, overall, basis, partialYear, parsed } = loadCohort(c.key);
    payloads[c.key] = { consortium, overall, basis, partialYear };
    parsedByKey[c.key] = parsed;
  }
  // A rewritten cell is a published number that changed, so say which.
  if (percentRewrites.length) {
    console.info(
      `[cohort] ${percentRewrites.length} percentage(s) recomputed to match ` +
        `their own count:\n  ` +
        percentRewrites.join('\n  ')
    );
  }
  cache = { payloads, parsedByKey };
  return cache;
}
