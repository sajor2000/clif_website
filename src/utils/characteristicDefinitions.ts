/**
 * How each dashboard characteristic is actually computed upstream.
 *
 * Every entry is transcribed from the CLIF-TableOne pipeline. `source` names
 * the file it came from so the claim can be re-checked when the pipeline
 * changes — it is NOT rendered to users, who should not need to read code to
 * understand a number. Keep filling it in for the same reason.
 *
 * Keys are the CSV variable names (the lookup key, not the display name).
 * Rows whose name carries a category suffix — `Initial ventilator mode: simv`,
 * `Race: White` — are matched on their `<Prefix>:` stem via PREFIX_DEFINITIONS.
 */
export interface CharacteristicDefinition {
  /** Plain-language definition, one or two sentences. */
  text: string;
  /** Where it is computed, e.g. 'modules/tableone/vfd_calculator.py'. */
  source: string;
}

/** Exact-match definitions, keyed by CSV variable name. */
export const CHARACTERISTIC_DEFINITIONS: Record<string, CharacteristicDefinition> = {
  // The preprocessing folds (scripts/preprocess-aggregated.mjs, documented in
  // src/data/processing.md) collapse each group's rare categories into one
  // `other` row. Each folded row says what it covers; suppressed (<10)
  // component cells contribute 0, so folded counts are lower bounds. Exact
  // keys, so they win over the group's shared prefix definition — which is
  // also what keeps the badge ON these rows while their siblings defer to the
  // group heading.
  'Race: Other': {
    text: 'Includes other race categories like American Indian or Alaska Native, Native Hawaiian, etc.',
    source: 'scripts/preprocess-aggregated.mjs (rule 2i, src/data/processing.md)',
  },
  'First admission location: other': {
    text: 'Includes other admission locations like stepdown, rehab, radiology, labor & delivery, hospice, psych, dialysis, etc.',
    source: 'scripts/preprocess-aggregated.mjs (rule 2a, src/data/processing.md)',
  },
  'Admission type: other': {
    text: 'Includes other admission types like elective admissions.',
    source: 'scripts/preprocess-aggregated.mjs (rule 2b, src/data/processing.md)',
  },
  'First location at IMV start: other': {
    text: 'Includes other locations like stepdown, rehab, radiology, labor & delivery, hospice, dialysis, etc.',
    source: 'scripts/preprocess-aggregated.mjs (rule 2c, src/data/processing.md)',
  },
  'Initial ventilator mode: other': {
    text: 'Includes other ventilator modes like APRV, blow by, volume support, standby, etc.',
    source: 'scripts/preprocess-aggregated.mjs (rule 2d, src/data/processing.md)',
  },
  'IMV outcome: other': {
    text: 'Includes other outcomes like discharges without a charted extubation and failed extubation attempts (IMV episodes under 5 minutes).',
    source: 'scripts/preprocess-aggregated.mjs (rules 2e-2f, src/data/processing.md)',
  },
  'N: Encounter blocks': {
    text: 'One row per hospitalization. Any two hospitalizations where discharge-to-next-admission is 6 hours or less are merged into one hospitalization, so a patient readmitted within 6 hours counts once, not twice.',
    source: 'generator.py:62 (clifpy stitch_encounters, 6-hour window)',
  },
  'N: Unique patients': {
    text: 'Distinct patients behind the hospitalizations.',
    source: 'modules/tableone/generator.py',
  },
  'N: Hospitals': {
    text: 'Hospitals contributing data to this cohort, summed across sites.',
    source: 'modules/tableone/generator.py',
  },

  'ICU episodes, total n': {
    text: 'Total number of separate ICU stays. A new episode begins when the patient passes through ward, stepdown, L&D, hospice, psych, rehab or other between two ICU rows. Lateral ICU-to-ICU transfers and trips to procedural, radiology or dialysis stay within the same episode.',
    source: 'modules/tableone/generator.py:2275 (NEW_EPISODE_LOCS)',
  },
  'ICU episodes per ICU hospitalization': {
    text: 'Mean ICU episodes among hospitalizations that had at least one — so 1.00 means every ICU patient had a single continuous stay, and anything above it reflects patients returning to an ICU after time on a ward or other non-ICU unit. Divided by the ICU population rather than by the whole cohort, which would blend this with how many hospitalizations reach an ICU at all.',
    source: 'derived in InteractiveDashboard.astro (withRateRows)',
  },
  'Encounters with >=1 ICU episode, n (%)': {
    text: 'Hospitalizations with at least one ICU episode, as a share of all hospitalizations in the selected cohort.',
    source: 'modules/tableone/generator.py:2275',
  },

  'Sepsis events (CDC ASE), n': {
    // Says what the CRITERIA require, not what the cohort contains. The
    // previous wording — "computed for every hospitalization in the cohort,
    // NOT only ICU hospitalizations" — is a useful correction under Overall
    // and a contradiction under ICU, where every hospitalization is an ICU one.
    text: 'Total CDC Adult Sepsis Events across the selected cohort. The criteria do not require an ICU stay — sepsis is identified from infection, organ dysfunction and treatment signals wherever they occur — and one hospitalization can contribute more than one event.',
    source: 'modules/tableone/generator.py:4510 (sepsis_events_by_sepsis_col)',
  },
  'Sepsis events per 100 encounters': {
    text: 'Sepsis events divided by all hospitalizations in the cohort.',
    source: 'derived in InteractiveDashboard.astro (withRateRows)',
  },
  'Encounters with >=1 sepsis event, n (%)': {
    text: 'Hospitalizations with at least one CDC Adult Sepsis Event, over all hospitalizations in the selected cohort. The criteria do not require an ICU stay.',
    source: 'modules/tableone/generator.py:4520',
  },

  'Invasive mechanical ventilation, n (%)': {
    text: 'Hospitalizations with any invasive mechanical ventilation observation in the respiratory support data.',
    source: 'modules/tableone/generator.py',
  },
  'Ventilator hours (millions)': {
    text: 'Total invasive ventilation hours summed across every hospitalization in the cohort.',
    source: 'modules/tableone/generator.py:6095',
  },
  'Intubated ≤24hr of admission, n (%)': {
    text: 'Hospitalizations NEWLY intubated within 24 hours of admission — patients already ventilated on arrival are excluded. An intubation charted up to an hour before the admission timestamp still counts, as slack for clock skew. The percentage shown is of ventilated hospitalizations excluding those pre-admit arrivals.',
    source: 'extubation_calculator.py:237 (pre_admission_imv == 0, -1 to 24h of admission); re-based in InteractiveDashboard.astro (withRebasedDenominators)',
  },
  'Reintubation (≥2 IMV episodes), n (%)': {
    text: 'Hospitalizations with two or more separate ventilation episodes. Episodes come from the same timeline detection used for extubation, and any episode shorter than 5 minutes is treated as a failed attempt rather than a real one. The percentage shown is of ventilated hospitalizations, since the measure is undefined for anyone never ventilated.',
    source: 'extubation_calculator.py:166; re-based in InteractiveDashboard.astro (withRebasedDenominators)',
  },
  'Time to extubation (hrs), median [Q1, Q3]': {
    text: 'A patient counts as extubated when two consecutive readings on invasive ventilation are followed by two consecutive readings off it. Requiring two on each side stops a single stray reading registering as an extubation. Patients already ventilated on arrival are excluded, since their true start time is unknown.',
    source: 'modules/tableone/extubation_calculator.py (clifpy issue #124 pattern)',
  },
  'Time to reintubation (hrs), median [Q1, Q3]': {
    text: 'Hours from extubation to the next intubation, among hospitalizations that were reintubated.',
    source: 'modules/tableone/extubation_calculator.py:218',
  },
  'Extubation failure ≤48hr, n (% of extubated)': {
    text: 'Reintubation within 48 hours of extubation. The percentage is of EXTUBATED hospitalizations, not of all hospitalizations in the cohort.',
    source: 'modules/tableone/extubation_calculator.py:221',
  },

  '28-day VFD (IMV encounters), n (%)': {
    text: 'The count of IMV hospitalizations that have a computable 28-day VFD, shown as a share of all hospitalizations in the cohort. This is the denominator for the median below — it is not itself a ventilator-free-days figure.',
    source: 'modules/tableone/generator.py:6170',
  },
  'VFD, median [Q1, Q3]': {
    text: '28-day ventilator-free days. The window is ventilation start through day 27. Death inside the window scores 0; still ventilated at day 28 scores 0; never re-ventilated scores 28. Free days between a reintubation do NOT count.',
    source: 'modules/tableone/vfd_calculator.py',
  },
  '28-day NIDFD (NIPPV/HFNC encounters), n (%)': {
    text: 'The count of hospitalizations that received NIPPV, CPAP or high-flow nasal cannula at 30 L/min or more, shown as a share of all hospitalizations in the cohort. This is the denominator for the median below — it is not itself a device-free-days figure.',
    source: 'modules/tableone/generator.py',
  },
  'NIDFD, median [Q1, Q3]': {
    text: '28-day non-invasive device-free days, computed like VFD but counting time off non-invasive support (ONLY hospitalizations that received NIPPV or CPAP, or high-flow nasal cannula at 30 L/min or more) — not every hospitalization on respiratory support.',
    source: 'modules/tableone/generator.py',
  },

  'ICU encounters, n (%)': {
    text: 'Hospitalizations that ever had an ADT row whose location category contains "icu".',
    source: 'README.md — per-encounter-block flags',
  },
  'Advanced respiratory support, n (%)': {
    text: 'Hospitalizations that ever received IMV, NIPPV or CPAP — or high-flow nasal cannula at 30 L/min or more.',
    source: 'README.md — per-encounter-block flags',
  },
  'Vasoactive support, n (%)': {
    text: 'Hospitalizations that ever received norepinephrine, epinephrine, phenylephrine, vasopressin, dopamine or angiotensin.',
    source: 'README.md — per-encounter-block flags',
  },
  'Ward only (survived, no critical care), n (%)': {
    text: 'Hospitalizations that touched a ward and never received critical care, and survived. The complement of the four categories above rather than another overlapping one.',
    source: 'run_tableone_ward.py',
  },

  'Total SOFA score, median [Q1, Q3]': {
    text: 'Sequential Organ Failure Assessment, scored once per hospitalization from the worst value of each organ component in the first 24 hours after ICU admission — not a daily score.',
    source: 'generator.py:4744 (first_icu_in_dttm + 24h window, extremal_type=worst, fill_na_scores_with_zero); modules/sofa/calculator.py:991',
  },
  'Charlson Comorbidity Index, median [Q1, Q3]': {
    text: 'Comorbidity index computed from the hospital diagnosis codes attached to the hospitalization.',
    source: 'clifpy.utils.comorbidity.calculate_cci (generator.py:74)',
  },
  'ICU length of stay (days), median [Q1, Q3]': {
    text: 'Median days spent in the ICU per hospitalization. Counts ICU time only and is undefined for hospitalizations that never reached an ICU.',
    source: 'modules/tableone/generator.py',
  },
  'Hospital length of stay (days), median [Q1, Q3]': {
    text: 'Median days from admission to discharge per hospitalization. A readmission within 6 hours is one continuous hospital stay.',
    source: 'modules/tableone/generator.py',
  },
  'P/F ratio (imputed), median [Q1, Q3]': {
    text: 'Imputed from SpO2/FiO2 where an arterial blood gas is unavailable.',
    source: 'modules/tableone/pf_sf_calculator.py',
  },
};

