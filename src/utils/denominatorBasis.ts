// Recovers, per row, which population the export divided by.
//
// The Charts view cannot reuse the export's `(%)` text. Filtering to a subset
// of sites or years means pooling, and percentages do not pool — you have to
// sum numerators and sum denominators and divide once. So the chart recomputes.
//
// To recompute correctly it has to know what to divide BY, and that is not the
// same population for every row. The export denominates
// `Propofol (during IMV)` on ventilated patients, `Extubation failure ≤48hr`
// on extubated patients, race and sex on unique patients, and most other rows
// on all hospitalizations. A chart that assumes one denominator for everything
// reports 9.0% where the table says 39.2% — same row, same data, no indication
// that the two numbers are answering different questions.
//
// Rather than maintain a list of which row divides by what — the kind of list
// that goes stale the next time the export adds a row, which is exactly how the
// missing-denominator bug happened — this back-solves it from the export's own
// arithmetic. Each `n (%)` cell is a statement: this count over some population
// gives this percentage. Test every candidate row against that statement at
// every site; the population that satisfies all of them is the denominator.
//
// It is self-maintaining because the export re-states its own basis in every
// cell it ships. Nothing here needs updating when a row is added or renamed.

import type { ParsedConsortiumData, CharacteristicData } from './csvParser';

/** Cells the export writes when a value is absent or suppressed. */
const NON_NUMERIC = /^\s*(<10|n\/s|-|—|)\s*$/;

