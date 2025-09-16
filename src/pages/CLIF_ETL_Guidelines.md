# CLIF ETL Guidelines by Table

This document outlines key ETL (Extract, Transform, Load) guidelines for each CLIF table based on the implementation patterns.

## General Guidelines

### Data Types and Formatting
- **Patient/Hospitalization IDs**: Always convert to character strings
- **DateTime columns**: Convert to UTC timezone using `as_datetime(*, tz = "UTC")`
- **Numeric values**: Use `as.numeric()` and `parse_number()` for cleaning
- **String cleaning**: Use `str_trim()` to remove whitespace

### Quality Checks
- Check for duplicates using composite keys
- Calculate missingness percentages
- Validate date ranges and data distributions
- Remove rows with missing critical identifiers

---

## Table-Specific Guidelines

### 1. ADT (Admissions, Discharges, Transfers)

**The Problem:**
ADT data often contains overlapping time intervals where a patient appears to be in multiple locations simultaneously. This happens due to:
- Delayed documentation of transfers
- System timing issues
- Multiple staff documenting the same transfer

**Solution 1: Fix Overlapping Time Intervals**

The algorithm works in several steps:

1. **Generate Unique Time Points**: For each patient, collect all unique `in_dttm` and `out_dttm` timestamps
2. **Create Non-Overlapping Intervals**: Use consecutive time points to create intervals that don't overlap
3. **Map Original Records to New Intervals**: Use `foverlaps()` to find which original ADT records apply to each new interval
4. **Resolve Conflicts**: When multiple locations exist for the same interval, choose the most recent one

```r
# Step 1: Generate unique time points for each patient
clif_times <- clif_adt_clean[, .(time = unique(c(in_dttm, out_dttm))), by = C19_PATIENT_ID]
setorder(clif_times, C19_PATIENT_ID, time)

# Step 2: Create intervals between consecutive time points
clif_times[, end_time := shift(time, type = "lead"), by = C19_PATIENT_ID]
clif_intervals <- clif_times[!is.na(end_time), .(C19_PATIENT_ID,
                                                 start = time,
                                                 end = end_time)]

# Step 3: Use foverlaps to map original records to new intervals
result <- foverlaps(clif_intervals, clif_adt_intervals,
                    type = "within", nomatch = 0L)

# Step 4: Resolve conflicts by selecting the most recent location
result[, max_start := max(start), by = .(C19_PATIENT_ID, i.start, i.end)]
result_filtered <- result[start == max_start]
```

**Example:**
```
Original overlapping data:
Patient A: ICU     10:00-12:00
Patient A: Ward    11:00-14:00
Patient A: ICU     13:00-15:00

After processing:
Patient A: ICU     10:00-11:00  (original ICU record)
Patient A: Ward    11:00-13:00  (Ward record, more recent than ICU)
Patient A: ICU     13:00-15:00  (final ICU record)
```

**Solution 2: Merge Consecutive Same-Location Stays**

After fixing overlaps, merge consecutive rows with identical locations:

```r
# Step 1: Order data and assign run IDs for consecutive identical locations
setorder(final_result, C19_PATIENT_ID, C19_HAR_ID, in_dttm)
final_result[, run_id := rleid(location_name, location_category),
             by = .(C19_PATIENT_ID, C19_HAR_ID)]

# Step 2: Merge runs by taking min start time and max end time
merged_result <- final_result[, .(
  in_dttm = min(in_dttm),
  out_dttm = max(out_dttm),
  location_name = first(location_name),
  location_category = first(location_category)
), by = .(C19_PATIENT_ID, C19_HAR_ID, run_id)]
```

**Data Quality Checks:**
- **Temporal Validation**: Ensure `out_dttm` > `in_dttm` for all records
- **Duplicate Prevention**: Check for duplicates by `(patient_id, in_dttm)`
- **Location Consistency**: Validate location mappings against master list
- **ED After ICU/Ward**: Flag cases where ED visits occur after definitive care