/**
 * Summary-page tiles that are derived rather than a CSV row of their own —
 * keyed by a synthetic name so they can share definitionFor().
 */
export const DERIVED_DEFINITIONS: Record<string, CharacteristicDefinition> = {
  '__VENT_SETTINGS_CARD__': {
    text: 'Median ventilator settings over the first 24 hours of invasive ventilation. Measured from ventilation start.',
    source: 'modules/tableone/ventilation_stats.py (first 24h window)',
  },
  '__VENT_MODE_CARD__': {
    text: 'The first ventilator mode charted at or after ventilation start — one per invasively ventilated hospitalization. Other pools APRV, blow by, standby, volume support and the upstream "other" category. Hospitalizations with no mode charted are excluded.',
    source: 'generator.py:2849 (first mode_category at/after vent_start_time, per encounter_block); denominator = on_vent encounters at generator.py:6109',
  },
  '__VASO_DOSE_CARD__': {
    text: 'Per-drug: the share of hospitalizations that received it, and the median infusion dose across those hospitalizations.',
    source: 'modules/tableone/generator.py:6211',
  },
  '__RESP_SECTION__': {
    text: 'Everything in this section is limited to hospitalizations that received invasive mechanical ventilation, and is measured from ventilation start.',
    source: 'modules/tableone/generator.py',
  },
  '__VASO_SECTION__': {
    text: 'Vasopressor medications given at any point during the hospitalization. Percentages are of all hospitalizations in the selected cohort.',
    source: 'README.md — vaso_support_enc flag',
  },
  '__ICU_STAY_TILE__': {
    text: 'Hospitalizations with at least one ICU stay, — hospitalizations whose ADT record ever shows a location category containing "icu".',
    source: 'README.md — icu_enc flag',
  },
  '__TIMESPAN_TILE__': {
    text: 'Span of admissions in the cohort.',
    source: 'CohortSummaryFromCSV.astro (f.years)',
  },
  '__HOSPITAL_MORTALITY_TILE__': {
    text: 'Hospitalizations discharged as expired or to hospice, over all hospitalizations in the selected cohort.',
    source: 'README.md — death_enc flag',
  },
  '__MEDIAN_AGE_TILE__': {
    text: 'Median age at admission.',
    source: 'modules/tableone/generator.py',
  },
  '__ENCOUNTER_TYPES_CARD__': {
    text: 'Categories can overlap. Eg — a hospitalization can include an ICU stay AND advanced respiratory support AND vasopressor support',
    source: 'README.md — per-encounter-block flags',
  },
};

