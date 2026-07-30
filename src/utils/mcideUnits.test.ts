import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { unitFor, isMissingUnit, categoriesFor, LAB_UNITS } from './mcideUnits';

const ECDF = path.join(process.cwd(), 'src', 'data', 'cohort_wip_ecdf');
const COHORTS = ['overall', 'icu', 'advanced_resp', 'vaso', 'deaths'];
const TYPES = ['labs', 'vitals', 'respiratory_support'];

/** Same category recovery the component does: longest known prefix wins. */
function categoryOf(dataType: string, fileBase: string) {
  return categoriesFor(dataType).find((c) => fileBase === c || fileBase.startsWith(`${c}_`)) ?? fileBase;
}

describe('mCIDE units', () => {
  it('never renders a placeholder as a unit', () => {
    for (const junk of ['nan', 'NaN', 'null', 'none', 'N/A', '', '  ', '(no units)']) {
      expect(isMissingUnit(junk), junk).toBe(true);
    }
    expect(isMissingUnit('mg/dL')).toBe(false);
  });

  it('gives every exported parameter a unit, in every cohort', () => {
    const missing: string[] = [];
    for (const cohort of COHORTS) {
      for (const type of TYPES) {
        const dir = path.join(ECDF, cohort, type);
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
          const base = file.replace(/\.csv$/, '');
          const category = categoryOf(type, base);
          // Dimensionless categories are legitimately unit-free.
          if (isMissingUnit(LAB_UNITS[category])) continue;
          if (!unitFor(type, category)) missing.push(`${cohort}/${type}/${base}`);
        }
      }
    }
    expect(missing, `no unit resolved for:\n  ${missing.join('\n  ')}`).toHaveLength(0);
  });

  it('uses the mCIDE spelling, not the export\'s', () => {
    // The export writes these lowercased and inconsistently — 'gm/dl', 'iu/l',
    // 'k/ul', 'k/cumm', '10*3/ul' — all for units mCIDE states once.
    expect(unitFor('labs', 'albumin')).toBe('g/dL');
    expect(unitFor('labs', 'alkaline_phosphatase')).toBe('U/L');
    expect(unitFor('labs', 'basophils_absolute')).toBe('10^3/µL');
    expect(unitFor('labs', 'wbc')).toBe('10^3/µL');
    expect(unitFor('labs', 'bicarbonate')).toBe('mmol/L');
  });

  it('returns nothing for a dimensionless measure', () => {
    // mCIDE says '(no units)' for these; a bracket with a non-unit in it is
    // worse than no bracket.
    expect(unitFor('labs', 'inr')).toBe('');
    expect(unitFor('labs', 'ph_arterial')).toBe('');
  });

  it('covers the vitals and respiratory rows the export leaves as nan', () => {
    for (const c of ['heart_rate', 'sbp', 'dbp', 'map', 'spo2', 'respiratory_rate', 'temp_c']) {
      expect(unitFor('vitals', c), c).toBeTruthy();
    }
    for (const c of ['peep_set', 'fio2_set', 'tidal_volume_obs', 'inspiratory_time_set']) {
      expect(unitFor('respiratory_support', c), c).toBeTruthy();
    }
  });

  it('recovers the category from a filename carrying its unit', () => {
    // The mangled cases: GREEK MU in the filename, and a '_pct' suffix that no
    // pattern matched.
    expect(categoryOf('labs', 'basophils_absolute_10_3_μL')).toBe('basophils_absolute');
    expect(categoryOf('labs', 'basophils_percent_pct')).toBe('basophils_percent');
    expect(categoryOf('labs', 'albumin_g_dL')).toBe('albumin');
    // And the over-stripped ones: these ARE the category, not a suffix.
    expect(categoryOf('vitals', 'temp_c')).toBe('temp_c');
    expect(categoryOf('vitals', 'weight_kg')).toBe('weight_kg');
  });
});
