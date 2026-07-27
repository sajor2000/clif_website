// Cohort data registry + parser for the 07202026 export.
//
// The dashboard is organized around a two-level cohort model:
//   - "Overall"          = all hospitalized patients (overall_ward)
//   - "Critically ill"   = a ventilated/critically-ill aggregate (overall) plus
//                          four illness-type strata (icu, advanced_resp, vaso, deaths)
//
// New-export column convention differs from the legacy files: headers are
//   `<Group>__<Site>`  (double underscore, group/metric first, site last)
// with a consortium aggregate column suffixed `__ALL`. For the by-year table the
// group is a year label (`Overall`, `2022`, ...); for stat tables it is a metric.
// Legacy files were `<site>_<year>` / `<site>__<metric>` (site first) — do NOT
// route new files through src/utils/csvParser.ts's parseConsortiumCSV.

import { parseCSVLine } from './csvLine';
import type { ParsedConsortiumData, CharacteristicData } from './csvParser';

export const AGGREGATE_SITE = 'ALL';

/**
 * Site codes as they appear in the export CSV headers (`<Group>__<Code>`),
 * mapped to the display names used on the public /cohort dashboard, so both
 * dashboards read identically.
 *
 * These are LABELS ONLY. The codes remain the keys everywhere data is looked
 * up (`${site}__${med}`, Map keys, checkbox values) — never substitute a label
 * into a data path.
 */
export const SITE_LABELS: Record<string, string> = {
  ALL: 'Consortium Aggregate',
  Emory: 'Emory University',
  NU: 'Northwestern University',
  OHSU: 'Oregon Health & Science University',
  RUSH: 'Rush University',
  UCSF: 'University of California San Francisco',
  UCMC: 'University of Chicago',
  UMN: 'University of Minnesota',
  UPenn: 'University of Pennsylvania',
  // Sunnybrook Health Sciences Centre. Named "University of Toronto" to match
  // site_details.csv and the public dashboard's existing column.
  Sunnybrook: 'University of Toronto',
  MIMIC: 'MIMIC IV',
};

/**
 * Column order, matching the public dashboard: aggregate first, then sites
 * alphabetically by display name, with MIMIC IV last. Codes not listed here
 * sort after these, alphabetically, so a new site still renders.
 */
export const SITE_ORDER = ['ALL', 'Emory', 'NU', 'OHSU', 'RUSH', 'UCSF', 'UCMC', 'UMN', 'UPenn', 'Sunnybrook', 'MIMIC'];

/** Display name for a site code; unknown codes fall back to the code itself. */
export function siteLabel(code: string): string {
  return SITE_LABELS[code] ?? code;
}