**Critical Fields:**
- `in_dttm`, `out_dttm`: Must be in UTC, properly ordered
- `location_category`: Map to standard values (icu, ward, ed, etc.)
- `hospital_id`: Add site identifier for multi-site datasets

**Business Rule Validation:**
- 61% of encounters have no ICU/Ward stays (likely outpatient)
- 41% of encounters are ED-only
- 19% have no ICU/Ward/ED categories (investigate if valid)


### 3. Hospitalization
**Data Quality:**
- **Required Fields**: Filter out records missing `admission_dttm`, `admit_dispo`, `discharge_dispo`
- **Temporal Logic**: Ensure `discharge_dttm` ≥ `admission_dttm`
- **Duplicate Prevention**: Check for duplicates by `(hospitalization_id, admission_dttm)`
- **Age Validation**: Flag negative ages or ages > 120 years
- If `age_at_admission` is not present, calculate it using `birth_date` and filter out records with missing `birth_date`


### 4. Vitals

**The Problem:**
Vital signs data presents several challenges:
- Blood pressure stored as combined "120/80" format
- Multiple unit systems (Imperial vs Metric)
- Multiple measurement sites (arterial vs cuff)
- Outlier values from measurement errors

**Solution 1: Blood Pressure Decomposition**

Blood pressure is often stored as a single "systolic/diastolic" value that needs to be split:

```r
# Step 1: Identify blood pressure records
bp_df <- rclif_vitals[vital_category == "blood_pressure"]

# Step 2: Split the combined value using tstrsplit
bp_df[, c("sbp", "dbp") := tstrsplit(vital_value, "/", fixed = TRUE)]

# Step 3: Reshape from wide to long format
bp_df <- melt(
  bp_df,
  id.vars = c("patient_id", "hospitalization_id", "recorded_dttm",
              "vital_name", "meas_site_name"),
  measure.vars = c("sbp", "dbp"),
  variable.name = "vital_category",
  value.name = "vital_value"
)

# Step 4: Convert to numeric
bp_df[, vital_value := as.numeric(vital_value)]
```

**Example:**
```
Original: vital_value = "120/80", vital_category = "blood_pressure"
Result:
  Record 1: vital_value = 120, vital_category = "sbp"
  Record 2: vital_value = 80, vital_category = "dbp"
```

**Solution 2: Unit Conversions**

**Data Quality Validation:**
- **Range Validation**: Define physiologically plausible ranges per vital sign
- **Duplicate Handling**: Remove exact duplicates by key fields
- **Site Consistency**: Validate that measurement sites are appropriate for each vital
- **Temporal Validation**: Ensure `recorded_dttm` is within hospitalization period
- Different hospitals may use different unit systems, apply unit conversions with proper rounding

**Critical Fields:**
- `vital_category`: Must map to standardized CLIF categories
- `vital_value`: Numeric, post-conversion, within valid ranges
- `meas_site_name`: Track measurement location (arterial, cuff, etc.)
- `recorded_dttm`: UTC timezone

**Business Rules:**
- Prefer arterial BP over cuff BP when both available at same time
- Flag discordant arterial vs cuff BP (>10 mmHg difference for SBP)
- Round converted values to 3 decimal places for consistency

### 5. Respiratory Support

**The Problem:**
Respiratory support data is complex because:
- Multiple flowsheet fields contain device/mode information
- Device names don't always directly map to categories
- Ventilator modes can override device categories
- Numeric parameters need validation by device type
- Tracheostomy information is scattered across fields

**Solution 1: Data Consolidation and Pivot**

Raw flowsheet data needs to be pivoted from long to wide format:

