import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV, isShiftedYear, VISIBLE_COHORTS } from './cohortData';

const at = (y: number) => new Date(`${y}-06-15T00:00:00Z`);

describe('isShiftedYear', () => {
  it('rejects the MIMIC de-identification window', () => {
    for (const y of ['2110', '2211', '2105', '2214']) {
      expect(isShiftedYear(y, at(2026)), y).toBe(true);
    }
  });

  it('accepts real years, including the one in progress', () => {
    for (const y of ['1990', '2011', '2022', '2026', '2027']) {
      expect(isShiftedYear(y, at(2026)), y).toBe(false);
    }
  });

  it('passes non-year groups straight through', () => {
    // The ancillary exports group by metric, not by year. Judging those as
    // years and dropping them empties every column — which an earlier version
    // of this rule proposed doing to eleven files.
    for (const g of ['Overall', 'count', 'n_patients', 'cisatracurium_n', 'ci_lower_95', 'std']) {
      expect(isShiftedYear(g, at(2026)), g).toBe(false);
    }
  });

  it('moves with the calendar rather than pinning a year', () => {
    expect(isShiftedYear('2030', at(2026))).toBe(true);
    expect(isShiftedYear('2030', at(2029))).toBe(false);
  });
});

describe('parsed cohort data', () => {
  const parse = (c: string) =>
    parseCohortCSV(
      fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'cohorts', c, 'table_one_by_year.csv'), 'utf-8')
    );

  it('exposes no shifted year to the dashboard', () => {
    for (const cohort of VISIBLE_COHORTS) {
      const p = parse(cohort.key);
      for (const y of p.allYears) {
        expect(isShiftedYear(y), `${cohort.key} exposes ${y}`).toBe(false);
      }
      for (const d of p.siteYearData) {
        expect(isShiftedYear(d.year), `${cohort.key}/${d.site} exposes ${d.year}`).toBe(false);
      }
    }
  });

  it('keeps the site whose years were dropped, in the all-years column', () => {
    const p = parse('overall');
    const enc = p.characteristics.find((c) => c.variable.trim() === 'N: Encounter blocks')!;

    // MIMIC contributes no year column and must still be a site, with its
    // Overall count intact — dropping the columns must not drop the site.
    expect(p.allSites).toContain('MIMIC');
    expect(enc.sites.get('MIMIC')!.get('Overall')).toBe('89,832');

    // The year columns exist for MIMIC — every site gets every column — but
    // carry no value, which is what keeps it off the time axis while leaving
    // its 89,832 hospitalizations in every all-years view.
    const populated = [...enc.sites.get('MIMIC')!.entries()]
      .filter(([year, v]) => year !== 'Overall' && v.trim() !== '');
    expect(populated).toHaveLength(0);

    // A site with real years is unaffected by the drop.
    const upenn = [...enc.sites.get('UPenn')!.entries()]
      .filter(([year, v]) => year !== 'Overall' && v.trim() !== '');
    expect(upenn.length).toBeGreaterThan(5);
  });

  it('carries the widened span the new export added', () => {
    const p = parse('overall');
    const years = p.allYears.filter((y) => /^\d{4}$/.test(y)).sort();
    expect(years[0]).toBe('2011');
    expect(years).toContain('2018');
    expect(years.length).toBeGreaterThan(10);
  });
});
