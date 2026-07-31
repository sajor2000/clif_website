// Reading a concept's site coverage out of the TableOne run.
//
// Three states, not two. A field the run never collected is not the same as a
// field every site declined to populate, and collapsing them would label ~261
// values as unused when nobody was ever asked about them — in exactly the
// governance conversation this data exists to inform. `measured_fields` is what
// separates them: a concept whose field is absent from that list was never
// surveyed; one whose field is present but which carries no coverage entry was
// surveyed and came back empty.
//
// The failure mode here is silent. Every state renders as confident text on a
// public page, so an unresolvable concept resolves to `not-measured` — the one
// state that claims nothing about any site — rather than to a bare "0 of 10".

import { siteLabel, compareSites } from './siteNames';

export interface McideCoverageData {
  run: { label: string; mcide_version: string };
  /** Site codes that contributed to the run, in export order. */
  sites: string[];
  /** `table.field` for every field the run collected. */
  measured_fields: string[];
  /** Concept id -> indices into `sites`. */
  coverage: Record<string, number[]>;
}

export type CoverageState = 'used' | 'unused' | 'not-measured';

export interface ConceptCoverage {
  state: CoverageState;
  /** Display names of the sites populating this value, in dashboard order. */
  sites: string[];
  /** How many sites populate it. Zero unless state is `used`. */
  count: number;
  /** How many sites contributed to the run at all. */
  total: number;
}

/**
 * The `table.field` a concept id belongs to.
 *
 * Ids are `table.field.value`, and the value may itself contain dots, so only
 * the first two segments are taken.
 */
export function fieldOfConceptId(conceptId: string): string {
  const parts = String(conceptId ?? '').split('.');
  return parts.length >= 3 ? `${parts[0]}.${parts[1]}` : '';
}

/**
 * Coverage for one concept.
 *
 * `field` may be passed when the caller already holds the concept record;
 * otherwise it is recovered from the id.
 */
export function coverageFor(
  data: McideCoverageData | null | undefined,
  conceptId: string,
  field?: string
): ConceptCoverage {
  const total = data?.sites.length ?? 0;
  const notMeasured: ConceptCoverage = { state: 'not-measured', sites: [], count: 0, total };

  if (!data) return notMeasured;

  const key = field || fieldOfConceptId(conceptId);
  if (!key || !data.measured_fields.includes(key)) return notMeasured;

  const indices = data.coverage[conceptId];
  if (!indices || indices.length === 0) {
    return { state: 'unused', sites: [], count: 0, total };
  }

  const sites = indices
    .map((i) => data.sites[i])
    .filter((code): code is string => typeof code === 'string')
    .sort(compareSites)
    .map(siteLabel);

  return { state: 'used', sites, count: sites.length, total };
}

/** Short site codes rather than display names, for tight UI like chips. */
export function siteCodesFor(
  data: McideCoverageData | null | undefined,
  conceptId: string,
  field?: string
): string[] {
  if (!data) return [];
  const key = field || fieldOfConceptId(conceptId);
  if (!key || !data.measured_fields.includes(key)) return [];
  return (data.coverage[conceptId] ?? [])
    .map((i) => data.sites[i])
    .filter((code): code is string => typeof code === 'string')
    .sort(compareSites);
}

/** One line for the detail panel and hover tooltip. */
export function describeCoverage(c: ConceptCoverage): string {
  if (c.state === 'not-measured') return 'Not measured';
  return `${c.count} of ${c.total}`;
}

export interface CoverageSummary {
  used: number;
  unused: number;
  notMeasured: number;
}

/** Counts across a set of concepts, for the sidebar stats bar. */
export function summarize(
  data: McideCoverageData | null | undefined,
  conceptIds: string[]
): CoverageSummary {
  const summary: CoverageSummary = { used: 0, unused: 0, notMeasured: 0 };
  for (const id of conceptIds) {
    const state = coverageFor(data, id).state;
    if (state === 'used') summary.used += 1;
    else if (state === 'unused') summary.unused += 1;
    else summary.notMeasured += 1;
  }
  return summary;
}
