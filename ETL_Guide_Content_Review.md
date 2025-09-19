# CLIF ETL Guide - Content Review Document

## Section 1: General ETL Scripting Guidelines

### Data Types & Formatting

#### Identifier Fields
All `*_id` variables must be character strings:
```r
patient_id <- as.character(patient_id)
```

#### DateTime Handling
Convert all timestamps to UTC:
```r
admit_dttm <- as_datetime(admit_dttm, tz = "UTC")
```

#### Numeric Values
Clean and validate numeric data:
```r
value <- as.numeric(parse_number(value))
```

### Data Quality & Validation

#### Essential Quality Checks
- ✓ Check for duplicates using **composite keys**
- ✓ Calculate **missingness percentages** by field
- ✓ Validate **date ranges** and distributions
- ✓ Remove rows with **missing critical identifiers**
- ✓ **Ensure _category fields are never null or missing** - All standardized category fields must have valid values
- ✓ **Do NOT handle outliers in ETL** - Preserve all data values for downstream analysis

#### Critical Requirement: Category Field Completeness

**All `*_category` fields must have valid, non-null values**


### Terminology & Mapping

#### mCIDE Guidelines
Follow mCIDE (minimum Common ICU Data Elements) mapping guidelines for consistent data transformation across all institutions.

[View mCIDE Documentation](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/tree/main/mCIDE)

#### General Mapping Strategy for Standardized Categories

When mapping raw, site-specific names (medications, positions, devices, etc.) to standardized mCIDE categories, follow a systematic approach. For example - 

**Step 1: Fuzzy Pattern Matching**
Use fuzzy matching to handle common variations in terminology. 

```python
def build_fuzzy_patterns_for_category(category):
    """
    Build a list of regex patterns for fuzzy matching a category.
    This is generic and works for any category string.
    """
    cat = category.lower().strip()
    # Remove non-alphanumeric for base pattern
    cat_alphanum = re.sub(r'[^a-z0-9]', '', cat)
    patterns = []

    # 1. Exact match (case-insensitive)
    patterns.append(rf"{re.escape(cat)}")

    # 2. Allow for common vowel swaps (i/e, o/u, etc.)
    patterns.append(
        re.sub(r'[ieoua]', r'[ieoua]', re.escape(cat))
    )

    # 3. Allow for one missing character (deletion)
    if len(cat) > 4:
        for i in range(len(cat)):
            pat = re.escape(cat[:i]) + r".?" + re.escape(cat[i+1:])
            patterns.append(pat)

    # 4. Allow for one extra character (insertion)
    if len(cat) > 4:
        for i in range(len(cat)+1):
            pat = re.escape(cat[:i]) + r".?" + re.escape(cat[i:])
            patterns.append(pat)

    # 5. Allow for one character transposition
    if len(cat) > 4:
        for i in range(len(cat)-1):
            pat = (
                re.escape(cat[:i]) +
                re.escape(cat[i+1]) +
                re.escape(cat[i]) +
                re.escape(cat[i+2:])
            )
            patterns.append(pat)

    # 6. Allow for double letter (e.g., cc, tt)
    patterns.append(re.sub(r'(.)\1+', r'\1{1,2}', re.escape(cat)))

    # 7. Allow for trailing 'um', 'e', or numbers (Latin/brand/typo)
    patterns.append(rf"{re.escape(cat)}(um|e|\d+)?")

    # 8. Allow for substring match (at least 4 chars)
    if len(cat_alphanum) >= 4:
        patterns.append(re.escape(cat_alphanum[:4]))

    # Remove duplicates while preserving order
    seen = set()
    final_patterns = []
    for pat in patterns:
        if pat not in seen:
            final_patterns.append(pat)
            seen.add(pat)
    return final_patterns

def fuzzy_match_category(raw_name, category):
    raw_name = raw_name.lower()
    patterns = build_fuzzy_patterns_for_category(category)
    for pat in patterns:
        if re.search(pat, raw_name):
            return True
    return False
```

**Step 2: Manual Review and Validation**
The fuzzy matching approach is intentionally broad to capture variations. Always follow up with manual review:

