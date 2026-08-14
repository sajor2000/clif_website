/**
 * Build the Hourly Trends per-cohort payloads (medication + respiratory
 * hourly series, IMV weights) from the tracked cohort CSVs.
 *
 * Extracted from HourlyTrends.astro so the prerendered
 * /api/hourly-data/[cohort].json endpoint and the component share one
 * builder; the client fetches a cohort's payload on first Hourly-tab
 * activation instead of the page inlining ~2.3 MB of JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import { COHORTS, DEFAULT_COHORT, parseCohortCSV, compareSites } from './cohortData';

export const HOURLY_COHORTS = COHORTS.filter((c) => c.hasHourly);

const cohortDir = path.join(process.cwd(), 'src', 'data', 'cohorts');
// Medication categories for grouping
const medicationCategories = {
  'Vasopressors': ['norepinephrine', 'epinephrine', 'phenylephrine', 'vasopressin', 'dopamine'],
  'Sedatives & Analgesics': ['propofol', 'midazolam', 'lorazepam', 'dexmedetomidine', 'fentanyl'],
  'Neuromuscular Blockers': ['vecuronium', 'rocuronium', 'cisatracurium']
};

function readIf(p: string): string | null {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

// New medications headers are metric-first (`<med>_<n|pct>__<Site>`, incl __ALL).
// Rename to the old site-first shape (`<Site>__<med>_<metric>`) so the existing
// client column-reconstruction works unchanged; line values stay in place.
function transformMedications(content: string) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const sites = new Set<string>();
  const meds = new Set<string>();
  const newHeaders = headers.map((h, i) => {
    if (i === 0) return 'hour';
    const m = h.trim().match(/^(.+)_(n|pct)__(.+)$/);
    if (!m) return h;
    const [, med, metric, site] = m;
    if (site !== 'ALL') { sites.add(site); meds.add(med); }
    return `${site}__${med}_${metric}`;
  });
  return { sites: Array.from(sites).sort(compareSites), medications: Array.from(meds).sort(), headers: newHeaders, lines: lines.slice(1) };
}

// New respiratory headers are `<stat>__<Site>` (median/q25/q75). Rename to the old
// `<Site>__<stat>` shape (client only reads `<site>__median`).
function transformRespiratory(content: string) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const sites = new Set<string>();
  const newHeaders = headers.map((h, i) => {
    if (i === 0) return 'hour';
    const m = h.trim().match(/^(.+?)__(.+)$/);
    if (!m) return h;
    const [, stat, site] = m;
    if (site !== 'ALL') sites.add(site);
    return `${site}__${stat}`;
  });
  return { sites: Array.from(sites).sort(compareSites), headers: newHeaders, lines: lines.slice(1) };
}

// Per-site IMV n from the cohort's table_one (weights for the aggregate median line).
function imvWeightsFor(key: string): Record<string, number> {
  const csv = readIf(path.join(cohortDir, key, 'table_one_by_year.csv'));
  const w: Record<string, number> = {};
  if (!csv) return w;
  const parsed = parseCohortCSV(csv);
  const row = parsed.characteristics.find((c) => c.variable.trim() === 'Invasive mechanical ventilation, n (%)');
  if (row) {
    for (const [site, ym] of row.sites) {
      if (site === 'ALL') continue;
      const v = ym.get('Overall') || '';
      const n = parseInt((v.match(/^[\d,]+/)?.[0] || '0').replace(/,/g, ''), 10);
      if (n) w[site] = n;
    }
  }
  return w;
}

function payloadFor(key: string) {
  const meds = transformMedications(fs.readFileSync(path.join(cohortDir, key, 'medications_hourly_data.csv'), 'utf-8'));
  const pcsv = readIf(path.join(cohortDir, key, 'pressure_control_hourly.csv'));
  const tcsv = readIf(path.join(cohortDir, key, 'tidal_volume_hourly.csv'));
  const pressure = pcsv ? transformRespiratory(pcsv) : null;
  const tidal = tcsv ? transformRespiratory(tcsv) : null;
  return {
    medications: { sites: meds.sites, items: meds.medications, headers: meds.headers, lines: meds.lines, categories: medicationCategories },
    pressure_control: pressure ? { sites: pressure.sites, headers: pressure.headers, lines: pressure.lines } : null,
    tidal_volume: tidal ? { sites: tidal.sites, headers: tidal.headers, lines: tidal.lines } : null,
    imvWeights: imvWeightsFor(key),
    hasRespiratory: !!pressure,
  };
}

export type HourlyPayload = ReturnType<typeof payloadFor>;

let cache: { payloads: Record<string, HourlyPayload>; defaultKey: string } | null = null;

/** All hourly cohorts' payloads, built once per process and shared between
 *  the component (SSR shell) and the /api/hourly-data endpoint. */
export function getHourlyData() {
  if (cache) return cache;
  const payloads: Record<string, HourlyPayload> = {};
  for (const c of HOURLY_COHORTS) payloads[c.key] = payloadFor(c.key);
  // overall_ward has no hourly data, so the default is the first hourly cohort.
  const defaultKey = payloads[DEFAULT_COHORT] ? DEFAULT_COHORT : HOURLY_COHORTS[0].key;
  cache = { payloads, defaultKey };
  return cache;
}
