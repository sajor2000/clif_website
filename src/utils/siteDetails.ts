// Consortium site roster — the one place site_details.csv is read.
//
// The homepage renders the same headline numbers twice (the hero stat chips and
// the consortium map's stat bar). Both used to hardcode them, so a cohort data
// refresh left the two disagreeing. Everything derives from the CSV here
// instead; the per-site hospital/encounter/patient counts in that file are kept
// in sync with src/data/cohorts/overall/table_one_overall.csv.
//
// Build-time only — this reaches for `node:fs` and can never be bundled for the
// browser.
import fs from 'node:fs';
import path from 'node:path';

export interface SiteDetail {
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  /** Whether the site has contributed data yet; false renders as "Coming Soon". */
  dataReady: boolean;
  hospitals: number;
  encounters: number;
  patients: number;
}

/** Minimal RFC-4180 field splitter — site names contain commas inside quotes. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else current += char;
  }
  result.push(current);
  return result;
}

// Coordinates in the CSV use the Unicode minus sign (U+2212), which parseFloat
// does not understand.
const num = (raw: string) => parseFloat(raw.trim().replace(/−/g, '-'));
const count = (raw: string) => (raw.trim() ? parseInt(raw.trim().replace(/,/g, ''), 10) : 0);

export function loadSiteDetails(): SiteDetail[] {
  const csv = fs.readFileSync(
    path.join(process.cwd(), 'src', 'data', 'site_details.csv'),
    'utf-8'
  );
  return csv
    .trim()
    .split('\n')
    .slice(1)
    .map(parseCSVLine)
    .filter((v) => v.length >= 8)
    .map((v) => ({
      name: v[0].trim(),
      location: v[1].trim(),
      latitude: num(v[2]),
      longitude: num(v[3]),
      dataReady: v[4].trim().toLowerCase() === 'yes',
      hospitals: count(v[5]),
      encounters: count(v[6]),
      patients: count(v[7]),
    }));
}

export interface SiteTotals {
  institutions: number;
  activeSites: number;
  upcomingSites: number;
  hospitals: number;
  encounters: number;
  patients: number;
}

export function siteTotals(sites: SiteDetail[] = loadSiteDetails()): SiteTotals {
  return {
    institutions: sites.length,
    activeSites: sites.filter((s) => s.dataReady).length,
    upcomingSites: sites.filter((s) => !s.dataReady).length,
    hospitals: sites.reduce((sum, s) => sum + s.hospitals, 0),
    encounters: sites.reduce((sum, s) => sum + s.encounters, 0),
    patients: sites.reduce((sum, s) => sum + s.patients, 0),
  };
}

/** 915361 -> "915K+", for the hero chips where the exact figure is noise. */
export function abbreviateCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M+`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K+`;
  return String(n);
}