```r
# Step 1: Join with mapping table and pivot to wide format
rclif_rs_clean <- rclif_rs |>
  # Remove "No" responses for binary fields
  filter(meas_value != "No") |>
  # Handle special case: "Yes" responses for NIPPV
  group_by(patient_id, hospitalization_id, recorded_dttm, flo_meas_name, unique_names) |>
  mutate(meas_value = ifelse(unique_names == "device_name_ni" & meas_value == "Yes",
                             "NIPPV", meas_value)) |>
  # Summarize numeric values (take mean) or first text value
  summarise(clean_value = {
    numeric_values <- suppressWarnings(as.numeric(meas_value))
    if (all(!is.na(numeric_values))) {
      as.character(mean(numeric_values, na.rm = TRUE))
    } else {
      as.character(meas_value[1])
    }
  }, .groups = 'drop') |>
  # Pivot to wide format
  pivot_wider(names_from = unique_names, values_from = clean_value,
              id_cols = c("patient_id", "hospitalization_id", "recorded_dttm"))
```

**Solution 2: Device Category Assignment**

Device categories are assigned through a hierarchy of rules:

```r
# Step 1: Coalesce multiple device name columns
mutate(device_name = coalesce(device_name, device_name_ed_rt,
                              device_name_ni, device_name_ed))

# Step 2: Apply device category logic
device_category = case_when(
  is.na(device_name) ~ NA_character_,
  # Invasive Mechanical Ventilation (IMV)
  (grepl('Vent', device_name, ignore.case = TRUE)) &
    !grepl('Venturi Mask', device_name, ignore.case = TRUE) ~ 'IMV',
  # Non-Invasive Positive Pressure Ventilation
  grepl('NIPPV|Bipap', device_name, ignore.case = TRUE) ~ 'NIPPV',
  # Continuous Positive Airway Pressure
  grepl('CPAP', device_name, ignore.case = TRUE) ~ 'CPAP',
  # High Flow Nasal Cannula
  grepl('High Flow NC', device_name, ignore.case = TRUE) ~ 'High Flow NC',
  # Standard Nasal Cannula
  grepl('Cannula', device_name, ignore.case = TRUE) ~ 'Nasal Cannula',
  # Face Masks
  grepl('Mask|Non-Rebreather', device_name, ignore.case = TRUE) ~ 'Face Mask',
  # Special handling for mixed entries
  grepl('Room Air', device_name, ignore.case = TRUE) ~ 'Room Air',
  TRUE ~ 'Other'
)
```

**Solution 3: Mode-Based Category Override**

Ventilator modes can override device categories:

```r
# Create override table for specific mode-device conflicts
override_tbl <- tibble::tribble(
  ~mode_name,            ~device_cat_override,
  "SIMV - PC PS",        "IMV",
  "A/C Volume",          "IMV",
  "CPAP",                "CPAP",
  "NIV-PC",              "NIPPV",
  "BiPAP",               "NIPPV",
  # ... more mappings
)

# Apply overrides
rclif_rs_final <- rclif_rs_final |>
  left_join(override_tbl, by = "mode_name") |>
  mutate(device_category = coalesce(device_cat_override, device_category))
```

**Solution 4: Parameter Validation and Cleaning**

Different device types have different valid parameter ranges:

```r
# Clean flow rates by device type
lpm_set = case_when(
  lpm_set < 0 ~ NA_real_,                                    # Invalid negative
  device_category == 'Room Air' ~ NA_real_,                 # Not applicable
  device_category == 'IMV' ~ NA_real_,                      # Not applicable
  device_category == 'Nasal Cannula' & lpm_set > 6 ~ 6,     # Cap at 6 L/min
  device_category == 'High Flow NC' & lpm_set > 60 ~ 60,    # Cap at 60 L/min
  lpm_set > 60 ~ NA_real_,                                   # Invalid high
  TRUE ~ lpm_set
)

# Convert FiO2 from percentage to decimal
fio2_set = as.numeric(fio2_set) / 100
```

**Solution 5: Tracheostomy Detection**

Tracheostomy status can be indicated in multiple places:

```r
# Check multiple sources for tracheostomy
tracheostomy_clean = ifelse(
  is.na(device_name) & is.na(tracheostomy), NA,
  ifelse(
    grepl("Trach", device_name, ignore.case = TRUE) |
    grepl("Trach", tracheostomy, ignore.case = TRUE), 1, 0
  )
)
```