/**
 * Definitions for whole families of rows sharing a `<Prefix>: <value>` name.
 * Matched on the stem, so one entry covers every category in the group.
 */
export const PREFIX_DEFINITIONS: Record<string, CharacteristicDefinition> = {
  'Initial ventilator mode': {
    text: 'The first ventilator mode recorded at or after ventilation start, one per IMV hospitalization. Hospitalizations with no mode recorded in that window are counted as Missing rather than dropped.',
    source: 'modules/tableone/generator.py:2828',
  },
  'First location at IMV start': {
    text: 'The ADT location the patient occupied when invasive ventilation began — where they were intubated, not where they were admitted.',
    source: 'modules/tableone/generator.py',
  },
  'IMV outcome': {
    text: 'Whether a charted extubation was found for each IMV hospitalization. Extubation is inferred from the respiratory-support timeline — an invasive-ventilation reading followed by two consecutive readings off it — not from a recorded extubation event, and the status reflects the first ventilation episode, so a later reintubation does not change it. "No extubation recorded" therefore means the charting shows none, not that the patient left the hospital on a ventilator.',
    source: 'modules/tableone/extubation_calculator.py:245',
  },
  'First admission location': {
    text: 'The ADT location category of the hospitalization’s first admission row.',
    source: 'modules/tableone/generator.py',
  },
  'Admission type': {
    text: 'How the hospitalization began — ED, elective, direct, transfer from an outside hospital (OSH), from a facility, or other.',
    source: 'modules/tableone/generator.py',
  },
};

