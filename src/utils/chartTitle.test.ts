/**
 * Guards the chart title against restating the denominator it is about to add.
 *
 * generateCustomChart() strips a row's own count suffix and then appends the
 * population the percentage is of. When the strip pattern missed a suffix, the
 * title said it twice — "Extubation failure ≤48hr, n (% of extubated)
 * (% of extubated) by Year" — because that row names its basis in the suffix
 * while the pattern only knew the bare ', n (%)'.
 *
 * The title builder lives in the client script inside
 * src/components/cohort_wip/InteractiveDashboard.astro and cannot be imported,
 * so it is restated here. Keep the two in step.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCohortCSV, VISIBLE_COHORTS } from './cohortData';

const DISPLAY_RENAMES: Record<string, string> = {
  'N: Encounter blocks': 'N: Hospitalizations',
  'Admission type: na': 'Admission type: Missing',
  'Intubated ≤24hr of admission, n (%)': 'Intubated ≤24hr of admission, n (% of IMV)',
  'Reintubation (≥2 IMV episodes), n (%)': 'Reintubation (≥2 IMV episodes), n (% of IMV)',
};
const displayCharacteristic = (n: string) => DISPLAY_RENAMES[n.trim()] ?? n.trim();

/** Mirror of the title builder's strip step. */
export const stripCountSuffix = (characteristic: string) =>
  displayCharacteristic(characteristic)
    .replace(/,\s*n\s*\(%[^)]*\)/, '')
    .replace(/,\s*n$/, '');

function names(cohort: string) {
  const csv = fs.readFileSync(
    path.join(process.cwd(), 'src', 'data', 'cohorts', cohort, 'table_one_by_year.csv'),
    'utf-8'
  );
  return parseCohortCSV(csv).characteristics.map((c) => c.variable.trim());
}

describe('chart title', () => {
  it('leaves no count suffix for the appended denominator to collide with', () => {
    for (const cohort of VISIBLE_COHORTS) {
      for (const name of names(cohort.key)) {
        const title = stripCountSuffix(name);
        // Only a COUNT suffix must go. 'FiO2 (%), median [Q1, Q3]' wears its
        // (%) as a unit, and a median never has a denominator appended to it.
        expect(title, `${cohort.key}: "${name}" -> "${title}"`).not.toMatch(/,\s*n\s*\(%/);
      }
    }
  });

  it('strips the suffix that names its own basis', () => {
    // The reported case: the row says '(% of extubated)' and the title then
    // appends '(% of extubated)' again.
    expect(stripCountSuffix('Extubation failure ≤48hr, n (% of extubated)')).toBe(
      'Extubation failure ≤48hr'
    );
    expect(stripCountSuffix('Intubated ≤24hr of admission, n (%)')).toBe(
      'Intubated ≤24hr of admission'
    );
  });

  it('keeps a qualifier that follows the suffix', () => {
    // Not anchored to the end — the medication rows carry '(during IMV)' after
    // their count, and it is the only thing distinguishing them from the
    // all-encounters rows of the same name.
    expect(stripCountSuffix('Vasopressors, n (%) (during IMV)')).toBe('Vasopressors (during IMV)');
    expect(stripCountSuffix('Sepsis events (CDC ASE), n')).toBe('Sepsis events (CDC ASE)');
  });

  it('titles the row the way the sidebar labelled it', () => {
    expect(stripCountSuffix('N: Encounter blocks')).toBe('N: Hospitalizations');
    expect(stripCountSuffix('Admission type: na')).toBe('Admission type: Missing');
  });

  it('leaves a row with no count suffix alone', () => {
    expect(stripCountSuffix('Race: White')).toBe('Race: White');
    expect(stripCountSuffix('Charlson Comorbidity Index, median [Q1, Q3]')).toBe(
      'Charlson Comorbidity Index, median [Q1, Q3]'
    );
  });
});