/** Leading count of `12,345 (6.7%)` or a bare `12,345`; null for anything else. */
export function cellCount(value: string | undefined): number | null {
  if (typeof value !== 'string' || NON_NUMERIC.test(value)) return null;
  const m = value.match(/^\s*([\d,]+)(?!\.)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

/** The percentage stated inside `12,345 (6.7%)`; null if the cell states none. */
export function cellPercent(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^\s*[\d,]+\s*\(([\d.]+)%\)/);
  if (!m) return null;
  const p = parseFloat(m[1]);
  return isNaN(p) ? null : p;
}

/**
 * Does `count / denominator` round to the percentage the export printed?
 *
 * The export rounds to one decimal, so a cell reading 39.2% pins the true ratio
 * only to within ±0.05pp. The tolerance is that rounding window plus a hair,
 * which is what makes the test discriminating: at eleven sites, a wrong
 * candidate has to survive eleven independent ±0.05pp windows to be mistaken
 * for the right one.
 */
const TOLERANCE = 0.06;
function reproduces(count: number, denominator: number, stated: number): boolean {
  if (denominator <= 0) return false;
  return Math.abs((count / denominator) * 100 - stated) <= TOLERANCE;
}

/**
 * Preference order when two candidates are indistinguishable in the data.
 *
 * A tie is not a failure and not a coin flip: it means the same population is
 * in the export twice under two names. '28-day VFD (IMV encounters)' carries
 * counts identical to 'Invasive mechanical ventilation' at every site, because
 * it IS the ventilated population, counted again to hang a different measure
 * on. Either divisor yields the same chart; only the label a reader sees
 * differs. So the tie-break is editorial.
 *
 * The cohort-wide denominators come first: a row should fall back to "of all
 * hospitalizations" rather than to whichever incidental row happens to hold the
 * same total. The IMV row is named because it is the population a reader knows;
 * without it the tie resolves by position in the file, and the ventilator-free-
 * days row precedes it in four of the six cohorts and follows it in the other
 * two — so the SAME row would be labelled "% of IMV Hospitalizations" in one
 * cohort and "% of 28-day VFD (IMV encounters)" in the next, off nothing but
 * export ordering.
 *
 * Position in the file is the last resort, and carries no meaning beyond
 * determinism.
 */
const PREFERRED = [
  'N: Encounter blocks',
  'N: Unique patients',
  'Invasive mechanical ventilation, n (%)',
];

export interface BasisOptions {
  /**
   * Rows to leave out of the result. The two re-based respiratory rows divide
   * by a DIFFERENCE of rows (IMV less pre-admit IMV), which no single candidate
   * can express; the client holds that basis explicitly in REBASED_BASIS and
   * must keep using it.
   */
  skip?: string[];
  /**
   * Sites that must agree before a candidate is accepted. Below this the
   * evidence is too thin to distinguish populations — a row reported by two
   * sites at 0.1% is satisfied by half the table — and the caller's existing
   * default is the safer answer.
   */
  minSites?: number;
  /**
   * Let a row with no evidence of its own take its group's denominator
   * (default true). These entries are a judgement rather than a measurement:
   * they are not verified against the row's own percentage, and for a pooled
   * row like 'Race: Other' — whose stated percentage is the sum of its parts'
   * rounded percentages — they will not reproduce it exactly. Pass false to
   * get only what the arithmetic proved.
   */
  inherit?: boolean;
}

/**
 * Every row that could serve as a denominator, with its per-site totals.
 * A median row ('66 [54, 76]') is not a population count, so it never qualifies.
 */
function candidates(parsed: ParsedConsortiumData): CharacteristicData[] {
  return parsed.characteristics.filter((c) => {
    for (const years of c.sites.values()) {
      const v = years.get('Overall');
      if (v && v.includes('[')) return false;
      if (cellCount(v) != null) return true;
    }
    return false;
  });
}

/**
 * Map of `n (%)` row name -> the row name the export divided it by.
 *
 * Rows whose basis cannot be identified are absent from the map, and the caller
 * should keep whatever default it already applies — an absent entry means "no
 * evidence", never "divide by all hospitalizations".
 */
export function inferDenominatorBasis(
  parsed: ParsedConsortiumData,
  options: BasisOptions = {}
): Record<string, string> {
  const skip = new Set((options.skip ?? []).map((s) => s.trim()));
  const minSites = options.minSites ?? 4;
  const pool = candidates(parsed);
  const basis: Record<string, string> = {};

  for (const row of parsed.characteristics) {
    const name = row.variable.trim();
    if (skip.has(name)) continue;

    // The claims this row makes: at site S, `count` of `?` is `stated`%.
    //
    // Real sites only. The consortium aggregate column states a percentage on
    // its own base — a site that does not report race at all is dropped from
    // that row's numerator AND denominator, so 'Race: White' reads 63.3% of
    // 853,000 rather than of the 905,313 unique patients the ALL column holds.
    // Read as evidence it contradicts every candidate, and the row would come
    // back with no basis at all.
    const claims: { site: string; count: number; stated: number }[] = [];
    for (const site of parsed.allSites) {
      const years = row.sites.get(site);
      if (!years) continue;
      const cell = years.get('Overall');
      const count = cellCount(cell);
      const stated = cellPercent(cell);
      // A stated 0.0% pins nothing — every denominator above the count
      // satisfies it — so it is evidence of nothing and is left out.
      if (count == null || stated == null || stated === 0) continue;
      claims.push({ site, count, stated });
    }
    if (claims.length < minSites) continue;

    const survivors = pool.filter((cand) => {
      if (cand.variable.trim() === name) return false;
      let tested = 0;
      for (const claim of claims) {
        const denom = cellCount(cand.sites.get(claim.site)?.get('Overall'));
        // A candidate suppressed at this site cannot be checked here. It is not
        // held against it — but it earns no credit either.
        if (denom == null) continue;
        if (!reproduces(claim.count, denom, claim.stated)) return false;
        tested++;
      }
      return tested >= minSites;
    });

    if (survivors.length === 0) continue;
    const rank = (c: CharacteristicData) => {
      const i = PREFERRED.indexOf(c.variable.trim());
      return i === -1 ? PREFERRED.length : i;
    };
    survivors.sort(
      (a, b) => rank(a) - rank(b) || parsed.characteristics.indexOf(a) - parsed.characteristics.indexOf(b)
    );
    basis[name] = survivors[0].variable.trim();
  }

  return options.inherit === false ? basis : withGroupInheritance(parsed, basis);
}

/**
 * Give a row its group's denominator when it has too little of its own.
 *
 * `First location at IMV start: radiology` is reported by one site at 3.3%. One
 * claim cannot single out a population — far too many candidates satisfy it —
 * so it ends the main pass with no basis and falls back to all
 * hospitalizations, while its ten siblings in the same group resolved to the
 * ventilated population. The chart then draws one bar of a partition against a
 * different denominator from the rest.
 *
 * Sharing a `<Prefix>: ` label is not a naming coincidence: these rows are the
 * categories of one variable, measured over one population. So a row with no
 * evidence inherits its siblings' answer — but only when they are unanimous. A
 * split group means the prefix is not tracking a single population, and the
 * caller's default is the safer answer.
 */
function withGroupInheritance(
  parsed: ParsedConsortiumData,
  basis: Record<string, string>
): Record<string, string> {
  const groupOf = (name: string) => {
    const i = name.indexOf(': ');
    return i > 0 ? name.slice(0, i) : null;
  };

  const votes = new Map<string, Set<string>>();
  for (const [name, denom] of Object.entries(basis)) {
    const group = groupOf(name);
    if (group) (votes.get(group) ?? votes.set(group, new Set()).get(group))!.add(denom);
  }

  for (const row of parsed.characteristics) {
    const name = row.variable.trim();
    if (basis[name]) continue;
    const group = groupOf(name);
    if (!group) continue;
    const agreed = votes.get(group);
    if (agreed?.size === 1) basis[name] = [...agreed][0];
  }

  return basis;
}
