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
  'N: Encounter blocks': {
    text: 'One row per hospitalization. Linked admissions are stitched together first: any two hospitalizations where discharge-to-next-admission is 6 hours or less are merged into one hospitalization block, so a patient readmitted within 6 hours counts once, not twice. Every other figure on this dashboard is computed at this level.',
    source: 'generator.py:62 (clifpy stitch_encounters, 6-hour window)',
  },
  'N: Unique patients': {
    text: 'Distinct patients behind the hospitalization blocks. Lower than the hospitalization count because one patient can be hospitalized more than once.',
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
  'Encounters with >=1 ICU episode, n (%)': {
    text: 'Hospitalizations with at least one ICU episode, as a share of all hospitalizations in the selected cohort.',
    source: 'modules/tableone/generator.py:2275',
  },

  'Sepsis events (CDC ASE), n': {
    text: 'Total CDC Adult Sepsis Events. Computed for every hospitalization in the cohort, NOT only ICU hospitalizations — a hospitalization can contribute more than one event.',
    source: 'modules/tableone/generator.py:4510 (sepsis_events_by_sepsis_col)',
  },
  'Sepsis events per 100 encounters': {
    text: 'Sepsis events divided by all hospitalizations in the cohort.',
    source: 'derived in InteractiveDashboard.astro (withSepsisRate)',
  },
  'Encounters with >=1 sepsis event, n (%)': {
    text: 'Hospitalizations with at least one CDC Adult Sepsis Event, over all hospitalizations in the selected cohort — not restricted to ICU hospitalizations.',
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
    text: 'Hospitalizations whose ventilation started within 24 hours of admission, as a share of all hospitalizations in the cohort.',
    source: 'modules/tableone/generator.py:6145',
  },
  'Reintubation (≥2 IMV episodes), n (%)': {
    text: 'Hospitalizations with two or more separate ventilation episodes. Episodes are built from the same timeline detection used for extubation, and any episode shorter than 5 minutes is treated as a failed attempt rather than a real one.',
    source: 'modules/tableone/extubation_calculator.py:166',
  },
  'Time to extubation (hrs), median [Q1, Q3]': {
    text: 'Hours from ventilation start to extubation, among hospitalizations that were extubated. Extubation is not a recorded event — it is read off the respiratory-support timeline: a patient counts as extubated when two consecutive readings on invasive ventilation are followed by two consecutive readings off it. Requiring two on each side stops a single stray reading registering as an extubation. Patients already ventilated on arrival are excluded, since their true start time is unknown.',
    source: 'modules/tableone/extubation_calculator.py (clifpy issue #124 pattern)',
  },
  'Time to reintubation (hrs), median [Q1, Q3]': {
    text: 'Hours from extubation to the next intubation, among hospitalizations that were reintubated.',
    source: 'modules/tableone/extubation_calculator.py:218',
  },
  'Extubation failure ≤48hr, n (% of extubated)': {
    text: 'Reintubation within 48 hours of extubation. NOTE the denominator differs from its neighbours: the percentage is of EXTUBATED hospitalizations, not of all hospitalizations in the cohort.',
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
  'Other critically ill, n (%)': {
    text: 'Hospitalizations that died or were discharged to hospice WITHOUT ever touching an ICU, receiving vasoactive medications, or receiving advanced respiratory support — in effect, death in the ED or on the ward without escalation.',
    source: 'README.md — other_critically_ill flag',
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
  'CRRT, n (%)': {
    text: 'Hospitalizations that received continuous renal replacement therapy.',
    source: 'modules/tableone/generator.py:6068',
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
    text: 'PaO2/FiO2 ratio with values imputed from SpO2/FiO2 where an arterial blood gas is unavailable — coverage is therefore wider than the non-imputed row, and the two are not interchangeable.',
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
    text: 'Everything in this section is limited to hospitalizations that received invasive mechanical ventilation, and is measured from ventilation start rather than from admission.',
    source: 'modules/tableone/generator.py',
  },
  '__VASO_SECTION__': {
    text: 'Vasopressor medications given at any point during the hospitalization. Percentages are of all hospitalizations in the selected cohort.',
    source: 'README.md — vaso_support_enc flag',
  },
  '__ICU_STAY_TILE__': {
    text: 'Hospitalizations with at least one ICU stay, taken from the ICU hospitalizations row — hospitalizations whose ADT record ever shows a location category containing "icu".',
    source: 'README.md — icu_enc flag',
  },
  '__TIMESPAN_TILE__': {
    text: 'Span of admissions in the cohort. The end year is read from the latest year column in the export; the 2011 start is a fixed value in the dashboard, because the by-year breakout only reaches back to 2022 while the aggregate includes earlier admissions.',
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
  'Extubation outcome': {
    text: 'How ventilation ended for each IMV hospitalization: extubated, died on the ventilator, discharged still ventilated, a failed attempt (an episode under 5 minutes), or unknown. Extubation is detected from the respiratory-support timeline — two consecutive readings on invasive ventilation followed by two consecutive readings off it — rather than from a recorded extubation event.',
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

/** Definition for a characteristic, matching exact name then `<Prefix>:` stem. */
export function definitionFor(name: string): CharacteristicDefinition | null {
  const trimmed = (name || '').trim();
  if (CHARACTERISTIC_DEFINITIONS[trimmed]) return CHARACTERISTIC_DEFINITIONS[trimmed];
  if (DERIVED_DEFINITIONS[trimmed]) return DERIVED_DEFINITIONS[trimmed];
  const sep = trimmed.indexOf(':');
  if (sep > 0) {
    const prefix = trimmed.slice(0, sep);
    if (PREFIX_DEFINITIONS[prefix]) return PREFIX_DEFINITIONS[prefix];
  }
  return null;
}
