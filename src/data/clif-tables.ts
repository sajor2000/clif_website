/**
 * CLIF table groupings per version: which tables exist and at what maturity.
 * A table's maturity is set by which array it lives in.
 *
 * Single source of truth for:
 *  - the data dictionary pages (src/pages/data-dictionary/data-dictionary-<version>.astro)
 *  - the project run tracker's "tables sites need" picker (/portal/project-runs)
 *
 * The 2.0 data dictionary page still keeps its own arrays inline; 2.0 is not a
 * version project runs can target.
 */

export interface ClifVersionTables {
  beta: string[];
  alpha: string[];
  concept: string[];
  /** Listed by name/description only; schema not yet committed. Not runnable. */
  futureProposed: string[];
}

export const CLIF_TABLES: Record<string, ClifVersionTables> = {
  '2.1': {
    beta: [
      'adt', 'code_status', 'crrt_therapy', 'hospitalization',
      'hospital_diagnosis', 'labs', 'medication_admin_continuous', 'medication_admin_intermittent',
      'microbiology_culture', 'microbiology_susceptibility', 'patient',
      'patient_assessments', 'patient_procedures', 'position', 'respiratory_support', 'vitals',
    ],
    alpha: [],
    concept: [
      'clinical_trial', 'ecmo_mcs', 'intake_output', 'invasive_hemodynamics', 'key_icu_orders', 'medication_orders', 'microbiology_nonculture', 'patient_diagnosis', 'place_based_index',
      'provider', 'therapy_details', 'transfusion',
    ],
    futureProposed: [],
  },
  '3.0': {
    beta: [
      'adt', 'code_status', 'hospitalization',
      'hospital_diagnosis', 'labs', 'medication_admin_continuous', 'medication_admin_intermittent',
      'microbiology_culture', 'microbiology_susceptibility', 'patient',
      'patient_assessments', 'patient_procedures', 'position', 'respiratory_support', 'vitals',
    ],
    alpha: [
      'clinical_notes_facts', 'consult_orders', 'input', 'invasive_hemodynamics', 'mcs',
      'medication_orders', 'microbiology_nonculture', 'misc_icu_orders', 'model_registry', 'output', 'patient_diagnosis', 'renal_replacement_therapy', 'scores',
    ],
    concept: [
      'airway', 'clinical_trial', 'drain', 'ed_encounter', 'line', 'patient_attributes', 'place_based_index',
      'provider', 'radiology', 'transfusion',
    ],
    futureProposed: ['therapy_details', 'validated_diagnosis'],
  },
};

/** CLIF versions a project run can be built on. */
export const PROJECT_RUN_VERSIONS = ['2.1', '3.0'] as const;

/**
 * Tables a project run may require sites to have, grouped by maturity and
 * sorted by name. Future-proposed tables have no schema yet, so they're left out.
 */
export function runnableTableGroups(version: string): { label: string; tables: string[] }[] {
  const v = CLIF_TABLES[version];
  if (!v) return [];
  const sorted = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y));
  return [
    { label: 'Beta', tables: sorted(v.beta) },
    { label: 'Alpha', tables: sorted(v.alpha) },
    { label: 'Concept', tables: sorted(v.concept) },
  ].filter((g) => g.tables.length > 0);
}

/** Every table a run on this version may require, in picker order. */
export function runnableTables(version: string): string[] {
  return runnableTableGroups(version).flatMap((g) => g.tables);
}