**Data Quality Validation:**
- **Parameter Ranges**: Validate numeric parameters are within physiologic ranges
- **Device-Parameter Consistency**: Ensure parameters are appropriate for device type
- **Mode-Device Compatibility**: Flag incompatible mode-device combinations
- **Temporal Validation**: Check that respiratory support timing aligns with hospitalization

**Critical Fields:**
- `device_category`: Primary categorization (IMV, NIPPV, CPAP, etc.)
- `mode_category`: Standardized ventilator mode categories
- `fio2_set`: Decimal format (0.21-1.0), validate range
- `tracheostomy`: Binary indicator (0/1)

**Business Rules:**
- Remove all "No" responses for device usage
- Coalesce multiple parameter columns (set vs observed values)
- Apply device-specific parameter limits
- Mode names override device categories when conflicts exist

### 6. Position

**The Problem:**
Position data requires sophisticated text processing because:
- Position names are free text with variations
- Need to distinguish prone from non-prone positions
- Must handle conflicting documentation
- Only meaningful for patients with documented proning

**Solution: Multi-Step Position Classification**

```r
# Step 1: Identify prone positions using regex
mutate(prone = if_else(str_detect(position_name, regex("prone", ignore_case = TRUE)), 1, 0))

# Step 2: Identify supine-type positions
mutate(
  supine = if_else(str_detect(position_name, regex("supin|supine", ignore_case = TRUE)), 1, NaN),
  fowlers = if_else(str_detect(position_name, regex("fowler", ignore_case = TRUE)), 1, NaN),
  sitting = if_else(str_detect(position_name, regex("sitting", ignore_case = TRUE)), 1, NaN)
)

# Step 3: Consolidate supine-type positions
mutate(supine = if_else(
  str_detect(position_name, regex("fowler|trendelenburg|sitting", ignore_case = TRUE)), 1, supine
))

# Step 4: Handle missing supine labels when prone status is clear
mutate(
  supine = if_else(is.na(supine) & prone == 0, 1, supine),
  supine = if_else(is.na(supine) & prone == 1, 0, supine)
)

# Step 5: Remove conflicting or unclear documentation
mutate(drop = if_else(((prone == 1 & supine == 1) | (is.na(prone) & is.na(supine))), 1, 0)) |>
filter(drop == 0)

# Step 6: Create final position category
mutate(position_category = case_when(
  prone == 1 ~ 'prone',
  supine == 1 ~ 'not_prone',
  TRUE ~ 'unknown'
))

# Step 7: Filter to patients with meaningful proning data
group_by(hospitalization_id) |>
filter(sum(prone, na.rm = TRUE) > 1) |>  # At least 2 prone episodes
ungroup()
```

**Example Classifications:**
```
"Prone positioning" → prone = 1, supine = 0, position_category = "prone"
"Supine with HOB elevated" → prone = 0, supine = 1, position_category = "not_prone"
"Semi-Fowler's" → prone = 0, supine = 1, position_category = "not_prone"
"Sitting up in chair" → prone = 0, supine = 1, position_category = "not_prone"
"Left lateral" → prone = 0, supine = 1 (inferred), position_category = "not_prone"
```

**Data Quality Validation:**
- **Conflict Resolution**: Remove records with contradictory prone/supine flags
- **Minimum Episodes**: Only include patients with >1 prone episodes (indicates deliberate proning protocol)
- **Text Validation**: Flag unusual position names for manual review

**Critical Fields:**
- `position_category`: prone, not_prone (binary classification)
- `position_name`: Original text for audit trail
- Filter criterion: Only patients with documented proning protocols

**Business Rules:**
- Proning must be intentional (multiple episodes required)
- When prone status is unclear, exclude the record
- Semi-Fowler's, sitting, and lateral positions count as "not_prone"

### 7. Patient Assessments

**Key Transformations:**
- Separate numeric, categorical, and text values
- Map assessment names to standardized categories
- Handle different value types per assessment

