import { describe, it, expect } from 'vitest';
import {
  describeColumns,
  countOf,
  foldRows,
  applyCap,
  conflictNorms,
  summarize,
  permissibleLinks,
  valuesFromCsv,
} from './build-mcide-mappings.mjs';
import { norm, statusFor, isVague } from '../src/utils/mcideMappings.ts';

const DEVICE_COLUMNS = ['device_name', 'device_category', 'N__Cornell', 'N__JHU', 'N__ALL'];

describe('column roles', () => {
  it('finds the name, category, site and extra columns', () => {
    expect(
      describeColumns(['lab_name', 'lab_category', 'lab_loinc_code', 'N__UMN', 'N__ALL'])
    ).toEqual({
      nameCol: 'lab_name',
      catCol: 'lab_category',
      siteCols: ['N__UMN'],
      extras: ['lab_loinc_code'],
    });
  });

  it('reports no mapping for a category-only export', () => {
    const roles = describeColumns(['vital_category', 'N__UMN', 'N__ALL']);
    expect(roles.nameCol).toBeUndefined();
  });
});

describe('counts', () => {
  it('reads the float-formatted exports and treats blanks and nan as zero', () => {
    expect(countOf('1210371.0')).toBe(1210371);
    expect(countOf('')).toBe(0);
    expect(countOf('nan')).toBe(0);
  });
});

describe('norm', () => {
  it('ignores case, punctuation and whitespace runs', () => {
    expect(norm('PROPOFOL  10 MG/ML (WRAPPER)')).toBe('propofol 10 mg ml wrapper');
    expect(norm('propofol 10 mg/ml - wrapper')).toBe('propofol 10 mg ml wrapper');
  });
});

describe('status', () => {
  // Keyed lower-cased → canonical spelling, as readExports builds it.
  const official = new Map([
    ['imv', 'IMV'],
    ['nasal_cannula', 'nasal_cannula'],
  ]);

  it('classifies exact, case-variant, off-schema and unmapped values', () => {
    expect(statusFor('IMV', official)).toBe('valid');
    expect(statusFor('imv', official)).toBe('case_variant');
    expect(statusFor('nasal_cannula', official)).toBe('valid');
    expect(statusFor('Nasal Cannula', official)).toBe('case_variant');
    expect(statusFor('Face Mask', official)).toBe('off_schema');
    expect(statusFor('nan', official)).toBe('unmapped');
  });

  it('is off-schema for a field the mCIDE does not define', () => {
    expect(statusFor('anything', undefined)).toBe('off_schema');
  });
});

describe('vague buckets', () => {
  it('matches catch-all names and anything containing other', () => {
    expect(isVague('other')).toBe(true);
    expect(isVague('other_antibiotic')).toBe(true);
    expect(isVague('unknown')).toBe(true);
    expect(isVague('nan')).toBe(true);
    expect(isVague('norepinephrine')).toBe(false);
    expect(isVague('mother')).toBe(false);
  });
});

describe('folding', () => {
  const official = new Map([['imv', 'imv']]);
  const roles = describeColumns(DEVICE_COLUMNS);

  it('sums site counts across variants of the same (name, category)', () => {
    const field = new Map();
    foldRows(field, [{ device_name: 'Ventilator', device_category: 'imv', N__Cornell: '10.0', N__JHU: '', N__ALL: '10' }], roles, official);
    foldRows(field, [{ device_name: 'Ventilator', device_category: 'imv', N__Cornell: '5.0', N__JHU: '7.0', N__ALL: '12' }], roles, official);
    expect([...field.values()]).toEqual([{ n: 'Ventilator', c: 'imv', s: 'valid', k: { Cornell: 15, JHU: 7 } }]);
  });

  it('keeps the same name under different categories as separate rows', () => {
    const field = new Map();
    foldRows(
      field,
      [
        { device_name: 'Ventilator', device_category: 'imv', N__Cornell: '10.0', N__JHU: '', N__ALL: '10' },
        { device_name: 'Ventilator', device_category: 'IMV', N__Cornell: '', N__JHU: '3.0', N__ALL: '3' },
      ],
      roles,
      official
    );
    expect(field.size).toBe(2);
  });

  it('keeps populated extras and drops nan ones', () => {
    const r = describeColumns(['lab_name', 'lab_category', 'lab_loinc_code', 'N__UMN', 'N__ALL']);
    const field = new Map();
    foldRows(field, [{ lab_name: 'Na', lab_category: 'sodium', lab_loinc_code: '2951-2', N__UMN: '1', N__ALL: '1' }], r, new Map([['sodium', 'sodium']]));
    foldRows(field, [{ lab_name: 'K', lab_category: 'potassium', lab_loinc_code: 'nan', N__UMN: '1', N__ALL: '1' }], r, new Map());
    const rows = [...field.values()];
    expect(rows[0].x).toEqual({ lab_loinc_code: '2951-2' });
    expect(rows[1].x).toBeUndefined();
  });
});

