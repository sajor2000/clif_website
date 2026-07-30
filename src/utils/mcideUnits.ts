// Canonical measurement units, from the CLIF mCIDE.
//
// The ECDF export carries a `reference_unit` column, but it is whatever each
// site recorded rather than the standard: the same unit arrives as 'k/ul',
// 'k/cumm', '10^3/ul', '10*3/ul' and '10^3/µl', albumin as 'gm/dl', alkaline
// phosphatase as 'iu/l' — and every vitals and respiratory-support row as the
// literal string 'nan'. Rendered straight into the sidebar that produced
// 'Albumin (gm/dl)' and 'PEEP Set (nan)'.
//
// So units are looked up by category here instead of read from the data.
//
// Labs are transcribed from mCIDE/labs/clif_lab_categories.csv (reference_unit
// column) at github.com/Common-Longitudinal-ICU-data-Format/CLIF.
//
// Vitals have NO unit column in mCIDE/vitals/clif_vitals_categories.csv — the
// unit is stated in each category's prose description ('degrees Celsius',
// 'beats per minute (bpm)', 'Peripheral oxygen saturation (%)'), so those are
// transcribed from the descriptions and noted individually.
//
// Respiratory support units are not in mCIDE at all; they follow the CLIF
// respiratory_support table's field definitions.

/** lab_category -> reference_unit, from mCIDE. */
export const LAB_UNITS: Record<string, string> = {
  'albumin': 'g/dL',
  'alkaline_phosphatase': 'U/L',
  'alt': 'U/L',
  'ast': 'U/L',
  'basophils_percent': '%',
  'basophils_absolute': '10^3/µL',
  'bicarbonate': 'mmol/L',
  'bilirubin_total': 'mg/dL',
  'bilirubin_conjugated': 'mg/dL',
  'bilirubin_unconjugated': 'mg/dL',
  'bun': 'mg/dL',
  'calcium_total': 'mg/dL',
  'calcium_ionized': 'mg/dL',
  'chloride': 'mmol/L',
  'creatinine': 'mg/dL',
  'crp': 'mg/L',
  'eosinophils_percent': '%',
  'eosinophils_absolute': '10^3/µL',
  'esr': 'mm/hour',
  'ferritin': 'ng/mL',
  'glucose_fingerstick': 'mg/dL',
  'glucose_serum': 'mg/dL',
  'hemoglobin': 'g/dL',
  'phosphate': 'mg/dL',
  'inr': '(no units)',
  'lactate': 'mmol/L',
  'ldh': 'U/L',
  'lymphocytes_percent': '%',
  'lymphocytes_absolute': '10^3/µL',
  'magnesium': 'mg/dL',
  'monocytes_percent': '%',
  'monocytes_absolute': '10^3/µL',
  'neutrophils_percent': '%',
  'neutrophils_absolute': '10^3/µL',
  'pco2_arterial': 'mmHg',
  'po2_arterial': 'mmHg',
  'pco2_venous': 'mmHg',
  'ph_arterial': '(no units)',
  'ph_venous': '(no units)',
  'platelet_count': '10^3/µL',
  'potassium': 'mmol/L',
  'procalcitonin': 'ng/mL',
  'pt': 'sec',
  'ptt': 'sec',
  'so2_arterial': '%',
  'so2_mixed_venous': '%',
  'so2_central_venous': '%',
  'sodium': 'mmol/L',
  'total_protein': 'g/dL',
  'troponin_i': 'ng/L',
  'troponin_t': 'ng/L',
  'wbc': '10^3/µL',
};

/** vital_category -> unit, read from the mCIDE description prose. */
export const VITAL_UNITS: Record<string, string> = {
  temp_c: '°C',                  // 'Body temperature in degrees Celsius'
  heart_rate: 'bpm',             // 'Heart rate in beats per minute (bpm)'
  sbp: 'mmHg',                   // systolic blood pressure
  dbp: 'mmHg',                   // diastolic blood pressure
  map: 'mmHg',                   // mean arterial pressure
  spo2: '%',                     // 'Peripheral oxygen saturation (%)'
  respiratory_rate: 'breaths/min', // 'Number of breaths per minute'
  height_cm: 'cm',               // 'height in centimeters'
  weight_kg: 'kg',               // 'weight in kilograms'
};

/** respiratory_support field -> unit, from the CLIF table definition. */
export const RESPIRATORY_UNITS: Record<string, string> = {
  fio2_set: 'fraction',
  lpm_set: 'L/min',
  flow_rate_set: 'L/min',
  tidal_volume_set: 'mL',
  tidal_volume_obs: 'mL',
  resp_rate_set: 'breaths/min',
  resp_rate_obs: 'breaths/min',
  minute_vent_obs: 'L/min',
  peep_set: 'cmH2O',
  peep_obs: 'cmH2O',
  pressure_control_set: 'cmH2O',
  pressure_support_set: 'cmH2O',
  peak_inspiratory_pressure_set: 'cmH2O',
  peak_inspiratory_pressure_obs: 'cmH2O',
  plateau_pressure_obs: 'cmH2O',
  mean_airway_pressure_obs: 'cmH2O',
  inspiratory_time_set: 'sec',
};

/**
 * Display names for categories whose mCIDE name embeds the unit.
 *
 * 'height_cm' with unit 'cm' renders as 'Height Cm (cm)' otherwise — the unit
 * stated twice, once mangled by title-casing. Only these three need it; every
 * other category name is unit-free.
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  temp_c: 'Temperature',
  height_cm: 'Height',
  weight_kg: 'Weight',
  spo2: 'SpO2',
  lpm_set: 'LPM Set',
};

const BY_TYPE: Record<string, Record<string, string>> = {
  labs: LAB_UNITS,
  vitals: VITAL_UNITS,
  respiratory_support: RESPIRATORY_UNITS,
};

/** Values the export writes when it has no unit. '(no units)' is mCIDE's own. */
const NO_UNIT = new Set(['', 'nan', 'null', 'none', 'n/a', 'na', '(no units)', 'unknown']);

/** True when a unit string carries no information and should not be rendered. */
export function isMissingUnit(unit: string | undefined | null): boolean {
  return NO_UNIT.has((unit ?? '').trim().toLowerCase());
}

/**
 * The unit for a category, or '' when it genuinely has none.
 *
 * Dimensionless categories — INR, pH, ratios — are mCIDE '(no units)' and
 * return '', so the caller renders the name alone rather than a bracket
 * containing a non-unit.
 */
export function unitFor(dataType: string, category: string): string {
  const unit = BY_TYPE[dataType]?.[category.trim()];
  return isMissingUnit(unit) ? '' : unit;
}

/** Category names known for a data type, longest first for prefix matching. */
export function categoriesFor(dataType: string): string[] {
  return Object.keys(BY_TYPE[dataType] ?? {}).sort((a, b) => b.length - a.length);
}
