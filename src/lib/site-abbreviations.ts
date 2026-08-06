// Canonical consortium site abbreviations, used by the manuscript tracker to
// render site lists compactly. Stored manuscript data mixes full names and
// abbreviations; display always abbreviates, and the edit form resolves
// abbreviations back to the full site_details names. Unknown tokens (MIMIC,
// Sunnybrook, "All", …) pass through unchanged.
export const SITE_ABBREVIATIONS: Record<string, string> = {
  'Cornell University': 'Cornell',
  'Emory University': 'EU',
  'Harvard University': 'Harvard',
  'Johns Hopkins University': 'JHU',
  'Northwestern University': 'NU',
  'Oregon Health & Science University': 'OHSU',
  'Rush University': 'Rush',
  'University of California San Francisco': 'UCSF',
  'University of Chicago': 'UCMC',
  'University of Colorado': 'UColorado',
  'University of Michigan': 'UMich',
  'University of Minnesota': 'UMMC',
  'University of Pennsylvania': 'UPenn',
  'University of Toronto': 'UToronto',
  'Yale University': 'Yale',
};

const FULL_TO_ABBREV = new Map(
  Object.entries(SITE_ABBREVIATIONS).map(([full, ab]) => [full.toLowerCase(), ab])
);

/** Abbreviate one site name; unknown names are returned trimmed but unchanged. */
export function abbreviateSite(name: string | null | undefined): string {
  const t = String(name ?? '').trim();
  return FULL_TO_ABBREV.get(t.toLowerCase()) ?? t;
}

/** Abbreviate a comma-separated site list for display. */
export function abbreviateSites(raw: string | null | undefined): string {
  return String(raw ?? '')
    .split(',')
    .map((s) => abbreviateSite(s))
    .filter(Boolean)
    .join(', ');
}

/** Lowercased abbreviation -> full site name, for mapping stored data back to form values. */
export function siteAliasMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [full, ab] of Object.entries(SITE_ABBREVIATIONS)) out[ab.toLowerCase()] = full;
  return out;
}
