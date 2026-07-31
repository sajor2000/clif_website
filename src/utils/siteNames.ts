// Site codes, display names, and their order — the one place either is defined.
//
// Extracted from cohortData.ts, which reaches for `node:fs` and so can never be
// bundled for the browser. The mCIDE Explorer names the same institutions on
// the client, and a second copy of this map is a guarantee the two dashboards
// eventually disagree about what to call a site.

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
  JHU: 'Johns Hopkins University',
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
export const SITE_ORDER = [
  'ALL',
  'Emory',
  'JHU',
  'NU',
  'OHSU',
  'RUSH',
  'UCSF',
  'UCMC',
  'UMN',
  'UPenn',
  'Sunnybrook',
  'MIMIC',
];

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