1. **Review Results:** Manually inspect all matches, especially:
   - Medications with similar names but different categories
   - Abbreviations and brand names
   - Misspellings or variants
2. **Create Final Mapping Table:** Document approved mappings for consistency
3. **Flag Unmapped Items:** Review unmapped items for potential new categories or corrections

#### Sample Mapping
See a real-world example of mapping site-specific discharge names to standardized `discharge_category` values for the `hospitalization` table.

📖 [View UMN Discharge Mapping Example](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/00_mCIDE_mapping_examples/clif_hospitalization_discharge_categories_UMN.csv)

**Example Mapping Table:**
| discharge_name (site) | discharge_category (CLIF) |
|----------------------|---------------------------|
| Acute Rehab Facility | Acute Inpatient Rehab Facility |
| Rehab Facility - Inpatient | Acute Inpatient Rehab Facility |
| Short Term Hospital | Acute Care Hospital |
| Mental Health Jud Commit Anoka | Psychiatric Hospital |
| IRTS | Home |

### ETL Workflow Checklist
1. Extract data with proper types
2. Clean strings and normalize case
3. Map to standard terminologies
4. Validate and quality check

---

## Section 2: CLIF Table-Specific ETL Guidance

### ADT (Admissions, Discharges, Transfers)
**Composite Keys:** hospitalization_id, in_dttm

**Common Issues:**
- Overlapping time intervals
- Multiple location conflicts

**Detailed Processing Steps:**

#### Step 1: Fix Overlapping Time Intervals
ADT data often contains overlapping time intervals where a patient appears to be in multiple locations simultaneously. 

**Algorithm Overview:**
1. **Generate Unique Time Points:** Extract all in_dttm and out_dttm timestamps per patient
2. **Create Non-Overlapping Intervals:** Use consecutive time points to build intervals
3. **Map Original Records:** Use data.table foverlaps() function to map records to intervals
4. **Resolve Conflicts:** When multiple locations exist for same interval, select most recent

**Example Transformation:**

*Original overlapping data:*
- Patient A: ICU     10:00-12:00
- Patient A: Ward    11:00-14:00
- Patient A: ICU     13:00-15:00

*After processing:*
- Patient A: ICU     10:00-11:00  (original ICU record)
- Patient A: Ward    11:00-13:00  (Ward record, more recent)
- Patient A: ICU     13:00-15:00  (final ICU record)

#### Step 2: Merge Consecutive Same-Location Stays
**Merge Consecutive Stays:**
1. **Order Data:** Sort by patient, hospitalization, and admission time
2. **Assign Run IDs:** Use run-length encoding to group consecutive identical locations
3. **Merge Runs:** Take minimum start time and maximum end time for each run
4. **Preserve Location Info:** Keep first location name and category from each run

#### Data Quality Checks
- **Temporal Validation:** Ensure out_dttm > in_dttm for all records
- **Duplicate Prevention:** Check for duplicates by (hospitalization_id, in_dttm)
- **Location Consistency:** Validate location mappings against mCIDE
- **ED After ICU/Ward:** Flag cases where ED visits occur after definitive care

### code_status
*[Content to be added]*

### crrt_therapy
*[Content to be added]*

### ecmo_mcs
*[Content to be added]*

### hospital_diagnosis

**Special Field Handling**

**poa_present (Present on Admission) Processing:**

When handling POA indicators, only include clear Yes/No values and drop ambiguous entries:

**Common POA Values to DROP:**
- "Unspecified"
- "Unknown"
- "Clinically Undetermined"
- "Exempt from POA reporting"
- "Not Applicable"
- Other ambiguous values

**diagnosis_primary Classification:**

If diagnoses are ranked, diagnoses ranked >1, are ALL considered secondary

**Key Points:**
- **Primary (diagnosis_primary = 1):** Only diagnosis_rank == 1
- **Secondary (diagnosis_primary = 0):** All diagnosis_rank > 1 (not just rank 2)
- **Data Quality:** Drop ambiguous POA values rather than making assumptions

### hospitalization
**Composite Key:** hospitalization_id