/** Comparator putting site codes in SITE_ORDER, unknown codes last (A–Z). */
export function compareSites(a: string, b: string): number {
  const ia = SITE_ORDER.indexOf(a);
  const ib = SITE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export type CohortGroup = 'overall' | 'critically_ill';

export interface CohortDef {
  /** Stable key = folder name under src/data/cohorts/ */
  key: string;
  /** Human label shown in the picker */
  label: string;
  /** Top-level grouping for the two-level picker */
  group: CohortGroup;
  /** Has a standalone table_one_overall.csv (else derive summary from the by-year Overall block) */
  hasOverallFile: boolean;
  /** Has medications_hourly_data.csv */
  hasHourly: boolean;
  /** Has sofa_mortality_summary.csv */
  hasSofa: boolean;
  /**
   * Withheld from the picker while its numbers are still being verified. The
   * definition and its CSVs stay in place — flip this off to restore it.
   */
  hidden?: boolean;
}

/**
 * Cohort registry. Order here is the order shown in the picker.
 * `nippv_hfnc` is intentionally excluded (per product decision).
 */
export const COHORTS: CohortDef[] = [
  {
    key: 'overall_ward',
    label: 'Overall',
    group: 'overall',
    hasOverallFile: true,
    hasHourly: false,
    hasSofa: false,
  },
  {
    key: 'overall',
    label: 'Critically Ill',
    group: 'critically_ill',
    hasOverallFile: true,
    hasHourly: true,
    hasSofa: true,
  },
  {
    key: 'icu',
    label: 'ICU',
    group: 'critically_ill',
    hasOverallFile: false,
    hasHourly: true,
    hasSofa: true,
  },
  {
    key: 'advanced_resp',
    label: 'Advanced respiratory support',
    group: 'critically_ill',
    hasOverallFile: false,
    hasHourly: true,
    hasSofa: true,
  },
  {
    key: 'vaso',
    label: 'Vasopressor support',
    group: 'critically_ill',
    hasOverallFile: false,
    hasHourly: true,
    hasSofa: true,
  },
  {
    key: 'deaths',
    label: 'Deaths',
    group: 'critically_ill',
    hasOverallFile: false,
    hasHourly: true,
    hasSofa: true,
  },
];

/** Cohorts offered in the picker. Hidden ones stay in COHORTS so getCohort()
 *  still resolves them for any data that references them directly. */
export const VISIBLE_COHORTS = COHORTS.filter((c) => !c.hidden);

/** Groups still represented by at least one visible cohort, in registry order. */
export const VISIBLE_GROUPS = VISIBLE_COHORTS.reduce<CohortGroup[]>((acc, c) => {
  if (!acc.includes(c.group)) acc.push(c.group);
  return acc;
}, []);

// Must be a visible cohort — it is what the page renders before any interaction.
export const DEFAULT_COHORT = 'overall';

export function getCohort(key: string): CohortDef {
  return COHORTS.find((c) => c.key === key) ?? COHORTS[0];
}

/**
 * Sub-cohorts: ICU / non-ICU splits of advanced_resp & vaso.
 * They only have Summary + Outcomes-worth of data (table_one comparison columns,
 * comorbidities, demographics, partial SOFA) — NOT by-year / hourly / distributions,
 * so the Explorer/Hourly/Distributions tabs fall back to the parent cohort.
 * Key convention: `<parent>__<group>` (helpers split on `__`).
 */
export interface SubCohortDef {
  key: string;
  label: string;
  parent: string;
  group: string;
}
export const SUBCOHORTS: SubCohortDef[] = [
  { key: 'advanced_resp__icu', label: 'ICU', parent: 'advanced_resp', group: 'icu' },
  { key: 'advanced_resp__no_icu', label: 'Non-ICU', parent: 'advanced_resp', group: 'no_icu' },
  { key: 'vaso__icu', label: 'ICU', parent: 'vaso', group: 'icu' },
  { key: 'vaso__no_icu', label: 'Non-ICU', parent: 'vaso', group: 'no_icu' },
];

/** Sub-cohorts belonging to a parent cohort (empty if the cohort has no splits). */
export function subsFor(parent: string): SubCohortDef[] {
  return SUBCOHORTS.filter((s) => s.parent === parent);
}

/** All cohort keys that own a Summary/Outcomes panel (base cohorts + sub-cohorts).
 *  Hidden cohorts are excluded — no picker entry means no panel to reach. */
export const PANEL_COHORTS = [
  ...VISIBLE_COHORTS.map((c) => c.key),
  ...SUBCOHORTS.filter((s) => VISIBLE_COHORTS.some((c) => c.key === s.parent)).map((s) => s.key),
];

/**
 * Parse a new-export table whose columns are `<Group>__<Site>` (+ `__ALL`).
 *
 * Returns the same ParsedConsortiumData shape the InteractiveDashboard already
 * consumes, so it is a drop-in for parseConsortiumCSV — but with the site/year
 * axes read from the new metric-first convention:
 *   - `site`  = the token after the final `__`  (e.g. Emory, UMN, ALL)
 *   - `year`  = the token(s) before it           (e.g. Overall, 2022)
 *
 * The `ALL` aggregate is kept in `characteristics` (so callers can read the
 * consortium value) but excluded from `allSites` and from `siteYearData` so it
 * never double-counts in per-site rollups. `Overall` year columns are likewise
 * excluded from `siteYearData` (they are per-site all-years aggregates).
 */
export function parseCohortCSV(csvContent: string): ParsedConsortiumData {
  const lines = csvContent.trim().split('\n');
  const headers = parseCSVLine(lines[0]);

  const allSitesSet = new Set<string>();
  const allYearsSet = new Set<string>();
  const siteYearMap = new Map<string, Set<string>>();

  // Column index -> { site, year }; null for unparseable / the Variable column.
  const colMeta: ({ site: string; year: string } | null)[] = headers.map(
    (raw, i) => {
      if (i === 0) return null;
      const header = raw.trim();
      const idx = header.lastIndexOf('__');
      if (idx === -1) return null;
      const year = header.slice(0, idx);
      const site = header.slice(idx + 2);
      if (!site || !year) return null;

      if (site !== AGGREGATE_SITE) {
        allSitesSet.add(site);
        if (year !== 'Overall') allYearsSet.add(year);
        if (!siteYearMap.has(site)) siteYearMap.set(site, new Set());
        siteYearMap.get(site)!.add(year);
      }
      return { site, year };
    }
  );

  const characteristics: CharacteristicData[] = [];

  // The 'Medications during IMV (N=...)' block repeats the medication rows
  // with identical names (only the CSV indentation differs). Trimming would
  // collide them — and the by-site-year maps are keyed by name, so the IMV
  // value would silently overwrite the all-encounters one. Suffix the block's
  // rows to keep every variable name unique.
  let inImvMedBlock = false;

  // Carried across rows so a sibling can inherit the group's indent level.
  let prevPrefix: string | null = null;
  let prevDepth = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const raw = values[0] ?? '';
    let variable = raw.trim();
    if (!variable) continue;

    if (!raw.startsWith(' ')) inImvMedBlock = variable.startsWith('Medications during IMV');
    else if (inImvMedBlock) variable = `${variable} (during IMV)`;

    // The export indents children by two spaces per level (0/2/4/6 in the
    // current files). Keep that as a number before the name is used trimmed,
    // so the table can render the hierarchy the CSV already encodes.
    let depth = Math.floor((raw.length - raw.replace(/^ +/, '').length) / 2);

    // The indent is not applied consistently: 'Race: Other', 'Ethnicity: Other'
    // and 'Sex: Other' sit flush left while every sibling in their group is
    // indented. Siblings share a `<Prefix>: ` label, so when a row repeats the
    // previous row's prefix, it inherits its depth. A no-op wherever the export
    // already indents consistently.
    const prefix = variable.includes(': ') ? variable.slice(0, variable.indexOf(': ')) : null;
    if (prefix && prefix === prevPrefix && depth !== prevDepth) depth = prevDepth;
    prevPrefix = prefix;
    prevDepth = depth;

    const charData: CharacteristicData = { variable, sites: new Map(), depth };

    for (let j = 1; j < headers.length && j < values.length; j++) {
      const meta = colMeta[j];
      if (!meta) continue;
      const value = (values[j] ?? '').trim();
      if (!charData.sites.has(meta.site)) charData.sites.set(meta.site, new Map());
      charData.sites.get(meta.site)!.set(meta.year, value);
    }

    characteristics.push(charData);
  }

  const siteYearData = [];
  for (const [site, years] of siteYearMap) {
    for (const year of years) {
      if (year === 'Overall') continue; // per-site all-years aggregate
      const charMap = new Map<string, string>();
      for (const char of characteristics) {
        const siteData = char.sites.get(site);
        if (siteData?.has(year)) charMap.set(char.variable, siteData.get(year)!);
      }
      siteYearData.push({ site, year, characteristics: charMap });
    }
  }

  return {
    allSites: Array.from(allSitesSet).sort(compareSites),
    allYears: Array.from(allYearsSet).sort(),
    characteristics,
    siteYearData,
  };
}

/**
 * Look up a single characteristic's consortium-aggregate (`__ALL`) value for a
 * given year (default the cohort's all-years `Overall` column).
 */
export function getAggregateValue(
  data: ParsedConsortiumData,
  variable: string,
  year = 'Overall'
): string | null {
  const char = data.characteristics.find((c) => c.variable.trim() === variable.trim());
  const allData = char?.sites.get(AGGREGATE_SITE);
  return allData?.get(year) ?? null;
}
