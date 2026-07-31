import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  coverageFor,
  siteCodesFor,
  describeCoverage,
  fieldOfConceptId,
  summarize,
  type McideCoverageData,
} from './mcideCoverage';

const DATA: McideCoverageData = {
  run: { label: 'CLIF TableOne, May 2026', mcide_version: '2.1' },
  sites: ['Emory', 'JHU', 'MIMIC', 'UCMC'],
  measured_fields: ['labs.lab_category', 'vitals.vital_category'],
  coverage: {
    'labs.lab_category.sodium': [0, 1, 2, 3],
    'labs.lab_category.ferritin': [1],
    'vitals.vital_category.heart_rate': [0, 1],
  },
};

describe('concept field recovery', () => {
  it('reads table.field from an id whose value contains dots', () => {
    expect(fieldOfConceptId('labs.lab_category.ratio.1.2')).toBe('labs.lab_category');
  });

  it('yields nothing for a malformed id rather than guessing', () => {
    expect(fieldOfConceptId('labs.lab_category')).toBe('');
    expect(fieldOfConceptId('')).toBe('');
  });
});

describe('coverage states', () => {
  it('names the sites populating a measured value', () => {
    const c = coverageFor(DATA, 'labs.lab_category.sodium');
    expect(c.state).toBe('used');
    expect(c.count).toBe(4);
    expect(c.total).toBe(4);
    expect(c.sites).toEqual([
      'Emory University',
      'Johns Hopkins University',
      'University of Chicago',
      'MIMIC IV',
    ]);
  });

  it('reports a surveyed value no site populates as unused, not missing', () => {
    const c = coverageFor(DATA, 'labs.lab_category.crp');
    expect(c.state).toBe('unused');
    expect(c.count).toBe(0);
    expect(c.total).toBe(4);
  });

  it('separates a field the run never collected from one nobody populates', () => {
    const c = coverageFor(DATA, 'ecmo_mcs.device_category.va_ecmo');
    expect(c.state).toBe('not-measured');
    expect(describeCoverage(c)).toBe('Not measured');
  });

  it('claims nothing about any site for an unresolvable concept', () => {
    expect(coverageFor(DATA, 'nonsense').state).toBe('not-measured');
    expect(coverageFor(null, 'labs.lab_category.sodium').state).toBe('not-measured');
  });

  it('orders site names the way the cohort dashboard does', () => {
    // MIMIC sorts last by SITE_ORDER despite being index 2 in the export.
    expect(siteCodesFor(DATA, 'labs.lab_category.sodium')).toEqual([
      'Emory',
      'JHU',
      'UCMC',
      'MIMIC',
    ]);
  });

  it('describes a partial count against the run total', () => {
    expect(describeCoverage(coverageFor(DATA, 'vitals.vital_category.heart_rate'))).toBe('2 of 4');
  });
});

describe('summary counts', () => {
  it('assigns every concept to exactly one bucket', () => {
    const ids = [
      'labs.lab_category.sodium',
      'labs.lab_category.ferritin',
      'labs.lab_category.crp',
      'ecmo_mcs.device_category.va_ecmo',
    ];
    expect(summarize(DATA, ids)).toEqual({ used: 2, unused: 1, notMeasured: 1 });
  });
});

describe('the shipped coverage file', () => {
  const dir = path.join(process.cwd(), 'public', 'data', 'mcide');
  const coverage: McideCoverageData = JSON.parse(
    fs.readFileSync(path.join(dir, 'mcide_coverage.json'), 'utf8')
  );
  const concepts: { concept_id: string; table_name: string; field_name: string }[] = JSON.parse(
    fs.readFileSync(path.join(dir, 'mcide_concepts.json'), 'utf8')
  );

  it('only carries values that are in the official schema', () => {
    const official = new Set(concepts.map((c) => c.concept_id));
    const strays = Object.keys(coverage.coverage).filter((id) => !official.has(id));
    expect(strays).toEqual([]);
  });

  it('indexes only sites that exist', () => {
    for (const [id, indices] of Object.entries(coverage.coverage)) {
      for (const i of indices) {
        expect(coverage.sites[i], `${id} -> ${i}`).toBeTypeOf('string');
      }
    }
  });

  it('places every mCIDE concept in exactly one state', () => {
    const summary = summarize(
      coverage,
      concepts.map((c) => c.concept_id)
    );
    expect(summary.used + summary.unused + summary.notMeasured).toBe(concepts.length);
    expect(summary.used).toBeGreaterThan(0);
  });

  it('resolves renal replacement therapy, the canary for the rename map', () => {
    // The run exported this as crrt_therapy.crrt_mode_category. If the alias
    // map breaks, these five modes silently become "no site uses this".
    const rrt = concepts.filter((c) => c.table_name === 'renal_replacement_therapy');
    const used = rrt.filter((c) => coverageFor(coverage, c.concept_id).state === 'used');
    expect(used.length).toBeGreaterThan(0);
  });
});