**Quality Checks:**
- Filter out records missing `admission_dttm`, `admit_dispo`, `discharge_dispo`
- Ensure `discharge_dttm` ≥ `admission_dttm`
- Check for duplicates by `(hospitalization_id)`
- Drop encounters where age > 120 years
- If `age_at_admission` is not present, calculate it using `birth_date` and filter out records with missing `birth_date`

### labs
*[Content to be added]*

### medication_admin_continuous
**Special Processing:**
- Handling of combo, trial and placebo drugs

**Detailed Processing Steps:**

#### Combination Drug Handling

**Multi-Component Drug Logic:**
1. **First Priority:** Check if the combination drug exists as a single category in mCIDE
2. **Fallback:** Only if combination category doesn't exist, split into individual components

**Example:**
```
HYDROCODONE-ACETAMINOPHEN 7.5/325
```

**Option A - If "hydrocodone_acetaminophen" exists in mCIDE:**
- Single row: HYDROCODONE-ACETAMINOPHEN 7.5/325 → hydrocodone_acetaminophen

**Option B - If "hydrocodone_acetaminophen" does NOT exist in mCIDE:**
- Row 1: HYDROCODONE-ACETAMINOPHEN 7.5/325 → acetaminophen
- Row 2: HYDROCODONE-ACETAMINOPHEN 7.5/325 → hydrocodone


#### Special Cases
- **Trial Drugs:** Include, eg -
  ```
  ACETAMINOPHEN (IRB 140122) 325 MG → acetaminophen + trial flag
  ```
- **Placebo:** Exclude
- **Brand Names:** Map to generic

#### Dose Parsing and Unit Standardization
Doses are often stored as text like "2.5 mg EVERY 4 HOURS" requiring parsing and standardization.

**Extract Dose Unit:**
```r
med_dose_unit = str_trim(ifelse(
  is.na(dose_units) | dose_units == "",
  str_replace_all(take_med_dose, "[0-9.]+", ""),  # Remove numbers
  dose_units
))
```

**Extract Numeric Dose:**
```r
med_dose = as.numeric(
  str_extract_all(take_med_dose,
    "[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?") |>
  sapply(function(x) if(length(x) > 0) paste(x, collapse = "") else NA_character_)
)
```

**Filter Continuous Medications:**
```r
filter(grepl("min|hr|day", med_dose_unit, ignore.case = TRUE))
```

### medication_admin_intermittent
Similar special handling cases as medication admin continuous

### microbiology_culture

**Critical ETL Requirement: Include Negative Cultures**

**Important:** Always include negative cultures in your ETL output.
**Negative cultures** - Cultures with no growth or no organisms detected

**Multiple Organisms Handling**

When a single culture grows multiple organisms, create separate rows for each organism rather than concatenating:

**ETL Convention:** Duplicate the row and have one organism per row

**Example:**
```
Original data:
culture_id: C12345
culture_dttm: 2024-01-15 08:00:00
organisms: "E. coli, Klebsiella pneumoniae"
```

**CLIF ETL Solution - Create duplicate rows:**
```
Row 1: culture_id: C12345, culture_dttm: 2024-01-15 08:00:00, organism_name: "E. coli"
Row 2: culture_id: C12345, culture_dttm: 2024-01-15 08:00:00, organism_name: "Klebsiella pneumoniae"
```

### microbiology_nonculture
*[Content to be added]*

### microbiology_susceptibility
*[Content to be added]*

### patient
**Composite Keys:** patient_id

**Key Transformations:**
- Race mapping

**Special Handling: Multiple Race Values**

When patients report multiple races, create separate rows for each race category:

**Example:**
```
Patient_id: 12345
race_name: "Caucasian | Asian"
```

**CLIF ETL Solution - Create duplicate rows:**
```
Row 1: Patient_id: 12345, race_category: "White"
Row 2: Patient_id: 12345, race_category: "Asian"
```

**Implementation Logic:**
```r
# Split multiple race values and create separate rows
patient_expanded <- patient_data %>%
  separate_rows(race_name, sep = "\\|") %>%
  mutate(race_name = str_trim(race_name)) %>%
  # Map each race to standardized category
  left_join(race_mapping_table, by = "race_name") %>%
  # Remove any unmapped races
  filter(!is.na(race_category))
```

