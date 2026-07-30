import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV, VISIBLE_COHORTS } from './cohortData';
import { applySiteExclusions, excludedSitesFor, SITE_EXCLUSIONS } from './siteExclusions';
import { cellCount, cellPercent } from './denominatorBasis';

const SEPSIS_EVENTS = 'Sepsis events (CDC ASE), n';
const SEPSIS_ENCOUNTERS = 'Encounters with >=1 sepsis event, n (%)';
const ENCOUNTERS = 'N: Encounter blocks';

function parse(cohort: string) {
  return parseCohortCSV(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'cohorts', cohort, 'table_one_by_year.csv'), 'utf-8')
  );
}
const row = (p: ReturnType<typeof parse>, n: string) =>
  p.characteristics.find((c) => c.variable.trim() === n);

describe('site exclusions', () => {
  it('withdraws the site only from the rows it names', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before);

    expect(row(after, SEPSIS_EVENTS)!.sites.has('JHU')).toBe(false);
    expect(row(after, SEPSIS_ENCOUNTERS)!.sites.has('JHU')).toBe(false);
    // Everything else JHU reports is untouched.
    expect(row(after, ENCOUNTERS)!.sites.get('JHU')).toBe(row(before, ENCOUNTERS)!.sites.get('JHU'));
    expect(row(after, 'Expired, n (%)')!.sites.get('JHU')).toBe(
      row(before, 'Expired, n (%)')!.sites.get('JHU')
    );
    expect(before.allSites).toContain('JHU');
  });

  it('takes the site out of the consortium total, not just its own column', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before);

    const allBefore = cellCount(row(before, SEPSIS_EVENTS)!.sites.get('ALL')!.get('Overall'));
    const jhu = cellCount(row(before, SEPSIS_EVENTS)!.sites.get('JHU')!.get('Overall'));
    const allAfter = cellCount(row(after, SEPSIS_EVENTS)!.sites.get('ALL')!.get('Overall'));

    expect(allBefore).toBe(30_470_722);
    expect(jhu).toBe(30_163_122);
    expect(allAfter).toBe(allBefore! - jhu!);
    // And the corrected total is now the sum of the sites still reporting.
    const summed = before.allSites
      .filter((s) => s !== 'JHU')
      .reduce((t, s) => t + (cellCount(row(before, SEPSIS_EVENTS)!.sites.get(s)?.get('Overall')) ?? 0), 0);
    expect(allAfter).toBe(summed);
  });

  it('rebases the aggregate percentage on the population that is left', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before);

    const n = cellCount(row(after, SEPSIS_ENCOUNTERS)!.sites.get('ALL')!.get('Overall'))!;
    const pct = cellPercent(row(after, SEPSIS_ENCOUNTERS)!.sites.get('ALL')!.get('Overall'))!;

    const encAll = cellCount(row(before, ENCOUNTERS)!.sites.get('ALL')!.get('Overall'))!;
    const encJHU = cellCount(row(before, ENCOUNTERS)!.sites.get('JHU')!.get('Overall'))!;

    // Numerator and denominator both lose JHU. Dividing by the uncorrected
    // population would understate the rate by JHU's share of the cohort.
    expect(Math.abs(pct - (n / (encAll - encJHU)) * 100)).toBeLessThan(0.05);
    expect(pct).not.toBeCloseTo((n / encAll) * 100, 1);
  });

  it('drops the site from the per-site-year rows the charts pool over', () => {
    const after = applySiteExclusions(parse('overall'));
    const jhuRows = after.siteYearData.filter((d) => d.site === 'JHU');

    expect(jhuRows.length).toBeGreaterThan(0);
    for (const d of jhuRows) {
      for (const key of d.characteristics.keys()) expect(key).not.toMatch(/sepsis/i);
    }
    // A site that was never excluded keeps its sepsis rows.
    const other = after.siteYearData.find((d) => d.site === 'UCMC')!;
    expect([...other.characteristics.keys()].some((k) => /sepsis/i.test(k))).toBe(true);
  });

  it('applies in every cohort, in every year', () => {
    for (const cohort of VISIBLE_COHORTS) {
      const after = applySiteExclusions(parse(cohort.key));
      const events = row(after, SEPSIS_EVENTS);
      if (!events) continue;
      expect(events.sites.has('JHU'), `${cohort.key} still has JHU`).toBe(false);
      // Every year's total, not only the all-years column.
      for (const [year, cell] of events.sites.get('ALL')!) {
        const n = cellCount(cell);
        expect(n, `${cohort.key}/${year} total is still inflated`).toBeLessThan(1_000_000);
      }
    }
  });

  it('leaves the parse alone when nothing matches', () => {
    const before = parse('overall');
    const after = applySiteExclusions(before, []);
    expect(after).toBe(before);
  });

  it('names the site and the reason, for callers that have to explain it', () => {
    expect(excludedSitesFor(SEPSIS_EVENTS).map((e) => e.site)).toEqual(['JHU']);
    expect(excludedSitesFor('Expired, n (%)')).toHaveLength(0);
    expect(SITE_EXCLUSIONS[0].reason).toMatch(/Johns Hopkins/);
  });
});