**Data Quality:**
- Remove duplicate assessments
- Validate assessment category mappings
- Ensure proper value type assignment

**Critical Fields:**
- `assessment_category`: Standardized categories
- Value fields: `numerical_value`, `categorical_value`, `text_value`
- `assessment_group`: Grouping for related assessments

### 8. Labs

**Key Transformations:**
- Unit standardization and conversion
- Handle POC vs standard lab types
- Numeric value extraction from text results

**Data Quality:**
- Remove records with missing `ord_value`
- Validate LOINC code mappings
- Check reference unit consistency

**Critical Fields:**
- `lab_category`: Standardized lab categories
- `lab_value_numeric`: Parsed numeric results
- `reference_unit`: Standardized units
- Time fields: `lab_order_dttm`, `lab_collect_dttm`, `lab_result_dttm`

```r
# Unit standardization
reference_unit = case_when(
  str_detect(reference_unit, fixed("mm[Hg]")) ~ "mmHg",
  str_detect(reference_unit, fixed("10e3/uL")) ~ "10*3/uL",
  str_detect(reference_unit, fixed("meq/L")) ~ "mmol/L",
  TRUE ~ reference_unit
)
```

### 9. Medication Administration Continuous

**The Problem:**
Medication data is challenging because:
- Thousands of medication names need standardization
- Dose information is embedded in text fields
- Only continuous medications are relevant for CLIF
- Route information comes from separate tables

**Solution 1: Medication Name Standardization**

Use a carefully curated mapping table to reduce thousands of medication names to a limited vocabulary:

```r
# Join with medication mapping table that maps specific names to categories
reqd_meds <- medadmin |>
  inner_join(med_names_mapped, by = "medication_name") |>
  # This join significantly reduces the dataset to only relevant medications
  filter(!is.na(med_category))
```

**Solution 2: Dose Parsing and Unit Standardization**

Doses are often stored as text like "2.5 mg EVERY 4 HOURS":

```r
# Extract dose unit from either dedicated field or embedded in dose text
med_dose_unit = str_trim(ifelse(
  is.na(dose_units) | dose_units == "",
  str_replace_all(take_med_dose, "[0-9.]+", ""),  # Remove numbers, keep text
  dose_units
))

# Extract numeric dose value using regex
med_dose = as.numeric(
  str_extract_all(take_med_dose, "[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?") |>
  sapply(function(x) if(length(x) > 0) paste(x, collapse = "") else NA_character_)
)

# Filter to continuous medications only (by time units)
filter(grepl("min|hr|day", med_dose_unit, ignore.case = TRUE))
```

**Solution 3: Complex Multi-Table Join**

Medication data often spans multiple tables:

```r
reqd_meds <- medadmin |>
  # Start with administration records
  select(-c(prescript_sig, prescript_quantity, prescript_refills)) |>
  # Join standardized medication mapping
  inner_join(med_names_mapped, by = "medication_name") |>
  # Join order information for route details
  left_join(med_out_subset, by = c("patient_id", "hospitalization_id",
                                   "medication_id", "order_start_dttm",
                                   "medication_name"))
```

**Solution 4: Data Type Conversions and Validation**

```r
# Standardize datetime fields
admin_dttm = as_datetime(take_med_dttm, tz = "UTC")
order_start_dttm = ymd_hms(order_start_time, tz = "UTC")
order_end_dttm = ymd_hms(order_end_time, tz = "UTC")

# Handle special medication categories
med_category = ifelse(medication_name %like% "PLACEBO", "other", med_category)

# Remove invalid administrations
filter(!is.na(admin_dttm))
```

**Data Quality Validation:**
- **Medication Mapping**: Ensure all administered medications map to standard categories
- **Dose Validation**: Check that doses are reasonable for each medication category
- **Temporal Validation**: Ensure administration times fall within order periods
- **Route Consistency**: Validate route appropriateness for medication type

**Critical Fields:**
- `med_category`: CLIF-standardized medication categories (limited vocabulary)
- `admin_dttm`: Time of administration (UTC)
- `med_dose`: Numeric dose amount
- `med_dose_unit`: Standardized units (mg/hr, mcg/min, etc.)

