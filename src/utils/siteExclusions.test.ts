import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV } from './cohortData';
import { applySiteExclusions, excludedSitesFor, SITE_EXCLUSIONS } from './siteExclusions';
import type { SiteExclusion } from './siteExclusions';
import { cellCount, cellPercent } from './denominatorBasis';

const SEPSIS_EVENTS = 'Sepsis events (CDC ASE), n';
const SEPSIS_ENCOUNTERS = 'Encounters with >=1 sepsis event, n (%)';
const ENCOUNTERS = 'N: Encounter blocks';

// No exclusion is currently in force (the JHU sepsis pipeline that motivated
// the machinery was fixed in the 2026-08 export), so the machinery is
// exercised with an injected exclusion over real data — expectations are
// computed from the data, not hard-coded, so a data refresh cannot silently
// invalidate them.
const TEST_EXCLUSIONS: SiteExclusion[] = [
  {
    site: 'UMN',
    matches: (name) => /sepsis/i.test(name),
    reason: 'synthetic exclusion for tests',
  },
];

function parse(cohort: string) {
  return parseCohortCSV(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'cohorts', cohort, 'table_one_by_year.csv'), 'utf-8')
  );
}
const row = (p: ReturnType<typeof parse>, n: string) =>
  p.characteristics.find((c) => c.variable.trim() === n);

describe('site exclusions', () => {
  it('is empty: no exclusion is currently in force', () => {
    expect(SITE_EXCLUSIONS).toHaveLength(0);
    // With nothing declared, the default pass changes nothing.
    const before = parse('overall');
    expect(applySiteExclusions(before)).toBe(before);
  });

  it('withdraws the site only from the rows it names', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before, TEST_EXCLUSIONS);

    expect(row(after, SEPSIS_EVENTS)!.sites.has('UMN')).toBe(false);
    expect(row(after, SEPSIS_ENCOUNTERS)!.sites.has('UMN')).toBe(false);
    // Everything else the site reports is untouched.
    expect(row(after, ENCOUNTERS)!.sites.get('UMN')).toBe(row(before, ENCOUNTERS)!.sites.get('UMN'));
    expect(row(after, 'Expired, n (%)')!.sites.get('UMN')).toBe(
      row(before, 'Expired, n (%)')!.sites.get('UMN')
    );
    expect(before.allSites).toContain('UMN');
  });

  it('takes the site out of the consortium total, not just its own column', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before, TEST_EXCLUSIONS);

    const allBefore = cellCount(row(before, SEPSIS_EVENTS)!.sites.get('ALL')!.get('Overall'))!;
    const umn = cellCount(row(before, SEPSIS_EVENTS)!.sites.get('UMN')!.get('Overall'))!;
    const allAfter = cellCount(row(after, SEPSIS_EVENTS)!.sites.get('ALL')!.get('Overall'));

    expect(umn).toBeGreaterThan(0);
    expect(allAfter).toBe(allBefore - umn);
    // And the corrected total is now the sum of the sites still reporting.
    const summed = before.allSites
      .filter((s) => s !== 'UMN')
      .reduce((t, s) => t + (cellCount(row(before, SEPSIS_EVENTS)!.sites.get(s)?.get('Overall')) ?? 0), 0);
    expect(allAfter).toBe(summed);
  });

  it('rebases the aggregate percentage on the population that is left', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before, TEST_EXCLUSIONS);

    const n = cellCount(row(after, SEPSIS_ENCOUNTERS)!.sites.get('ALL')!.get('Overall'))!;
    const pct = cellPercent(row(after, SEPSIS_ENCOUNTERS)!.sites.get('ALL')!.get('Overall'))!;

    const encAll = cellCount(row(before, ENCOUNTERS)!.sites.get('ALL')!.get('Overall'))!;
    const encUMN = cellCount(row(before, ENCOUNTERS)!.sites.get('UMN')!.get('Overall'))!;

    // Numerator and denominator both lose the site. Dividing by the
    // uncorrected population would understate the rate by its share.
    expect(Math.abs(pct - (n / (encAll - encUMN)) * 100)).toBeLessThan(0.05);
    expect(pct).not.toBeCloseTo((n / encAll) * 100, 1);
  });

  it('drops the site from the per-site-year rows the charts pool over', () => {
    const after = applySiteExclusions(parse('overall'), TEST_EXCLUSIONS);
    const umnRows = after.siteYearData.filter((d) => d.site === 'UMN');

    expect(umnRows.length).toBeGreaterThan(0);
    for (const d of umnRows) {
      for (const key of d.characteristics.keys()) expect(key).not.toMatch(/sepsis/i);
    }
    // A site that was never excluded keeps its sepsis rows.
    const other = after.siteYearData.find((d) => d.site === 'UCMC')!;
    expect([...other.characteristics.keys()].some((k) => /sepsis/i.test(k))).toBe(true);
  });

  it('corrects every year, not only the all-years column', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before, TEST_EXCLUSIONS);
    const eventsBefore = row(before, SEPSIS_EVENTS)!;
    const eventsAfter = row(after, SEPSIS_EVENTS)!;

    let checked = 0;
    for (const [year, cell] of eventsAfter.sites.get('ALL')!) {
      const nAfter = cellCount(cell);
      const nBefore = cellCount(eventsBefore.sites.get('ALL')!.get(year));
      const umn = cellCount(eventsBefore.sites.get('UMN')?.get(year)) ?? 0;
      if (nAfter == null || nBefore == null) continue;
      expect(nAfter, `${year} total not corrected`).toBe(nBefore - umn);
      checked++;
    }
    expect(checked).toBeGreaterThan(1);
  });

  it('leaves the parse alone when nothing matches', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before, []);
    expect(after).toBe(before);
  });

  it('names the site and the reason, for callers that have to explain it', () => {
    expect(excludedSitesFor(SEPSIS_EVENTS, TEST_EXCLUSIONS).map((e) => e.site)).toEqual(['UMN']);
    expect(excludedSitesFor('Expired, n (%)', TEST_EXCLUSIONS)).toHaveLength(0);
    // The default list is consulted when none is passed — and is empty today.
    expect(excludedSitesFor(SEPSIS_EVENTS)).toHaveLength(0);
  });
});
