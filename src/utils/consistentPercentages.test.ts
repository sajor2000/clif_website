import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV, VISIBLE_COHORTS } from './cohortData';
import { withConsistentPercentages } from './consistentPercentages';
import { inferDenominatorBasis, cellCount, cellPercent } from './denominatorBasis';

const REBASED = ['Intubated ≤24hr of admission, n (%)', 'Reintubation (≥2 IMV episodes), n (%)'];

function parse(cohort: string) {
  return parseCohortCSV(
    fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'cohorts', cohort, 'table_one_by_year.csv'), 'utf-8')
  );
}
const row = (p: ReturnType<typeof parse>, n: string) =>
  p.characteristics.find((c) => c.variable.trim() === n);

describe('percentage consistency', () => {
  it('rewrites the cell that contradicts its own count', () => {
    const before = parse('overall');
    const { parsed: after, rewrites } = withConsistentPercentages(before, { skip: REBASED });

    // 5,247 of Emory's 76,757 unique patients is 6.8%, not 7.0%.
    expect(row(before, 'Ethnicity: Other')!.sites.get('Emory')!.get('Overall')).toBe('5,247 (7.0%)');
    expect(row(after, 'Ethnicity: Other')!.sites.get('Emory')!.get('Overall')).toBe('5,247 (6.8%)');

    const r = rewrites.find((x) => x.row === 'Ethnicity: Other' && x.site === 'Emory' && x.year === 'Overall');
    expect(r).toMatchObject({ was: '5,247 (7.0%)', now: '5,247 (6.8%)' });
  });

  it('never touches the count', () => {
    for (const cohort of VISIBLE_COHORTS) {
      const before = parse(cohort.key);
      const { parsed: after, rewrites } = withConsistentPercentages(before, { skip: REBASED });
      for (const r of rewrites) {
        expect(cellCount(r.now), `${cohort.key}: ${r.row}`).toBe(cellCount(r.was));
        expect(cellPercent(r.now)).not.toBe(cellPercent(r.was));
      }
      // Untouched rows come through byte-identical.
      expect(row(after, 'Expired, n (%)')?.sites.get('Emory')?.get('Overall')).toBe(
        row(before, 'Expired, n (%)')?.sites.get('Emory')?.get('Overall')
      );
    }
  });

  it('leaves the consortium column alone — it counts a different population', () => {
    const before = parse('overall');
    const { parsed: after, rewrites } = withConsistentPercentages(before, { skip: REBASED });

    expect(rewrites.every((r) => r.site !== 'ALL')).toBe(true);
    // Race: White reads 63.3% because it is over the sites reporting race
    // (540,228/853,980), not over every unique patient (59.7%). Deliberate.
    expect(row(after, 'Race: White')!.sites.get('ALL')!.get('Overall')).toBe(
      row(before, 'Race: White')!.sites.get('ALL')!.get('Overall')
    );
  });

  it('leaves no self-contradicting per-site cell behind', () => {
    for (const cohort of VISIBLE_COHORTS) {
      const { parsed: after } = withConsistentPercentages(parse(cohort.key), { skip: REBASED });
      const basis = inferDenominatorBasis(after, { skip: REBASED });

      for (const [name, denomName] of Object.entries(basis)) {
        const target = row(after, name)!;
        const denom = row(after, denomName)!;
        for (const site of after.allSites) {
          for (const [year, cell] of target.sites.get(site) ?? []) {
            const n = cellCount(cell);
            const stated = cellPercent(cell);
            const d = cellCount(denom.sites.get(site)?.get(year));
            if (n == null || stated == null || d == null || d <= 0) continue;
            expect(
              Math.abs((n / d) * 100 - stated),
              `${cohort.key}: ${name} @ ${site}/${year} — ${cell}`
            ).toBeLessThanOrEqual(0.06);
          }
        }
      }
    }
  });

  it('corrects the per-site-year view the charts pool over, not only the table', () => {
    const { parsed: after, rewrites } = withConsistentPercentages(parse('overall'), { skip: REBASED });

    // siteYearData holds the individual years only — the all-years column lives
    // in `characteristics` — so check a rewrite the charts can actually reach.
    const r = rewrites.find((x) => x.year !== 'Overall')!;
    expect(r).toBeDefined();

    const d = after.siteYearData.find((x) => x.site === r.site && x.year === r.year)!;
    const key = [...d.characteristics.keys()].find((k) => k.trim() === r.row)!;
    expect(d.characteristics.get(key)).toBe(r.now);
  });

  it('reports every change rather than making it quietly', () => {
    const { rewrites } = withConsistentPercentages(parse('overall'), { skip: REBASED });
    expect(rewrites.length).toBeGreaterThan(0);
    // Only the pooled residual rows need correcting.
    expect([...new Set(rewrites.map((r) => r.row))].every((n) => /: Other$/.test(n))).toBe(true);
    for (const r of rewrites) expect(r.was).not.toBe(r.now);
  });
});