**Business Rules:**
- Only include medications with continuous dosing (hourly/daily units)
- Map generic names to standardized categories
- Handle unicode characters in medication names
- Filter out placebo medications separately

### 10. CRRT Therapy

**The Problem:**
CRRT (Continuous Renal Replacement Therapy) data challenges:
- Mode categories must be inferred from parameters
- Multiple therapy parameters across different flowsheet rows
- Need to filter patients without any CRRT activity
- Missing explicit mode documentation

**Solution 1: Data Pivot and Consolidation**

CRRT data comes in long format and needs to be pivoted:

```r
# Pivot from long to wide format
rclif_crrt <- flow_io |>
  inner_join(cde_crrt_therapy, by = c("flo_meas_name", "flo_group_name")) |>
  select(hospitalization_id, recorded_dttm, crrt_therapy_field_name, meas_value) |>
  pivot_wider(names_from = crrt_therapy_field_name, values_from = meas_value,
              id_cols = c("hospitalization_id", "recorded_dttm"))
```

**Solution 2: Mode Category Inference**

CRRT mode is determined by dialysate flow rate:

```r
# Infer mode category from dialysate flow
mutate(
  dialysate_flow_rate = as.numeric(dialysate_flow_rate),
  crrt_mode_category = ifelse(dialysate_flow_rate == 0, "scuf", "cvvhd"),
  crrt_mode_name = NA  # Not available in source data
)
```

**Mode Logic:**
- **SCUF** (Slow Continuous Ultrafiltration): `dialysate_flow_rate == 0`
- **CVVHD** (Continuous Veno-Venous Hemodialysis): `dialysate_flow_rate > 0`

**Solution 3: Patient Filtering**

Only include patients with actual CRRT activity:

```r
# Filter out patients with no CRRT parameters
group_by(hospitalization_id) |>
filter(
  !all(
    is.na(dialysis_machine_name) &
    is.na(dialysate_flow_rate) &
    is.na(ultrafiltration_out) &
    is.na(blood_flow_rate)
  )
) |>
ungroup()
```

**Data Quality Validation:**
- **Parameter Validation**: Check that flow rates are within reasonable ranges
- **Machine Validation**: Ensure machine names are valid
- **Temporal Validation**: CRRT sessions should have logical start/stop patterns

**Critical Fields:**
- `crrt_mode_category`: CVVHD or SCUF (inferred from dialysate flow)
- `dialysate_flow_rate`: Numeric, determines mode
- `ultrafiltration_out`: Fluid removal rate
- `blood_flow_rate`: Parse numeric from text field

**Business Rules:**
- Mode inference: dialysate_flow_rate = 0 → SCUF, >0 → CVVHD
- Pre/post filter replacement rates not available (set to NA)
- Filter out hospitalizations with no CRRT parameters documented

---

## Common Data Quality Patterns

### Duplicate Handling
```r
# Check duplicates by composite key
check_duplicates_dt(df, cols = c("key1", "key2"))

# Remove duplicates
df <- unique(df, by = c("key_columns"))
```

### Missing Data Analysis
```r
calculate_missingness <- function(df) {
  missingness <- sapply(df, function(x) mean(is.na(x)) * 100)
  return(missingness)
}
```

### Time Validation
```r
# Convert to UTC
df[, datetime_col := as_datetime(raw_time, tz = "UTC")]

# Validate chronological order
df[, is_valid := start_time <= end_time]
```

### Data Type Conversions
```r
# Consistent ID formatting
df[, patient_id := as.character(patient_id)]

# Numeric parsing with error handling
df[, numeric_val := as.numeric(parse_number(raw_value))]
```

## Final Notes

- Always preserve original values in staging areas before transformation
- Document all mapping tables and business rules
- Implement data quality checks at each transformation step
- Use UTC timezone consistently across all datetime fields
- Maintain audit trails for data lineage and quality metrics