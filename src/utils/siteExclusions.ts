// Withdrawing one site's numbers from one family of rows.
//
// A site can be a reliable contributor everywhere except one metric. Dropping
// it from the whole cohort would throw away good data; leaving it in lets one
// broken pipeline speak for the consortium. So exclusions are per site AND per
// row, declared here with the reason, and applied to the parsed export before
// anything reads it — so the Explorer's table, its charts, its CSV export and
// the Summary tab all inherit the same decision rather than each re-deriving it.
//
// Removing a site's cells is only half the job. The export ships a consortium
// `__ALL` column that already contains the site, and a reader comparing a
// corrected per-site row against an uncorrected total would find the total
// unexplainable. The aggregate is therefore recomputed, exactly: counts by
// subtraction, and percentages by subtracting from BOTH the numerator and the
// population the row is measured over — a percentage whose numerator loses a
// site but whose denominator does not is understated by that site's entire
// share of the cohort.

import type { ParsedConsortiumData, CharacteristicData } from './csvParser';
import { inferDenominatorBasis, cellCount, cellPercent } from './denominatorBasis';

const AGGREGATE = 'ALL';

export interface SiteExclusion {
  /** Site code as it appears in the export headers (`<Group>__<Code>`). */
  site: string;
  /** Which rows this site is withdrawn from. */
  matches: (rowName: string) => boolean;
  /** Shown to readers wherever the exclusion needs explaining. */
  reason: string;
}

/**
 * The exclusions in force.
 *
 * JHU / sepsis: the export puts JHU at 30,163,122 CDC Adult Sepsis Events
 * against a 25,208 median across the other ten sites — roughly a thousandfold,
 * in every cohort and every year, and enough on its own to make the consortium
 * total 30.5M where the other ten sites sum to 307,600. A count that large is
 * not a case mix, it is a counting error upstream, and left in it dominates
 * every sepsis figure the dashboard reports.
 *
 * Scoped to sepsis rows only: JHU's other data is unaffected, and the site is
 * still counted everywhere else.
 */
export const SITE_EXCLUSIONS: SiteExclusion[] = [
  {
    site: 'JHU',
    matches: (name) => /sepsis/i.test(name),
    reason:
      'Johns Hopkins is excluded from sepsis measures: its Adult Sepsis Event ' +
      'count is roughly a thousandfold above every other site, which is a ' +
      'counting error upstream rather than a difference in case mix.',
  },
];

/** Sites withdrawn from a given row, for callers that need to say so. */
export function excludedSitesFor(
  rowName: string,
  exclusions: SiteExclusion[] = SITE_EXCLUSIONS
): SiteExclusion[] {
  return exclusions.filter((e) => e.matches(rowName.trim()));
}

/** Format a recomputed cell the way the export writes them. */
const asCount = (n: number) => n.toLocaleString('en-US');
const asCountPct = (n: number, pct: number) => `${asCount(n)} (${pct.toFixed(1)}%)`;

/**
 * Apply every exclusion to a parsed export.
 *
 * Returns new structures; the input is not mutated. A row the exclusion touches
 * loses the site's cells entirely — in `characteristics` and in the parallel
 * `siteYearData` — and its consortium cell is recomputed for each year.
 *
 * When the aggregate cannot be recomputed for a year (either side suppressed to
 * '<10', or a percentage row whose population could not be identified), the
 * aggregate cell is BLANKED rather than left standing. An uncorrectable total
 * is not a total: it still contains the site every other cell in the row has
 * dropped, and showing it invites exactly the comparison it would fail.
 */
export function applySiteExclusions(
  parsed: ParsedConsortiumData,
  exclusions: SiteExclusion[] = SITE_EXCLUSIONS
): ParsedConsortiumData {
  const applicable = parsed.characteristics.filter((c) =>
    exclusions.some((e) => e.matches(c.variable.trim()))
  );
  if (!applicable.length) return parsed;

  // Only computed when a percentage row actually needs it — the inference walks
  // every row against every candidate, which is not worth doing for a cohort
  // whose exclusions touch only bare counts.
  let basisCache: Record<string, string> | null = null;
  const basisFor = (rowName: string) => {
    basisCache ??= inferDenominatorBasis(parsed);
    return basisCache[rowName];
  };
  const rowByName = new Map(parsed.characteristics.map((c) => [c.variable.trim(), c]));

  const rewritten = new Map<string, CharacteristicData>();

  for (const row of applicable) {
    const name = row.variable.trim();
    const sites = new Map([...row.sites].map(([s, years]) => [s, new Map(years)]));

    for (const exclusion of exclusions) {
      if (!exclusion.matches(name)) continue;
      const excluded = sites.get(exclusion.site);
      if (!excluded) continue;

      const aggregate = sites.get(AGGREGATE);
      if (aggregate) {
        const denomRow = rowByName.get(basisFor(name) ?? '');
        for (const [year, allCell] of aggregate) {
          const siteCell = excluded.get(year);
          aggregate.set(year, recomputeAggregate(allCell, siteCell, year, denomRow, exclusion.site));
        }
      }

      sites.delete(exclusion.site);
    }

    rewritten.set(name, { ...row, sites });
  }

  const characteristics = parsed.characteristics.map((c) => rewritten.get(c.variable.trim()) ?? c);

  const siteYearData = parsed.siteYearData.map((d) => {
    const drop = exclusions.filter((e) => e.site === d.site);
    if (!drop.length) return d;
    const chars = new Map(d.characteristics);
    let changed = false;
    for (const key of [...chars.keys()]) {
      if (drop.some((e) => e.matches(key.trim()))) {
        chars.delete(key);
        changed = true;
      }
    }
    return changed ? { ...d, characteristics: chars } : d;
  });

  return { ...parsed, characteristics, siteYearData };
}

/**
 * The consortium cell with one site taken back out of it.
 *
 * '' when it cannot be done — see the note on blanking in applySiteExclusions.
 */
function recomputeAggregate(
  allCell: string | undefined,
  siteCell: string | undefined,
  year: string,
  denomRow: CharacteristicData | undefined,
  site: string
): string {
  const allCount = cellCount(allCell);
  const siteCount = cellCount(siteCell);
  // Nothing of the site's in this year's total — leave the total as it stands.
  if (siteCount == null) return allCell ?? '';
  if (allCount == null) return '';

  const remaining = allCount - siteCount;
  if (remaining < 0) return '';

  // A bare count: subtraction is the whole story.
  if (cellPercent(allCell) == null) return asCount(remaining);

  // A percentage: the population it is measured over has to lose the site too.
  const allDenom = cellCount(denomRow?.sites.get(AGGREGATE)?.get(year));
  const siteDenom = cellCount(denomRow?.sites.get(site)?.get(year));
  if (allDenom == null || siteDenom == null) return '';
  const denom = allDenom - siteDenom;
  if (denom <= 0) return '';

  return asCountPct(remaining, (remaining / denom) * 100);
}