describe('long-tail cap', () => {
  it('keeps rows over the total threshold or in a site top list, and tallies the rest', () => {
    const rows = [
      { n: 'a', c: 'x', s: 'valid', k: { UMN: 100 } },
      { n: 'b', c: 'x', s: 'valid', k: { UMN: 2 } },
      { n: 'c', c: 'x', s: 'valid', k: { UMN: 1, OHSU: 1 } },
      { n: 'd', c: 'x', s: 'valid', k: { OHSU: 3 } },
    ];
    const { rows: kept, tail } = applyCap(rows, { APPLY_ABOVE_ROWS: 3, MIN_TOTAL: 10, TOP_PER_SITE: 1 });
    expect(kept.map((r) => r.n)).toEqual(['a', 'd']);
    expect(tail).toEqual({ UMN: { names: 2, records: 3 }, OHSU: { names: 1, records: 1 } });
  });

  it('leaves a field under the row threshold whole', () => {
    const rows = [{ n: 'a', c: 'x', s: 'valid', k: { UMN: 1 } }];
    expect(applyCap(rows, { APPLY_ABOVE_ROWS: 1, MIN_TOTAL: 10, TOP_PER_SITE: 0 })).toEqual({ rows, tail: {} });
  });
});

describe('conflicts', () => {
  it('flags a name two sites send to different categories, ignoring case differences in the name', () => {
    const rows = [
      { n: 'Ventilator', c: 'imv', s: 'valid', k: { Cornell: 1 } },
      { n: 'VENTILATOR', c: 'IMV', s: 'case_variant', k: { JHU: 1 } },
      { n: 'Nasal cannula', c: 'nasal_cannula', s: 'valid', k: { Cornell: 1, JHU: 1 } },
      { n: 'nan', c: 'nan', s: 'unmapped', k: { Cornell: 1 } },
      { n: 'nan', c: 'other', s: 'valid', k: { JHU: 1 } },
    ];
    const c = conflictNorms(rows);
    expect([...c.keys()]).toEqual(['ventilator']);
    expect([...c.get('ventilator')].sort()).toEqual(['Cornell', 'JHU']);
  });
});

describe('summary', () => {
  it('computes per-site shares, conflicts and vague buckets', () => {
    const doc = {
      table: 'respiratory_support',
      field: 'respiratory_support.device_category',
      nameCol: 'device_name',
      catCol: 'device_category',
      sites: ['Cornell', 'JHU'],
      rows: [
        { n: 'Ventilator', c: 'imv', s: 'valid', k: { Cornell: 60 } },
        { n: 'Ventilator', c: 'IMV', s: 'case_variant', k: { JHU: 30 } },
        { n: 'misc', c: 'other', s: 'valid', k: { Cornell: 40, JHU: 10 } },
        { n: 'nan', c: 'nan', s: 'unmapped', k: { JHU: 60 } },
      ],
      tail: {},
      run: { label: 't', mcide_version: '2.1' },
    };
    const s = summarize(doc);
    expect(s.names).toBe(4);
    expect(s.records).toBe(200);
    expect(s.categories).toBe(3);
    expect(s.conflicts).toBe(1);
    expect(s.share.valid).toBeCloseTo(0.55); // Ventilator→imv 60 + misc→other 50
    expect(s.perSite.Cornell).toEqual({
      names: 2,
      records: 100,
      categories: 2,
      share: { valid: 1, case_variant: 0, off_schema: 0, unmapped: 0 },
      conflicts: 1,
    });
    expect(s.perSite.JHU.share.unmapped).toBeCloseTo(0.6);
    expect(s.vague.map((v) => [v.category, v.records])).toEqual([
      ['(unmapped)', 60],
      ['other', 50],
    ]);
  });
});

describe('permissible-value links', () => {
  it('maps table.column to the CSV its COMMENT links', () => {
    const ddl = `
CREATE TABLE labs (
  lab_name VARCHAR COMMENT '{"description": "raw"}',
  lab_category VARCHAR COMMENT '{"description": "x", "permissible": "[List](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/labs/clif_lab_categories.csv)"}'
);
CREATE TABLE vitals (
  vital_category VARCHAR COMMENT '{"permissible": "[v](https://github.com/clif-consortium/CLIF/blob/3.0/mCIDE/vitals/clif_vitals_categories.csv) "}'
);`;
    expect([...permissibleLinks(ddl)]).toEqual([
      ['labs.lab_category', 'https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/labs/clif_lab_categories.csv'],
      ['vitals.vital_category', 'https://github.com/clif-consortium/CLIF/blob/3.0/mCIDE/vitals/clif_vitals_categories.csv'],
    ]);
  });

  it('reads the value column of a permissible CSV, preferring the field name', () => {
    expect(valuesFromCsv('assessment_category,description,group\nother,"not, classified",other\nrass,,sedation\n', 'assessment_category')).toEqual(['other', 'rass']);
    expect(valuesFromCsv('med_category,med_group\npropofol,sedative\n', 'something_else')).toEqual(['propofol']);
  });
});
