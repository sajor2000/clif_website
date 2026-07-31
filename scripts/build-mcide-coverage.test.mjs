import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  tableNameFor,
  categoryColumnsFor,
  resolveField,
  isPopulated,
  NULLISH,
} from './build-mcide-coverage.mjs';

describe('table name recovery', () => {
  it('strips the column names the filename carries', () => {
    expect(
      tableNameFor('labs_lab_name_lab_category_lab_loinc_code_mcide', [
        'lab_name',
        'lab_category',
        'lab_loinc_code',
      ])
    ).toBe('labs');
  });

  it('strips the clif_ prefix, which is not part of a concept id', () => {
    expect(
      tableNameFor('clif_microbiology_culture_organism_name_organism_category_mcide', [
        'organism_name',
        'organism_category',
      ])
    ).toBe('microbiology_culture');
  });

  it('does not let a shorter column eat part of a longer one', () => {
    // Stripping `lab_name` first would leave `labs__category`.
    expect(tableNameFor('labs_lab_name_lab_category_mcide', ['lab_name', 'lab_category'])).toBe(
      'labs'
    );
  });

  it('handles a multi-word table name', () => {
    expect(
      tableNameFor('medication_admin_continuous_med_name_med_category_mcide', [
        'med_name',
        'med_category',
      ])
    ).toBe('medication_admin_continuous');
  });
});

describe('category column detection', () => {
  it('takes the _category columns and leaves the rest', () => {
    expect(categoryColumnsFor(['lab_name', 'lab_category', 'lab_loinc_code', 'N'])).toEqual([
      'lab_category',
    ]);
  });

  it('takes the two graphed fields that do not end in _category', () => {
    expect(
      categoryColumnsFor(['location_name', 'location_category', 'location_type', 'N'])
    ).toEqual(['location_category', 'location_type']);
    expect(
      categoryColumnsFor(['assessment_name', 'assessment_category', 'assessment_group'])
    ).toEqual(['assessment_category', 'assessment_group']);
  });
});

describe('renamed fields', () => {
  it('maps the run’s crrt_therapy onto the schema’s renal_replacement_therapy', () => {
    expect(resolveField('crrt_therapy', 'crrt_mode_category')).toBe(
      'renal_replacement_therapy.mode_category'
    );
  });

  it('leaves unrenamed fields alone', () => {
    expect(resolveField('labs', 'lab_category')).toBe('labs.lab_category');
  });
});

describe('populated cells', () => {
  it('rejects the placeholders sites use for "mapped nothing here"', () => {
    for (const junk of ['', '   ', 'nan', 'NaN', 'n/a', 'null', 'NONE', 'NO_MAPPING']) {
      expect(isPopulated(junk), junk).toBe(false);
    }
    expect(isPopulated(undefined)).toBe(false);
    expect(isPopulated(null)).toBe(false);
  });

  it('keeps values that look like placeholders but are real mCIDE values', () => {
    // Discarding these silently reports a value ten sites populate as one
    // nobody does. `other` is a category in its own right; `Unknown` is a
    // race/ethnicity/sex value; `NA` is a susceptibility result.
    for (const real of ['other', 'Unknown', 'unknown', 'NA', 'na']) {
      expect(isPopulated(real), real).toBe(true);
    }
  });

  it('keeps ordinary category values', () => {
    expect(isPopulated('sodium')).toBe(true);
    expect(isPopulated(' heart_rate ')).toBe(true);
  });

  it('never discards a token the mCIDE itself defines', () => {
    // The guard. A placeholder added to NULLISH that collides with a real
    // value throws that value's usage away everywhere it appears.
    const concepts = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'public', 'data', 'mcide', 'mcide_concepts.json'),
        'utf8'
      )
    );
    const official = new Set(concepts.map((c) => String(c.value).toLowerCase()));
    const collisions = [...NULLISH].filter((token) => official.has(token));
    expect(collisions).toEqual([]);
  });
});