/**
 * The two medication blocks, which differ only in who is counted.
 *
 * Both read the SAME per-hospitalization flag: `<med>_flag` is 1 when that
 * medication appears anywhere in the hospitalization's records
 * (generator.py:3576 — group by encounter_block x med_category, pivot,
 * `.notna()`). There is no time window on the drug.
 *
 * 'Medications during IMV' then filters the POPULATION to hospitalizations that
 * were ever invasively ventilated (`df[df['on_vent'] == 1]`, generator.py:6254)
 * and divides by that count. So it is not "given while intubated" — it is "given
 * at some point, by someone who was ventilated at some point". For cisatracurium
 * the distinction is immaterial, since 98.8% of everyone who receives it is
 * ventilated; for propofol or fentanyl it is not, as either can be given for a
 * procedure days before intubation or after extubation.
 */
export const MEDICATION_ROWS = new Set([
  'Propofol',
  'Midazolam',
  'Lorazepam',
  'Dexmedetomidine',
  'Fentanyl',
  'Cisatracurium',
  'Rocuronium',
]);

export const MEDICATION_DEFINITION: CharacteristicDefinition = {
  text: 'Hospitalizations where this medication appears anywhere in the record, as a share of every hospitalization in the cohort. Any administration at any point counts once, regardless of dose, duration, or when in the stay it was given.',
  source: 'modules/tableone/generator.py:3576 (med_flags: encounter_block x med_category, .notna())',
};

export const MEDICATION_DURING_IMV_DEFINITION: CharacteristicDefinition = {
  text: 'Counted only among hospitalizations that were invasively ventilated at some point, and divided by that ventilated count.',
  source: "modules/tableone/generator.py:6254 (df[df['on_vent'] == 1], denominator N_imv)",
};

/** Definition for a characteristic, matching exact name then `<Prefix>:` stem. */
export function definitionFor(name: string): CharacteristicDefinition | null {
  const trimmed = (name || '').trim();
  if (CHARACTERISTIC_DEFINITIONS[trimmed]) return CHARACTERISTIC_DEFINITIONS[trimmed];
  if (DERIVED_DEFINITIONS[trimmed]) return DERIVED_DEFINITIONS[trimmed];
  // Checked before the medication set, so 'Propofol (during IMV)' does not
  // resolve to the all-hospitalizations definition.
  if (trimmed.endsWith('(during IMV)')) return MEDICATION_DURING_IMV_DEFINITION;
  if (MEDICATION_ROWS.has(trimmed)) return MEDICATION_DEFINITION;
  const sep = trimmed.indexOf(':');
  if (sep > 0) {
    const prefix = trimmed.slice(0, sep);
    if (PREFIX_DEFINITIONS[prefix]) return PREFIX_DEFINITIONS[prefix];
  }
  // A group can be selected in its own right in the Explorer ('Initial
  // ventilator mode'), where the name carries no colon to strip.
  if (PREFIX_DEFINITIONS[trimmed]) return PREFIX_DEFINITIONS[trimmed];
  return null;
}
