import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV } from './cohortData';
import { inferDenominatorBasis, cellCount, cellPercent } from './denominatorBasis';

const REBASED = [
  'Intubated ≤24hr of admission, n (%)',
  'Reintubation (≥2 IMV episodes), n (%)',
];

function basisFor(cohort: string) {
  const csv = fs.readFileSync(
    path.join(process.cwd(), 'src', 'data', 'cohorts', cohort, 'table_one_by_year.csv'),
    'utf-8'
  );
  const parsed = parseCohortCSV(csv);
  return { parsed, basis: inferDenominatorBasis(parsed, { skip: REBASED }) };
}

describe('cell parsing', () => {
  it('reads counts and percentages, and refuses non-numeric cells', () => {
    expect(cellCount('9,108 (39.2%)')).toBe(9108);
    expect(cellPercent('9,108 (39.2%)')).toBe(39.2);
    expect(cellCount('100,908')).toBe(100908);
    expect(cellPercent('100,908')).toBeNull();
    expect(cellCount('<10')).toBeNull();
    expect(cellCount('')).toBeNull();
    expect(cellCount('66 [54, 76]')).toBe(66); // a median's leading number
    expect(cellPercent('66 [54, 76]')).toBeNull();
  });
});

describe('inferDenominatorBasis', () => {
  it('recovers the three populations the export actually uses', () => {
    const { basis } = basisFor('overall');

    // Ventilated patients — the case that reads 39.2% in the table and 9.0%
    // in the chart when everything is divided by hospitalizations.
    expect(basis['Propofol (during IMV)']).toBe('Invasive mechanical ventilation, n (%)');
    expect(basis['Vasopressors, n (%) (during IMV)']).toBe('Invasive mechanical ventilation, n (%)');
    expect(basis['IMV outcome: extubated']).toBe('Invasive mechanical ventilation, n (%)');

    // Extubated patients — a population that is itself a percentage row.
    expect(basis['Extubation failure ≤48hr, n (% of extubated)']).toBe('IMV outcome: extubated');

    // Unique patients, not hospitalizations, for demographics.
    expect(basis['Race: White']).toBe('N: Unique patients');
    expect(basis['Sex: Female']).toBe('N: Unique patients');

    // And all hospitalizations for the ordinary rows.
    expect(basis['Expired, n (%)']).toBe('N: Encounter blocks');
    expect(basis['Discharged to hospice, n (%)']).toBe('N: Encounter blocks');
  });

  it('reproduces every stated percentage it claims to have measured', () => {
    for (const cohort of ['overall', 'icu', 'advanced_resp', 'vaso', 'deaths', 'overall_ward']) {
      const { parsed } = basisFor(cohort);
      // Evidence only. Inherited entries are deliberately excluded: they are a
      // judgement about a row too sparse to measure, and a pooled row's stated
      // percentage is a sum of rounded parts that no denominator reproduces.
      const basis = inferDenominatorBasis(parsed, { skip: REBASED, inherit: false });
      const row = (n: string) => parsed.characteristics.find((c) => c.variable.trim() === n);

      let checked = 0;
      for (const [name, denomName] of Object.entries(basis)) {
        const target = row(name)!;
        const denom = row(denomName)!;
        for (const site of parsed.allSites) {
          const cell = target.sites.get(site)?.get('Overall');
          const n = cellCount(cell);
          const stated = cellPercent(cell);
          const d = cellCount(denom.sites.get(site)?.get('Overall'));
          if (n == null || stated == null || d == null || d === 0) continue;
          expect(
            Math.abs((n / d) * 100 - stated),
            `${cohort}: ${name} / ${denomName} @ ${site} — ${cell} vs ${((n / d) * 100).toFixed(1)}%`
          ).toBeLessThanOrEqual(0.06);
          checked++;
        }
      }
      expect(checked, `${cohort}: nothing verified`).toBeGreaterThan(100);
    }
  });

  it('leaves the re-based rows out, since their basis is a difference of rows', () => {
    const { basis } = basisFor('overall');
    for (const name of REBASED) expect(basis[name]).toBeUndefined();
  });

  it('gives a sparse row its group\'s denominator, when the group agrees', () => {
    // The category tails that used to supply sparse rows are folded into
    // `other` at preprocessing time (src/data/processing.md), so the live
    // sparse case is now Ethnicity: Missing in the icu cohort: one site
    // reports it, and a single claim cannot single out a population, so the
    // evidence pass leaves it alone and its siblings carry the answer.
    const { parsed } = basisFor('icu');
    const POP = 'N: Unique patients';
    const sparse = 'Ethnicity: Missing';
    const measured = inferDenominatorBasis(parsed, { skip: REBASED, inherit: false });
    const inherited = inferDenominatorBasis(parsed, { skip: REBASED });

    expect(measured[sparse]).toBeUndefined();
    expect(measured['Ethnicity: Non-Hispanic']).toBe(POP);
    expect(inherited[sparse]).toBe(POP);
  });

  it('claims no basis on evidence too thin to distinguish populations', () => {
    const { parsed } = basisFor('overall');
    // With the bar raised past the site count, nothing can clear it.
    const starved = inferDenominatorBasis(parsed, { skip: REBASED, minSites: 99 });
    expect(Object.keys(starved)).toHaveLength(0);
  });
});