**Rationale:**
- Preserves all race information without loss
- Enables proper statistical analysis of race distributions
- Follows CLIF principle of maintaining data granularity
- Avoids parsing concatenated strings in downstream analysis

### patient_assessments
*[Content to be added]*

### patient_procedures
*[Content to be added]*

### position

Position names are free text with variations that require standardization through regex pattern matching and logical consolidation of related position types.

#### Step 1: Identify Prone Positions
**Prone detection using regex:**
```r
mutate(prone = if_else(str_detect(position_name,
  regex("prone", ignore_case = TRUE)), 1, 0))
```

#### Step 2: Identify Supine-Type Positions
**Individual Position Detection:**
```r
supine = if_else(str_detect(position_name,
  regex("supin|supine", ignore_case = TRUE)), 1, NaN)
fowlers = if_else(str_detect(position_name,
  regex("fowler", ignore_case = TRUE)), 1, NaN)
sitting = if_else(str_detect(position_name,
  regex("sitting", ignore_case = TRUE)), 1, NaN)
```

#### Step 3: Consolidate Supine-Type
**Group related positions:**
```r
mutate(supine = if_else(
  str_detect(position_name,
    regex("fowler|trendelenburg|sitting", ignore_case = TRUE)),
  1, supine))
```

#### Step 4: Handle Missing Labels
When prone status is clear but supine label is missing, infer the supine status based on prone position.

**Missing Label Logic:**
```r
supine = if_else(is.na(supine) & prone == 0, 1, supine)
supine = if_else(is.na(supine) & prone == 1, 0, supine)
```

#### Position Categories
**Supine-Type Positions:**
- "Supine"
- "Fowlers" / "Semi-Fowlers"
- "Trendelenburg"
- "Sitting"


### respiratory_support
**Special Processing:**
- Device category assignment
- Mode-based overrides
- Hierarchical classification
- Conflict resolution

**Detailed Processing Steps:**

#### Overview
Device categories are assigned through a hierarchy of rules that coalesce multiple device name columns and apply device category logic with mode-based overrides.

#### Step 1: Coalesce Device Names
**Multiple device name columns:**
```r
mutate(device_name = coalesce(device_name, device_name_ed_rt,
                              device_name_ni, device_name_ed))
```

#### Step 2: Device Category Logic

**Invasive Mechanical Ventilation (IMV):**
```r
(grepl('Vent', device_name, ignore.case = TRUE)) &
  !grepl('Venturi Mask', device_name, ignore.case = TRUE) ~ 'IMV'
```

**Non-Invasive Positive Pressure:**
```r
grepl('NIPPV|Bipap', device_name, ignore.case = TRUE) ~ 'NIPPV'
```

**Other Categories:**
- CPAP → 'CPAP'
- High Flow NC → 'High Flow NC'
- Cannula → 'Nasal Cannula'
- Mask|Non-Rebreather → 'Face Mask'
- Room Air → 'Room Air'

#### Mode-Based Category Override
Mode names override device categories when conflicts exist. Ventilator modes can override device categories.

**Override Table:**
- "SIMV - PC PS" → "IMV"
- "A/C Volume" → "IMV"
- "CPAP" → "CPAP"
- "NIV-PC" → "NIPPV"
- "BiPAP" → "NIPPV"

#### Apply Overrides
```r
rclif_rs_final <- rclif_rs_final |>
  left_join(override_tbl, by = "mode_name") |>
  mutate(device_category = coalesce(device_cat_override, device_category))
```

#### Handling Multiple Devices at Same Timestamp

When different device names are recorded at the same `recorded_dttm`, use frequency-based hierarchy to resolve conflicts.


### vitals
**Quality Checks:**
- Range validation: Refer to [outlier_thresholds_adults_vitals.csv](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_adults_vitals.csv) for plausible ranges
- Remove exact duplicates by key fields
- Apply unit conversions as needed, with proper rounding
- Use [CLIF standardized units](https://clif-icu.com/data-dictionary/data-dictionary-2.1.0#vitals) for each vital sign (e.g., SpO₂ in %, MAP in mmHg)
