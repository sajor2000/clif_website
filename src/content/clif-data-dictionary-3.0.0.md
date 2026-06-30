## CLIF Data Dictionary

The CLIF Data Dictionary serves as a comprehensive guide to the Common Longitudinal ICU data Format, detailing the structure and purpose of each table within the framework. Designed to standardize and harmonize electronic health record data across multiple institutions, the dictionary outlines the entity-relationship model, variable definitions, and permissible values.

<br />

<iframe src="/images/data-dictionary/clif_erd_3.0.0.html" title="CLIF 3.0.0 interactive entity-relationship diagram" loading="lazy" allowfullscreen allow="fullscreen" style="width:100%;height:760px;border:1px solid #e6ded4;border-radius:10px"></iframe>

## Beta Tables

The table purpose, structure, and field names for beta tables is complete and used in at least one federated CLIF project. The minimum Common ICU Data Elements (mCIDE) for category variables is defined. Actively testing the table's practical use in projects. Breaking changes unlikely, but backward compatible updates in future minor versions possible


## adt
The admission, discharge, and transfer (adt) table is a start-stop longitudinal dataset that contains information about each patient's movement within the hospital. It also has a *`hospital_id`* field to distinguish between different hospitals within a health system. 

**Notes**:

* ADT represents the patient's physical location, NOT the patient "status".
* Procedural areas and operating rooms should be mapped to `Procedural`. Pre/Intra/Post-procedural/OR EHR data (such as anesthesia flowsheet records from Labs, Vitals, Scores, Respiratory Support) **are not currently** represented in CLIF.
* `room_id` and `bed_id` are free-text identifiers carried through from source EHR data — no standardization across sites is required. `bed_id` is optional.

\
**Example**:

| hospitalization_id | hospital_id | hospital_type | in_dttm | out_dttm | location_name | location_category | location_type | room_id | bed_id |
|-------------------|-------------|---------------|---------|----------|---------------|-------------------|----------------|---------|--------|
| 20010012 | ABC | academic | 2024-12-01 10:00:00+00:00 UTC | 2024-12-01 14:00:00+00:00 UTC | B06F | icu | general_icu | R142 | B3 |
| 20010012 | ABC | academic | 2024-12-01 14:30:00+00:00 UTC | 2024-12-02 08:00:00+00:00 UTC | B78D | ward | | R207 | B1 |
| 20010015 | ABC | academic | 2024-11-30 16:45:00+00:00 UTC | 2024-12-01 12:00:00+00:00 UTC | B06T | icu | general_icu | | |
| 20010015 | ABC | academic | 2024-12-01 12:30:00+00:00 UTC | 2024-12-02 07:00:00+00:00 UTC | N23E | procedural | | | |
| 20010020 | EFG | community | 2024-11-28 09:00:00+00:00 UTC | 2024-11-29 17:00:00+00:00 UTC | B78D | ward | | | |


## code_status

This table should represent what the clinician intends for the patients' limitations in care, not just what the EHR banner displays. It is **NOT** always equivalent to the code status display name in the EHR. 

**Notes**: 
- Sites will need to identify their code status orders. Additionally, sites may have separate orders for "comfort measures only" not found within the code status order that, if available, should be pulled to map it to `allow_natural_death`.


\
**Example**:

| patient_id | start_dttm                  | code_status_name   | code_status_category |
|------------|----------------------------|-------------------|---------------------|
| 123451     | 2024-12-01 08:30:00+00:00 UTC | Do Not Resuscitate| dnr                 |
| 123452     | 2024-12-02 14:00:00+00:00 UTC | Do Not Intubate   | dnr_or_dni             |
| 123451     | 2024-12-03 10:15:00+00:00 UTC | Full Code         | full                |


## renal_replacement_therapy

The renal_replacement_therapy table captures Renal Replacement Therapy (RRT) data across both Continuous Renal Replacement Therapy (CRRT) sub-modes and intermittent hemodialysis (IHD), including the different modalities, operational parameters, and fluid exchange details.

**Notes**: 
- **SCUF:** Slow Continuous Ultrafiltration
- **CVVH:** Continuous Veno-Venous Hemofiltration
- **CVVHD:** Continuous Veno-Venous Hemodialysis
- **CVVHDF:** Continuous Venous-Venous Hemodiafiltration
- **AVVH:** Accelerated Veno-venous Hemofiltration also called ARRT or PIIRT
- **IHD:** Intermittent Hemodialysis
- **IUF:** Isolated Ultrafiltration
\
**RRT Modalities and Parameter Usage**:

| **Modality**      | **Blood Flow Rate** | **Pre-Filter Replacement Rate** | **Post-Filter Replacement Rate** | **Dialysate Flow Rate** |
|-------------------|---------------------|---------------------------------|---------------------------------|-------------------------|
| **SCUF**          | Required            | Not Used                        | Not Used                        | Not Used                |
| **CVVH**          | Required            | Required                        | Required                        | Not Used                |
| **CVVHD**         | Required            | Not Used                        | Not Used                        | Required                |
| **CVVHDF**        | Required            | Required                        | Required                        | Required                |
| **AVVH (VVH)**    | Required            | May Be Used                     | May Be Used                     | Not Used                |
| **AVVH (VVHD)**   | Required            | Not Used                        | Not Used                        | May Be Used             |
| **AVVH (VVHF)**   | Required            | May Be Used                     | May Be Used                     | May Be Used             |
| **IHD**           | Required            | Not Used                        | Not Used                        | Required                |
| **IUF**           | Required            | Not Used                        | Not Used                        | Not Used                |

**Example**:
| hospitalization_id | device_id | dialysis_machine_name | recorded_dttm | mode_name | mode_category | blood_flow_rate | pre_filter_replacement_fluid_rate | post_filter_replacement_fluid_rate | dialysate_flow_rate | potassium_bath | calcium_bath |
|-------------------|-----------|--------------------------|---------------|----------------|-------------------|-----------------|-----------------------------------|------------------------------------|---------------------|----------------|--------------|
| 201 | J0 | NxStage by Baxter | 2024-02-15 07:00:00+00:00 UTC | CVVHDF | CVVHDF | 200.0 | 1000.0 | 500.0 | 800.0 | 2 | 1.5 |
| 202 | J0 | NxStage by Baxter | 2024-02-16 09:15:00+00:00 UTC | CVVH | CVVH | 180.0 | 1200.0 | 300.0 | NA | 4 | 2.5 |
| 203 | J0 | Fresenius 2008T | 2024-02-17 11:45:00+00:00 UTC | HD | IHD | 350.0 | NA | NA | 50000.0 | 2 | 3.0 |


## mcs

The MCS table is a long-form (one setting/measurement per row) longitudinal table that captures mechanical circulatory support (MCS) and ECMO device configuration and operational settings over time. Each row represents a single recorded setting or measurement at a point in time, identified by `setting_category` (e.g., `rpm`, `flow`, `sweep`, `fdo2`).

**Notes**:

- The table covers ECMO, LVAD, and RVAD support, distinguished by `support_category`.
- The `setting_name` / `setting_category` / `setting_value` tuple replaces the prior wide-format columns (`flow`, `sweep_set`, `fdO2_set`, `control_parameter_*`). To represent multiple settings recorded at the same `recorded_dttm`, emit one row per setting.
- `config_category` permissible values are conditional on `support_category` (e.g., `cp`, `2_5`, `5`, `5_5`, `rp`, `rp_flex` apply to `lvad` & `device_category == impella`; `heartware`, `heartmate2`, `heartmate3` apply to `lvad`; `central` applies to `lvad` or `rvad`).

**Example**:

| hospitalization_id | recorded_dttm                  | support_name | support_category | device_name | device_category | config_name  | config_category | setting_name | setting_category | setting_value |
|--------------------|--------------------------------|--------------|------------------|-------------|-----------------|--------------|-----------------|--------------|------------------|---------------|
| 123456             | 2026-01-01 12:00:00+00:00 UTC  | ECMO         | ecmo             | CARDIOHELP  | cardiohelp      | VA ECMO      | v_a             | RPM          | rpm              | 2700          |
| 123456             | 2026-01-01 12:00:00+00:00 UTC  | ECMO         | ecmo             | CARDIOHELP  | cardiohelp      | VA ECMO      | v_a             | Flow         | flow             | 4.2           |
| 123456             | 2026-01-01 12:00:00+00:00 UTC  | ECMO         | ecmo             | CARDIOHELP  | cardiohelp      | VA ECMO      | v_a             | Sweep        | sweep            | 4             |
| 123456             | 2026-01-01 12:00:00+00:00 UTC  | ECMO         | ecmo             | CARDIOHELP  | cardiohelp      | VA ECMO      | v_a             | FDO2         | fdo2             | 1             |
| 123456             | 2026-01-01 12:00:00+00:00 UTC  | LVAD         | lvad             | Impella     | impella         | Impella 5.5  | 5_5             | P            | performance      | 4             |
| 123456             | 2026-01-01 12:00:00+00:00 UTC  | LVAD         | lvad             | Impella     | impella         | Impella 5.5  | 5_5             | Flow         | flow             | 3.2           |
| 654321             | 2026-01-02 12:00:00+00:00 UTC  | ECMO         | ecmo             | CentriMag   | centrimag       | V-PA ECMO    | v_pa_single     | RPM          | rpm              | 2800          |
| 555555             | 2026-01-03 12:00:00+00:00 UTC  | RVAD         | rvad             | CentriMag   | centrimag       | RVAD         | v_pa_single     | RPM          | rpm              | 2800          |



## hospitalization

The hospitalization table contains information about each hospitalization event. Each row in this table represents a unique hospitalization event for a patient. This table is inspired by the [visit_occurance](https://ohdsi.github.io/CommonDataModel/cdm54.html#visit_occurrence) OMOP table but is specific to inpatient hospitalizations (including those that begin in the emergency room).


**Notes**:

- If a patient is discharged to Home/Hospice, then `discharge_category == hospice`.
- **Mortality Outcomes**: Mortality is identified by `discharge_category == "expired"`. Some studies also include `discharge_category == "hospice"` (i.e., both "expired" and "hospice") when defining death outcomes.
- The geographical indicators (`zipcode_nine_digit`, `zipcode_five_digit`, `census_block_code`, `census_block_group_code`, `census_tract`, `state_code`, `county_code`) should be added if they are available in your source dataset. `zipcode_nine_digit` is preferred over `zipcode_five_digit`, and `census_block_code` is ideal for census based indicators. The choice of geographical indicators may differ depending on the project.
- If a patient is transferred between different hospitals within a health system, a new `hospitalization_id` should be created.
- If a patient is initially seen in an ER in hospital A and then admitted to inpatient status in hospital B, one `hospitalization_id` should be created for data from both stays.
- A `hospitalization_joined_id` can also be created from a CLIF table from contiguous `hospitalization_ids`.
- **Geo-based Indices (ADI, SVI):**
    - *ADI*: Calculate the Area Deprivation Index at the census **block-group** level. Provide `census_block_group_code` when possible, or `zipcode_nine_digit` (9-digit ZIP) that can be cross-walked to a block group. Avoid using 5-digit ZIP or census-tract values for ADI—they are not validated and will add error.
    - *SVI*: The Social Vulnerability Index is published at `census_tract` (full 11-digit FIPS).  

\
**Example**:

| patient_id | hospitalization_id | hospitalization_joined_id | admission_dttm | discharge_dttm | age_at_admission | admission_type_name | admission_type_category | discharge_name | discharge_category | zipcode_five_digit | zipcode_nine_digit | census_block_group_code | latitude | longitude | fips_version |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 101001 | 12345678 | 22334455 | 2024-11-01 08:15:00+00:00 UTC | 2024-11-04 14:30:00+00:00 UTC | 65 | Direct admission | Inpatient | Discharged to Home or Self Care (Routine Discharge) | home | 60637 | 606370000 | 170313202001 | 41.81030 | -87.59697 | 2020 |
| 101002 | 87654321 | 22334455 | 2024-11-04 15:00:00+00:00 UTC | 2024-11-07 11:00:00+00:00 UTC | 72 | Transfer from another hospital | Acute Care Transfer | Transferred to Acute Inpatient Rehab Facility | acute_ip_rehab | 46311 | 463110000 | 170313301002 | 41.55030 | -87.30101 | 2020 |
| 101003 | 11223344 | 11223344 | 2024-10-20 07:45:00+00:00 UTC | 2024-10-22 10:20:00+00:00 UTC | 59 | Pre-op surgical | Pre-op | Expired | expired | 60446 | 604460000 | 170313401003 | 41.70010 | -87.60315 | 2020 |

## hospital_diagnosis

Finalized billing diagnosis codes for hospital reimbursement, e.g. calculation of a Diagnosis Related Group (DRG). These diagnoses also do not have timestamps, as they are often finalized after discharge. The `hospital_diagnosis` table is appropriate for calculation of comorbidity scores but should not be used as input features into a prediction model for an inpatient event.
\
All other diagnosis codes for a patient are included under concept table `patient_diagnosis` which has start and end timestamps.

**Example**:
| hospitalization_id | diagnosis_code | diagnosis_code_format | diagnosis_primary | poa_present |
|-------------------|----------------|----------------------|------------------|-------------|
| 20010012          | I10            | ICD10CM              | 1                | 1           |
| 20010012          | E11.9          | ICD10CM              | 0                | 0           |
| 20010015          | 250.00         | ICD9CM               | 1                | 1           |
| 20010015          | 401.9          | ICD9CM               | 0                | 0           |
| 20010020          | J45.909        | ICD10CM              | 1                | 1           |
| 20010020          | 530.81         | ICD9CM               | 0                | 1           |


## invasive_hemodynamics

The `invasive_hemodynamics` table records invasive hemodynamic measurements during a patient’s hospitalization. These measurements represent pressures recorded via invasive monitoring and are expressed in millimeters of mercury (mmHg).


**Notes**:

- `measurement_value` is interpreted in the units defined by `measurement_category` (mmHg for pressures, L/min for cardiac output, L/min/m² for indices, etc.).
- The `measurement_category` field standardizes invasive hemodynamic data:

| measurement_category | Maps from | Expected value |
|----------------------|-----------|----------------|
| `cvp` | Central Venous Pressure, Right Atrial Pressure (mmHg) | 0–50 |
| `rv_systolic` | Right Ventricular Systolic Pressure (mmHg) | 0–200 |
| `rv_diastolic` | Right Ventricular Diastolic Pressure (mmHg) | Less than `rv_systolic` |
| `pa_systolic` | Pulmonary Artery Systolic Pressure (mmHg) | 0–200 |
| `pa_diastolic` | Pulmonary Artery Diastolic Pressure (mmHg) | 0–200 |
| `pa_mean` | Pulmonary Artery Mean Pressure (mmHg) | Less than `pa_systolic` and greater than `pa_diastolic` |
| `pcwp` | Pulmonary Capillary Wedge Pressure (mmHg) | 0–100 |
| `cco` | Continuous Cardiac Output (L/min) | 0–30 |
| `co_thermodilution` | Cardiac Output by Thermodilution (L/min) | 0–30 |
| `co_index` | Cardiac Index (L/min/m²) | 0.1–10 |
| `co_fick` | Cardiac Output by Fick Equation (L/min) | 0–30 |
| `sv` | Stroke Volume (mL) | 0–200 |
| `svv` | Stroke Volume Variance (mm/Hg) | 0–200 |
| `sv_index` | Stroke Volume Index (mL/m²) | 0–200 |
| `svr` | Systemic Vascular Resistance / Total Peripheral Resistance | 100–10000 |
| `svr_index` | Systemic Vascular Resistance Index / Total Peripheral Resistance Index | 100–10000 |
| `evlw` | Extravascular Lung Water (mL) | 0–1000 |
| `evlw_index` | Extravascular Lung Water Index (mL/kg) | 0–1000 |
| `gef` | Global Ejection Fraction (%) | 0–100 |
| `itbv_index` | Intrathoracic Blood Volume Index (mL/m²) | 0–5000 |
| `gedv` | Global End-diastolic Volume (mL) | 0–5000 |
| `gedv_index` | Global End-diastolic Volume Index (mL/m²) | 0–5000 |
| `lvsw_index` | Left Ventricular Stroke Work Index (J/m²) | 0–5000 |
| `tfcd0` | Thoracic Fluid Content delta from baseline (%) | 0–100 |
| `tfc` | Thoracic Fluid Content (mL) | 0–100 |
| `do2` | Delivery of Oxygen (mL/min/m²) | 100–10000 |

\
**Example**:

| hospitalization_id | recorded_dttm                  | measurement_name                    | measurement_category | measurement_value |
|--------------------|--------------------------------|-------------------------------------|----------------------|-------------------|
| 1234               | 2026-04-08 23:30:00+00:00 UTC  | Central Venous Pressure             | cvp                  | 5                 |
| 1234               | 2026-04-08 23:30:00+00:00 UTC  | Pulmonary Artery Pressure systolic  | pa_systolic          | 20                |
| 1234               | 2026-04-08 23:30:00+00:00 UTC  | Pulmonary Artery Pressure diastolic | pa_diastolic         | 6                 |
| 1234               | 2026-04-08 23:30:00+00:00 UTC  | Pulmonary Artery Pressure mean      | pa_mean              | 11                |
| 1234               | 2026-04-08 23:30:00+00:00 UTC  | Cardiac Index                       | co_index             | 2.9               |


## labs

The labs table is a long form (one lab result per row) longitudinal table. 

**Notes**:

- All lab values must be reported using the lab's *reference units* linked above in permissible values. Only the listed reference units are permissible for respective lab categories in the CLIF labs table. Sites must ensure that any raw laboratory values are converted to the reference units during the ETL process. Entries with other units must be transformed prior to loading into CLIF.
- The `lab_value` field often has non-numeric entries that are useful to make project-specific decisions. A site may choose to keep the `lab_value` field as a character and create a new field `lab_value_numeric` that only parses the character field to extract the numeric part of the string.
- For fluid-panel and source-specific labs, the **analyte** name is stored in `lab_category` (e.g. `ldh`, `creatinine`, `amylase`) and the fluid it was run on is captured in `lab_specimen_category` (`plasma_blood`, `pleural`, `peritoneal`, `urine`, `bal`). The same `lab_category` can therefore appear with different specimen sources and order panels — the panel is recorded in `lab_order_category`.

\
**Example**:

| hospitalization_id | lab_order_dttm         | lab_collect_dttm        | lab_result_dttm         | lab_order_name                | lab_order_category | lab_name         | lab_category | lab_value | lab_value_numeric | reference_unit | lab_specimen_name | lab_specimen_category | lab_loinc_code | loinc_version |
|-------------------|------------------------|-------------------------|-------------------------|-------------------------------|--------------------|------------------|-------------|----------|------------------|----------------|-------------------|----------------------|---------------|--------------|
| 1001014           | 2023-05-01 07:00:00+00:00 UTC | 2023-05-01 07:15:00+00:00 UTC | 2023-05-01 08:00:00+00:00 UTC | Complete blood count w/ diff  | cbc                | WBC              | wbc                  | 8.2      | 8.2              | 10^3/µl        | blood             | plasma_blood         | 6690-2        | 1.0          |
| 1001014           | 2023-05-01 07:00:00+00:00 UTC | 2023-05-01 07:15:00+00:00 UTC | 2023-05-01 08:00:00+00:00 UTC | Complete blood count w/ diff  | cbc                | HGB              | hemoglobin            | 13.5     | 13.5             | g/dl           | blood             | plasma_blood         | 718-7         | 1.0          |
| 1002025           | 2023-06-10 08:30:00+00:00 UTC | 2023-06-10 08:45:00+00:00 UTC | 2023-06-10 09:00:00+00:00 UTC | Basic metabolic panel         | bmp                | Sodium           | sodium               | 140      | 140              | mmol/l         | blood             | plasma_blood         | 2951-2        | 1.0          |
| 1002025           | 2023-06-10 08:30:00+00:00 UTC | 2023-06-10 08:45:00+00:00 UTC | 2023-06-10 09:00:00+00:00 UTC | Basic metabolic panel         | bmp                | Potassium        | potassium            | 4.2      | 4.2              | mmol/l         | blood             | plasma_blood         | 2823-3        | 1.0          |
| 1003036           | 2023-07-15 06:45:00+00:00 UTC | 2023-07-15 07:00:00+00:00 UTC | 2023-07-15 07:30:00+00:00 UTC | Liver function panel          | lft                | AST (SGOT)       | ast                  | 35       | 35               | u/l            | blood             | plasma_blood         | 1920-8        | 1.0          |
| 1003036           | 2023-07-15 06:45:00+00:00 UTC | 2023-07-15 07:00:00+00:00 UTC | 2023-07-15 07:30:00+00:00 UTC | Liver function panel          | lft                | ALT (SGPT)       | alt                  | 28       | 28               | u/l            | blood             | plasma_blood         | 1742-6        | 1.0          |
| 1004047           | 2023-08-20 10:00:00+00:00 UTC | 2023-08-20 10:20:00+00:00 UTC | 2023-08-20 11:15:00+00:00 UTC | Pleural fluid LDH             | pleural_fluid_panel | PLEURAL FLUID LDH | ldh                 | 180      | 180              | u/l            | pleural fluid     | pleural              |               |              |
| 1005058           | 2023-09-05 06:30:00+00:00 UTC | 2023-09-05 06:30:00+00:00 UTC | 2023-09-05 07:00:00+00:00 UTC | Urine creatinine              | urine_chemistry    | URINE CREATININE | creatinine           | 95       | 95               | mg/dl          | urine             | urine                |               |              |


## medication_admin_intermittent

This table captures medications administered as fixed doses at discrete time points. Examples include antibiotics, steroids, and other medications given as boluses or scheduled doses. Each row represents ONE observation for each medication administered.

This table has exactly the same schema as [`medication_admin_continuous`](#medication-admin-continuous). The consortium decided to separate the medications that are administered intermittently from the continuously administered medications. In 3.0, the `med_dose_unit` is **standardized per `med_category`** — every `med_category` in the [intermittent mCIDE](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/3.0/mCIDE/medication_admin_intermittent/clif_medication_admin_intermittent_med_categories.csv) is tied to a fixed dose unit drawn from a closed set: `mg`, `g`, `mcg`, `mmol`, `ml`, `meq`, `cells`. Raw EHR doses should be converted into the category-specific unit (e.g. an `ampicillin` row charted as `2000 mg` should be ingested as `2 g`).

**Example**:

| hospitalization_id | administering_provider_id | admin_dttm                    | med_name                              | med_category            | med_group                          | med_route_name | med_route_category | med_dose | med_dose_unit | mar_action_name | mar_action_category |
|--------------------|---------------------------|-------------------------------|---------------------------------------|-------------------------|------------------------------------|----------------|--------------------|----------|---------------|-----------------|---------------------|
| 792391             | PROV2087                  | 2123-11-13 12:28:00+00:00 UTC | ACETAMINOPHEN 1000 MG IV Q6H          | acetaminophen           | analgesia                          | Intravenous    | iv                 | 1000     | mg            | Given           | administered        |
| 792391             | PROV2087                  | 2123-11-13 14:00:00+00:00 UTC | CEFEPIME 2 GM IV Q8H                  | cefepime                | cms_sepsis_qualifying_antibiotics  | Intravenous    | iv                 | 2        | g             | Given           | administered        |
| 370921             | PROV3391                  | 2123-02-12 03:07:00+00:00 UTC | POTASSIUM CHLORIDE 40 MEQ IV PRN      | potassium_chloride      | fluids_electrolytes                | Intravenous    | iv                 | 40       | mmol          | Given           | administered        |
| 702344             | PROV5502                  | 2123-04-27 04:30:00+00:00 UTC | BLINATUMOMAB 28 MCG IV INFUSION       | blinatumomab            | other                              | Intravenous    | iv                 | 28       | mcg           | Given           | administered        |
| 702344             | PROV5502                  | 2123-04-27 06:00:00+00:00 UTC | AXICABTAGENE CILOLEUCEL 2X10^6 CAR+ T | axicabtagene_ciloleucel | car_t                              | Intravenous    | iv                 | 2000000  | cells         | Given           | administered        |

**Notes**:
- Continuous medications are included in this table when given as boluses.
- The `med_dose_unit` constraint is per-category — sites cannot mix units within a single `med_category`.

## medication_admin_continuous

This table captures medications administered at a rate over time, with NO set dose to be given. Examples include vasopressors, sedation, and paralysis drips. Multiple observations capture how the medication rate varies over time.

The medication admin continuous table is a long-form (one medication administration record per) longitudinal table designed for continuous infusions of common ICU medications such as vasopressors and sedation (Boluses of these drugs should be recorded in `med_admin_intermittent`). Note that it only reflects dose changes of the continuous medication and does not have a specific "end_time" variable to indicate the medication being stopped. The end of a continuous infusion should be recorded as a new row with med_dose = 0 and an appropriate mar_action_name (e.g. "stopped" or "paused").

**Example**:

| hospitalization_id | administering_provider_id | admin_dttm                | med_name                                                           | med_category  | med_group     | med_route_name | med_route_category | med_dose | med_dose_unit | volume_infusion_rate | volume_infusion_rate_unit | mar_action_name | mar_action_group      |
|-------------------|---------------------------|---------------------------|--------------------------------------------------------------------|---------------|---------------|----------------|-------------------|----------|---------------|---------------|---------------------|----------------|----------------------|
| 792391            | PROV2087                  | 2123-11-13 12:28:00+00:00 UTC | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION                            | propofol      | sedation      | Intravenous    | NA                | 75.0000  | mcg/kg/min    | 45.0          | mL/hr               | New Bag        | administered         |
| 792391            | PROV2087                  | 2123-11-13 13:49:00+00:00 UTC | REMIFENTANIL CONTINUOUS IV (ANESTHESIA)                           | remifentanil  | sedation      | NA             | NA                | 0.0500   | mcg/kg/min    | 12.5          | mL/hr               | New Bag        | administered         |
| 792391            | PROV2087                  | 2123-11-13 14:03:00+00:00 UTC | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION                            | propofol      | sedation      | Intravenous    | NA                | 0.0000   | mcg/kg/min    | 0.0           | mL/hr               | Stopped        | not_administered     |
| 370921            | PROV3391                  | 2123-02-12 03:07:00+00:00 UTC | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE    | phenylephrine | vasoactives   | Intravenous    | NA                | 20.0000  | mcg/min       | 10.0          | mL/hr               | New Bag        | administered         |
| 370921            | PROV3391                  | 2123-02-12 03:14:00+00:00 UTC | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE    | phenylephrine | vasoactives   | Intravenous    | NA                | 50.0000  | mcg/min       | 25.0          | mL/hr               | Rate Change    | administered         |
| 702344            | PROV5502                  | 2123-04-27 04:30:00+00:00 UTC | HEPARIN (PORCINE) 25,000 UNIT/250 ML IN 0.45 % SODIUM CHLORIDE    | heparin       | anticoagulation| Intravenous    | NA                | 18.0000  | Units/kg/hr   | 18.0          | mL/hr               | New Bag        | administered         |


**Notes**:

- Include combination medications when mapping medication names to respective categories. Eg. `ACETAMIN-CALCIUM-MAG-CAFFEINE ORAL` -> `acetaminophen`
- Include trial drugs when mapping medication names to respective categories.. Eg. `ACETAMINOPHEN (IRB 140122) 325 MG ORAL TAB` -> `acetaminophen`

## microbiology_culture

The microbiology culture table is a longitudinal table in long format that captures the order, collection, and result times of microbiology cultures and gram stains. Positive workups can produce multiple `result_dttm` rows as preliminary, genus-level, and species-level identifications are reported, all sharing the same `order_dttm` and `collect_dttm`. Negative workups are stored as a single row per workup. To filter a positive culture to its latest state, take `max(result_dttm)` per `organism_id`.

**Example**:

| patient_id | hospitalization_id | organism_id | order_dttm                | collect_dttm              | result_dttm               | fluid_name                | fluid_category     | method_name     | method_category | organism_name                   | organism_category      | organism_group                                                 | lab_loinc_code |
|------------|-------------------|-------------|---------------------------|---------------------------|---------------------------|---------------------------|--------------------|-----------------|-----------------|--------------------------------|------------------------|----------------------------------------------------------------|---------------|
| 12345      | HOSP12345         | ORG001      | 2025-06-05 08:15:00+00:00 | 2025-06-05 08:45:00+00:00 | 2025-06-05 14:30:00+00:00 | AFB/FUNGAL BLOOD CULTURE | Blood/Buffy Coat   | Blood culture   | culture         | Gram-negative rods              | gram_negative_rod      | gram_negative_rod                                              |               |
| 12345      | HOSP12345         | ORG001      | 2025-06-05 08:15:00+00:00 | 2025-06-05 08:45:00+00:00 | 2025-06-06 09:15:00+00:00 | AFB/FUNGAL BLOOD CULTURE | Blood/Buffy Coat   | Blood culture   | culture         | Acinetobacter species           | acinetobacter_sp       | acinetobacter (baumanii, calcoaceticus, lwoffi, other species) |               |
| 12345      | HOSP12345         | ORG001      | 2025-06-05 08:15:00+00:00 | 2025-06-05 08:45:00+00:00 | 2025-06-06 12:00:00+00:00 | AFB/FUNGAL BLOOD CULTURE | Blood/Buffy Coat   | Blood culture   | culture         | Acinetobacter baumanii          | acinetobacter_baumanii | acinetobacter (baumanii, calcoaceticus, lwoffi, other species) |               |
| 12345      | HOSP12345         | ORG002      | 2025-06-05 08:15:00+00:00 | 2025-06-05 08:45:00+00:00 | 2025-06-06 12:00:00+00:00 | AFB/FUNGAL BLOOD CULTURE | Blood/Buffy Coat   | Blood culture   | culture         | Candida albicans                | candida_albicans       | candida albicans                                               |               |
| 67890      | HOSP67890         | ORG003      | 2025-06-10 14:10:00+00:00 | 2025-06-10 14:35:00+00:00 | 2025-06-11 09:20:00+00:00 | BRAIN BIOPSY CULTURE     | Brain              | Tissue culture  | culture         | Aspergillus fumigatus           | aspergillus_fumigatus  | asperguillus fumigatus                                         |               |
| 24680      | HOSP24680         |             | 2025-06-12 18:00:00+00:00 | 2025-06-12 18:20:00+00:00 | 2025-06-17 18:20:00+00:00 | URINE CULTURE            | Urine              | Urine culture   | culture         | No growth                       | no_growth              | no_growth                                                      |               |
| 24680      | HOSP24680         | ORG005      | 2025-06-12 18:00:00+00:00 | 2025-06-12 18:20:00+00:00 | 2025-06-12 18:35:00+00:00 | SPUTUM GRAM STAIN        | Sputum             | Gram stain      | gram_stain      | Gram-positive cocci in clusters | gram_positive_cocci    | gram_positive_cocci                                            |               |

## patient

This table contains demographic information about the patient that does not vary between hospitalizations. It is inspired by the OMOP [Person](https://ohdsi.github.io/CommonDataModel/cdm54.html#person) table


**Example**:
| patient_id | race_name                  | race_category              | ethnicity_name                                    | ethnicity_category | sex_category | birth_date  | death_dttm | language_name | language_category | language_interpreter |
|------------|---------------------------|---------------------------|--------------------------------------------------|-------------------|--------------|-------------|------------|---------------|------------------|----------------------|
| 132424     | Black or African-American | black_or_african_american | Not Hispanic, Latino/a, or Spanish origin        | non_hispanic      | male         | 2145-05-09  | NA         | English       | english          | 0                    |
| 132384     | White                     | white                     | Not Hispanic, Latino/a, or Spanish origin        | non_hispanic      | female       | 2145-03-30  | NA         | English       | english          | 0                    |
| 542367     | Black or African-American | black_or_african_american | Not Hispanic, Latino/a, or Spanish origin        | non_hispanic      | male         | 2145-01-29  | NA         | Spanish       | spanish          | 1                    |
| 989862     | White                     | white                     | Not Hispanic, Latino/a, or Spanish origin        | non_hispanic      | female       | 2145-11-06  | NA         | English       | english          | 0                    |
| 428035     | More than one Race        | other                     | Not Hispanic, Latino/a, or Spanish origin        | non_hispanic      | male         | 2145-10-13  | NA         | Mandarin      | chinese | 1                    |


## patient_assessments

The patient_assessments table captures various assessments performed on patients across different domains, including neurological status, sedation levels, pain, and withdrawal. The table is designed to provide detailed information about the assessments, such as the name of the assessment, the category, and the recorded values.

**Example**:
| hospitalization_id | administering_provider_id | recorded_dttm                | assessment_name                                | assessment_category    | assessment_group | numerical_value | categorical_value | text_value |
|-------------------|--------------------------|----------------------------|----------------------------------------------|---------------------|----------------|----------------|-----------------|------------|
| 12345             | PROV2087                 | 2024-12-01 08:15:00+00:00 UTC | NUR RA GLASGOW ADULT EYE OPENING             | gcs_eye            | Neurological   | 4              | NA              | NA         |
| 12345             | PROV2087                 | 2024-12-01 08:15:00+00:00 UTC | NUR RA GLASGOW ADULT VERBAL RESPONSE         | gcs_verbal         | Neurological   | 5              | NA              | NA         |
| 12345             | PROV2087                 | 2024-12-01 08:15:00+00:00 UTC | NUR RA GLASGOW ADULT BEST MOTOR RESPONSE     | gcs_motor          | Neurological   | 6              | NA              | NA         |
| 12345             | PROV2087                 | 2024-12-01 08:15:00+00:00 UTC | NUR RA GLASGOW ADULT SCORING                 | gcs_total          | Neurological   | 15             | NA              | NA         |
| 67890             | PROV3391                 | 2024-12-01 10:30:00+00:00 UTC | BRADEN ASSESSMENT                            | braden_total       | Nursing Risk   | 18             | NA              | NA         |
| 67890             | PROV3391                 | 2024-12-01 10:30:00+00:00 UTC | SAT SCREEN                                   | sat_delivery_pass_fail | Sedation     | NA             | Pass            | NA         |

## patient_diagnosis

The `patient_diagnosis` table provides a record of all diagnoses assigned to a patient. 
    

**Example**:

| patient_id | hospitalization_id | diagnosis_code | diagnosis_code_format | source_type     | start_dttm                  | end_dttm                    |
|------------|-------------------|---------------|----------------------|-----------------|-----------------------------|-----------------------------|
| PAT1001    | HOSP1001          | I10           | ICD10CM              | problem_list    | 2024-01-01 08:00:00+00:00   | NULL                        |
| PAT1001    | HOSP1001          | E11.9         | ICD10CM              | encounter_dx    | 2024-01-01 08:00:00+00:00   | 2024-01-10 12:00:00+00:00   |
| PAT1002    | HOSP1002          | J18.9         | ICD10CM              | medical_history | 2024-01-05 09:30:00+00:00   | NULL                        |
| PAT1003    | HOSP1003          | N17.9         | ICD10CM              | encounter_dx    | 2024-01-10 07:00:00+00:00   | 2024-01-15 10:00:00+00:00   |


## patient_procedures

A long table of standardized procedural billing codes associated with the hospitalization, using the [Healthcare Common Procedure Coding System (HCPCS)](https://www.cms.gov/medicare/regulations-guidance/physician-self-referral/list-cpt-hcpcs-codes). The `patient_procedures` table includes only procedures that were actually performed or completed (not cancelled), and contains **all CPT codes (HCPCS Level 1)**—both those billed by clinicians (professional billing) and those recorded in hospital billing encounters (e.g., PT/OT codes).
\
Hospital billing i.e., **Products, supplies, and services that do not have CPT codes (HCPCS Level 2)** are not included in this table.
\
Additionally, this table contains [ICD-10-PCS](https://www.cms.gov/medicare/coding-billing/icd-10-codes) procedure codes which are not used for clinician billing but can contribute to the calculation of DRGs for hospital reimbursement and can also appear in the `hospital_diagnosis` table.


**Example**:

| hospitalization_id | billing_provider_id | performing_provider_id | procedure_code | procedure_code_format | procedure_billed_dttm           |
|--------------------|--------------------|-----------------------|----------------|----------------------|----------------------------------|
| HOSP1001           | BP123              | PP456                 | 36556          | CPT                  | 2024-01-01 08:00:00+00:00 UTC    |
| HOSP1001           | BP123              | PP789                 | 32551          | CPT                  | 2024-01-01 10:00:00+00:00 UTC    |
| HOSP1002           | BP234              | PP890                 | G0009          | HCPCS                | 2024-01-05 09:30:00+00:00 UTC    |
| HOSP1002           | BP234              | PP890                 | G0008          | HCPCS                | 2024-01-05 11:00:00+00:00 UTC    |
| HOSP1003           | BP345              | PP901                 | 36620          | CPT                  | 2024-01-10 07:00:00+00:00 UTC    |



## position

The position table is a long form (one position per row) longitudinal table that captures all documented position changes of the patient. The table is designed for the explicit purpose of constructing the `position_category` CDE and identifying patients in prone position.

**Example**:
| hospitalization_id | recorded_dttm                | position_name                                                | position_category |
|-------------------|----------------------------|-------------------------------------------------------------|------------------|
| 84                | 2123-06-20 00:00:00+00:00 UTC | Supine–turn R                                               | not_prone        |
| 84                | 2123-06-20 06:00:00+00:00 UTC | Supine–turn L                                               | not_prone        |
| 84                | 2123-06-20 12:00:00+00:00 UTC | Supine–back                                                 | not_prone        |
| 84                | 2123-06-20 16:00:00+00:00 UTC | Supine–turn R                                               | not_prone        |
| 84                | 2123-06-20 20:00:00+00:00 UTC | Supine–back;Supine–turn intolerant                          | not_prone        |
| 84                | 2123-06-20 22:00:00+00:00 UTC | Supine–turn intolerant,microturn L                          | not_prone        |
| 84                | 2123-06-20 00:00:00+00:00 UTC | Supine–turn intolerant,microturn L;Supine–back              | not_prone        |
| 84                | 2123-06-20 01:10:00+00:00 UTC | 30 Degrees                                                  | not_prone        |


## respiratory_support

The respiratory support table is a wider longitudinal table that captures simultaneously recorded ventilator settings and observed ventilator parameters. The table is designed to capture the most common respiratory support devices and modes used in the ICU. It will be sparse for patients who are not on mechanical ventilation.


**Notes**:

**Expected setting values for each device_category and mode_category**

- `device_category` == "imv"

| ventilator_setting        | acvc | ps_or_cpap | pressure_control | prvc | simv | volume_support |
|--------------------------|:----------------------------:|:---------------------:|:---------------:|:-------------------------------:|:----:|:-------------:|
| fio2_set                 | E                            | E                     | E               | E                               | E    | E             |
| tidal_volume_set         | E                            |                       |                 | E                               | P    | E             |
| resp_rate_set            | E                            |                       | E               | E                               | E    |               |
| pressure_control_set     |                              |                       | E               |                                 | P    |               |
| pressure_support_set     |                              | E                     |                 |                                 | E    |               |
| flow_rate_set            | P                            |                       |                 |                                 | P    |               |
| inspiratory_time_set     | P                            |                       | E               |                                 | P    |               |
| peep_set                 | E                            | E                     | E               | E                               | E    | E             |

E = Expected ventilator setting for the mode, P = possible ventilator setting for the mode.

- `device_category` == "nippv"

`mode_category` is `ps_or_cpap` and the `fio2_set`, `peep_set`, and either `pressure_support_set` OR `peak_inspiratory_pressure_set` (IPAP) is required.

- `device_category` == "cpap"

`mode_category` is `ps_or_cpap` and the `fio2_set` and `peep_set` are required.

- `device_category` == "hfnc"

`mode_category` is NA and the `fio2_set` and `lpm_set` are required.

- `device_category` == "face_mask"

`mode_category` is NA
`lpm_set` is required.
`fio2_set` is possible.

- `device_category` == "trach_collar" or "nasal_cannula"

`mode_category` is NA
`lpm_set` is required


**Example**:

| hospitalization_id | recorded_dttm           | device_name | device_id | device_category | mode_name         | mode_category                | vent_brand_name | tracheostomy | fio2_set | lpm_set | tidal_volume_set | resp_rate_set | pressure_control_set | pressure_support_set | flow_rate_set | tidal_volume_obs | resp_rate_obs | plateau_pressure_obs | peak_inspiratory_pressure_obs | peep_obs | minute_vent_obs | mean_airway_pressure_obs |
|-------------------|-------------------------|-------------|-----------|-----------------|-------------------|------------------------------|-----------------|--------------|----------|---------|------------------|---------------|----------------------|----------------------|---------------|------------------|---------------|----------------------|-----------------------------|----------|-----------------|-------------------------|
| 12345             | 2024-12-01 08:00:00+00:00 UTC | Ventilator   | DEV001    | imv             | CMV Volume Ctrl   | acvc| Vent A          | 1            | 0.50     | 40      | 500              | 18            | 15                   | 5                    | 50            | 450              | 18            | 20                   | 25                          | 5        | 9.0             | 12.0                    |
| 12345             | 2024-12-01 09:00:00+00:00 UTC | Ventilator   | DEV001    | imv             | SIMV              | simv                         | Vent A          | 1            | 0.45     | 35      | 480              | 20            | 18                   | 8                    | 55            | 470              | 20            | 21                   | 28                          | 6        | 10.5            | 14.0                    |
| 67890             | 2024-12-01 10:30:00+00:00 UTC | HFNC         | DEV002    | hfnc    | N/A               | other                        | N/A             | 0            | 0.30     | 60      | NA               | NA            | NA                   | NA                   | 60            | NA               | NA            | NA                   | NA                          | NA       | NA              | NA                      |
| 67890             | 2024-12-01 11:00:00+00:00 UTC | CPAP         | DEV003    | cpap            | CPAP              | ps_or_cpap        | CPAP X          | 0            | 0.40     | 50      | NA               | NA            | NA                   | 10                   | NA            | NA               | NA            | NA                   | NA                          | 8        | NA              | NA                      |

## vitals

The vitals table is a long-form (one vital sign per row) longitudinal table.

**Notes**:

- `measured_dttm` is optional. It captures when the vital was actually measured at the bedside, which can differ from `recorded_dttm` (the EHR entry time) — for example, vitals written down on paper and entered later at shift change. Sites whose source data does not distinguish the two timestamps may omit this column or leave it null.

**Example**:

| hospitalization_id | recorded_dttm                | measured_dttm                | vital_name                   | vital_category   | vital_value | meas_site_name |
|-------------------|------------------------------|------------------------------|------------------------------|-----------------|-------------|----------------|
| 20010012          | 2024-12-01 08:00:00+00:00 UTC | 2024-12-01 08:00:00+00:00 UTC | HEIGHT                       | height_cm       | 170.0      | unspecified    |
| 20010012          | 2024-12-01 08:15:00+00:00 UTC | 2024-12-01 08:15:00+00:00 UTC | WEIGHT                       | weight_kg       | 70.0       | unspecified    |
| 20010012          | 2024-12-01 08:30:00+00:00 UTC | 2024-12-01 08:28:00+00:00 UTC | PULSE                        | heart_rate      | 72.0       | unspecified    |
| 20010012          | 2024-12-01 08:45:00+00:00 UTC | 2024-12-01 08:42:00+00:00 UTC | BLOOD PRESSURE (SYSTOLIC)    | sbp             | 120.0      | unspecified    |
| 20010012          | 2024-12-01 08:45:00+00:00 UTC | 2024-12-01 08:42:00+00:00 UTC | BLOOD PRESSURE (DIASTOLIC)   | dbp             | 80.0       | unspecified    |
| 20010012          | 2024-12-01 08:50:00+00:00 UTC |                              | RESPIRATORY RATE             | respiratory_rate| 16.0       | unspecified    |
| 20010012          | 2024-12-01 09:00:00+00:00 UTC | 2024-12-01 08:55:00+00:00 UTC | TEMPERATURE                  | temp_c          | 36.8       | unspecified    |
| 20010012          | 2024-12-01 09:15:00+00:00 UTC | 2024-12-01 09:15:00+00:00 UTC | SPO2                         | spo2            | 98.0       | unspecified    |
| 20010013          | 2024-12-01 09:30:00+00:00 UTC | 2024-12-01 09:30:00+00:00 UTC | MEAN ARTERIAL PRESSURE (MAP) | map             | 85.0       | arterial       |


## Alpha Tables

Constructed at least partially at one site, but not yet used in a federated project. The table structure and mCIDE elements are taking shape based on real implementation experience, though the table has not yet been tested across sites. Changes remain likely as the design is validated against additional sites.

## Concept Tables

A planned future CLIF table that has yet to be used in a federated project. The table structure and CDE elements are in draft form. Permissible values of category variables may still need to be defined. Seeking conceptual feedback. Significant changes to all aspects of the table are possible.

## input

The input table captures patient fluid intake events during hospitalization. Each row represents a single recorded input event with the fluid name, a standardized category, and the volume in mL. This table replaces the intake side of the former `intake_output` table; the output side is captured in the separate `output` table.

**Notes**:
- The `input_category` field maps `input_name` to a controlled vocabulary defined in the input_category mCIDE dictionary
- `input_category` values roll up into `input_group` for higher-level aggregation (e.g., iv_fluids, blood_products, nutrition)

**Example**:

| hospitalization_id | recorded_dttm                     | input_name         | input_category       | input_group               | input_volume | lda_id     |
|-------------------|-----------------------------------|--------------------|----------------------|---------------------------|--------------|------------|
| 1001              | 2024-01-01 08:00:00+00:00 UTC     | Normal Saline      | iv_crystalloid       | iv_fluids                 | 500          |            |
| 1001              | 2024-01-01 10:30:00+00:00 UTC     | Lactated Ringer's  | iv_crystalloid       | iv_fluids                 | 1000         |            |
| 1002              | 2024-01-05 09:15:00+00:00 UTC     | PRBC               | blood_products       | blood_products            | 350          |            |
| 1002              | 2024-01-05 14:00:00+00:00 UTC     | TPN                | parenteral_nutrition | nutrition                 | 250          |            |
| 1003              | 2024-01-10 07:45:00+00:00 UTC     | Tube Feed          | enteral_nutrition    | nutrition                 | 600          | LDA-NG01   |
| 1003              | 2024-01-10 12:00:00+00:00 UTC     | Free Water Flush   | enteral_water        | nutrition                 | 200          | LDA-NG01   |


## intermittent_dialysis

The intermittent_dialysis table captures intermittent hemodialysis sessions during hospitalization. 

**Notes**:
- Each dialysis session will have **multiple rows** (one per recorded measurement)

\
**Example**:

| hospitalization_id | device_id | recorded_dttm | blood_flow_rate | dialysate_flow_rate | net_ultrafiltration_out |
|-------------------|-----------|---------------|-----------------|---------------------|-------------------------|
| 30010001 | HD-A1 | 2024-03-10 08:00:00+00:00 UTC | 250.0 | 500.0 | 0.0 |
| 30010001 | HD-A1 | 2024-03-10 08:30:00+00:00 UTC | 300.0 | 500.0 | 200.0 |
| 30010001 | HD-A1 | 2024-03-10 09:00:00+00:00 UTC | 300.0 | 500.0 | 450.0 |
| 30010001 | HD-A1 | 2024-03-10 11:30:00+00:00 UTC | 0.0 | 0.0 | 1500.0 |
| 30010002 | HD-B3 | 2024-03-11 07:00:00+00:00 UTC | 200.0 | 400.0 | 0.0 |
| 30010002 | HD-B3 | 2024-03-11 07:30:00+00:00 UTC | 250.0 | 400.0 | 150.0 |


## consult_orders



The `consult_orders` table captures consult and service orders placed during ICU stays — including PT, OT, speech, social work, nutrition, palliative care, and other consult services. It includes details about the hospitalization, the timing of the order, the specific name of the order, its standardized category, and the standardized status of the order. CLIF does not dictate which type of clinician performs the consult/service.

**Notes**:

- This table, together with `misc_icu_orders`, replaces the former `key_icu_orders` table ([issue #218](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/issues/218)). Both tables share identical fields and differ only in the kinds of orders each contains.
- `order_status_category` standardizes the order lifecycle to `sent`, `completed`, `resulted`, or `canceled`.

**Example**:

| hospitalization_id | order_dttm                | order_name                | order_category | order_status_name | order_status_category |
|-------------------|---------------------------|--------------------------|----------------|-------------------|-----------------------|
| 12345             | 2024-12-15 10:00:00+00:00 UTC | PT Initial Evaluation     | pt             | Completed         | completed             |
| 67890             | 2024-12-16 14:30:00+00:00 UTC | OT Follow-up Treatment    | ot             | Sent              | sent                  |
| 54321             | 2024-12-16 08:00:00+00:00 UTC | Social Work Consult       | social_work    | Resulted          | resulted              |
| 98765             | 2024-12-15 11:15:00+00:00 UTC | Palliative Care Consult   | palliative_care| Canceled          | canceled              |
| 11223             | 2024-12-17 09:45:00+00:00 UTC | Nutrition Consult         | nutrition      | Completed         | completed             |

## misc_icu_orders



The `misc_icu_orders` table captures miscellaneous ICU orders that are not consults/services — operational orders and procedures such as EEG, restraints, wound care, out-of-bed (OOB) activity, Foley placement, and extubation. It shares the same fields as `consult_orders` and differs only in the kinds of orders it contains.

**Notes**:

- This table, together with `consult_orders`, replaces the former `key_icu_orders` table ([issue #218](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/issues/218)).
- `order_status_category` standardizes the order lifecycle to `sent`, `completed`, `resulted`, or `canceled`.

**Example**:

| hospitalization_id | order_dttm                | order_name                | order_category | order_status_name | order_status_category |
|-------------------|---------------------------|--------------------------|----------------|-------------------|-----------------------|
| 12345             | 2024-12-15 10:00:00+00:00 UTC | Continuous EEG            | eeg            | Resulted          | resulted              |
| 67890             | 2024-12-16 14:30:00+00:00 UTC | Restraint Order           | restraints     | Completed         | completed             |
| 54321             | 2024-12-16 08:00:00+00:00 UTC | Foley Catheter Insertion  | foley          | Completed         | completed             |
| 98765             | 2024-12-15 11:15:00+00:00 UTC | Out of Bed to Chair       | oob            | Sent              | sent                  |
| 11223             | 2024-12-17 09:45:00+00:00 UTC | Extubation Order          | extubation     | Completed         | completed             |


## medication_orders


This table records the ordering (not administration) of medications. The table is in long form (one medication order per row) longitudinal table. Linkage to the `medication_admin_continuous` and `medication_admin_intermittent` tables is through the `med_order_id` field.



**Example**:

| hospitalization_id | med_order_id | ordering_provider_id | order_start_dttm              | order_end_dttm                | ordered_dttm                  | med_name                                                           | med_category    | med_group      | med_order_status_name | med_order_status_category | med_route_name | med_dose | med_dose_unit | med_frequency  | prn |
|-------------------|--------------|----------------------|------------------------------|------------------------------|------------------------------|------------------------------------------------------------------|----------------|---------------|---------------------|------------------------|---------------|-----------|---------------|---------------|-----|
| 12345             | 456789       | PROV001              | 2023-10-01 14:00:00+00:00 UTC   | 2023-10-02 14:00:00+00:00 UTC   | 2023-10-01 13:30:00+00:00 UTC   | Norepinephrine 8 mg/250 mL                                         | norepinephrine | vasoactives   | active              | ongoing                 | Intravenous   | 8.0      | mg/mL        | Continuous    | 0   |
| 12346             | 456790       | PROV002              | 2023-10-01 16:00:00+00:00 UTC   | 2023-10-02 10:00:00+00:00 UTC   | 2023-10-01 15:30:00+00:00 UTC   | Vancomycin 1 g IV                                                  | vancomycin     | antibiotics   | active              | ongoing                 | Intravenous   | 1.0      | g            | Every 12 hours| 0   |
| 12347             | 456791       | PROV003              | 2023-10-02 08:00:00+00:00 UTC   | 2023-10-03 08:00:00+00:00 UTC   | 2023-10-02 07:30:00+00:00 UTC   | Furosemide 40 mg IV                                                | furosemide     | diuretics     | discontinued         | discontinued            | Intravenous   | 40.0     | mg           | Once Daily    | 0   |
| 12348             | 456792       | PROV004              | 2023-10-02 12:00:00+00:00 UTC   | 2023-10-02 18:00:00+00:00 UTC   | 2023-10-02 11:45:00+00:00 UTC   | Insulin Regular 100 units/mL SC                                     | insulin        | endocrine     | held                | held                    | Subcutaneous  | 100.0    | units/mL     | As Needed     | 1   |
| 12349             | 456793       | PROV005              | 2023-10-03 08:00:00+00:00 UTC   | 2023-10-03 20:00:00+00:00 UTC   | 2023-10-03 07:30:00+00:00 UTC   | Acetaminophen 1 g PO                                               | acetaminophen  | analgesics    | active              | ongoing                 | Oral          | 1.0      | g            | Every 6 hours | 0   |
| 12350             | 456794       | PROV006              | 2023-10-03 10:00:00+00:00 UTC   | 2023-10-03 18:00:00+00:00 UTC   | 2023-10-03 09:45:00+00:00 UTC   | Heparin 5,000 units SC                                             | heparin        | anticoagulant | active              | ongoing                 | Subcutaneous  | 5000.0   | units        | Every 8 hours | 0   |
| 12351             | 456795       | PROV007              | 2023-10-03 14:00:00+00:00 UTC   | 2023-10-03 22:00:00+00:00 UTC   | 2023-10-03 13:30:00+00:00 UTC   | Morphine Sulfate 2 mg IV                                           | morphine       | analgesics    | active              | ongoing                 | Intravenous   | 2.0      | mg           | As Needed     | 1   |
| 12352             | 456796       | PROV008              | 2023-10-03 20:00:00+00:00 UTC   | 2023-10-04 08:00:00+00:00 UTC   | 2023-10-03 19:45:00+00:00 UTC   | Dexamethasone 10 mg IV                                             | dexamethasone  | steroids      | active              | ongoing                 | Intravenous   | 10.0     | mg           | Once Daily    | 0   |


## output

The output table captures patient fluid output events during hospitalization. 

**Notes**:
- `output_value` must be a positive number. `output_unit` reports its unit: `mL` for quantitative fluid volumes, or `occurrences` for unmeasured/counted events (e.g., number of emesis episodes)
- `lda_id` links an output to a specific line, drain, or airway (LDA) device when attributable to one (e.g., a Foley, JP drain, or chest tube)
- Ultrafiltration output from dialysis should reflect **net** ultrafiltration only (do not include removal of replacement fluid in CVVH or CVVHDF)

\
**Example**:

| hospitalization_id | recorded_dttm | output_name | output_category | output_group | output_value | output_unit | lda_id |
|-------------------|---------------|-------------|-----------------|--------------|--------------|-------------|--------|
| 40010001 | 2024-04-01 08:00:00+00:00 UTC | Foley catheter | indwelling_urinary_catheter | urine | 350.0 | mL | LDA-FOLEY01 |
| 40010001 | 2024-04-01 12:00:00+00:00 UTC | Foley catheter | indwelling_urinary_catheter | urine | 275.0 | mL | LDA-FOLEY01 |
| 40010001 | 2024-04-01 14:30:00+00:00 UTC | JP drain | procedural_drain_other | drains | 50.0 | mL | LDA-JP01 |
| 40010002 | 2024-04-02 06:00:00+00:00 UTC | NG tube output | orogastric_nasogastric_tube | gi | 120.0 | mL | LDA-NG01 |
| 40010002 | 2024-04-02 10:00:00+00:00 UTC | Chest tube | chest_tube_temporary | drains | 200.0 | mL | LDA-CT01 |
| 40010003 | 2024-04-03 09:00:00+00:00 UTC | Emesis | emesis | gi | 1 | occurrences |  |


## place_based_index

The place_based_index table is designed to store geospatial or community-level indices linked to a patient's hospitalization.

**Notes**:  
Source indices from validated and publicly available datasets.

**Example**:

| hospitalization_id | index_name                | index_value | index_version   |
|-------------------|---------------------------|-------------|-----------------|
| 1001              | Area Deprivation Index    | 85.2        | ADI 2019        |
| 1001              | Social Vulnerability Index| 0.72        | SVI 2020        |
| 1002              | Area Deprivation Index    | 67.5        | ADI 2019        |


## provider

Continuous start stop record of every provider who cared for the patient.



**Example**:
| hospitalization_id | start_dttm | stop_dttm | provider_role_name | provider_role_category |
|-------------------|------------|-----------|-------------------|----------------------|
| 1001014 | 2023-05-01 08:00:00+00:00 UTC | 2023-05-01 20:00:00+00:00 UTC | Attending Physician | Attending |
| 1001014 | 2023-05-01 08:00:00+00:00 UTC | 2023-05-02 08:00:00+00:00 UTC | Resident Physician | Resident |
| 1001014 | 2023-05-01 08:00:00+00:00 UTC | 2023-05-03 08:00:00+00:00 UTC | Nurse Practitioner | Nurse Practitioner |
| 1002025 | 2023-06-10 09:00:00+00:00 UTC | 2023-06-10 21:00:00+00:00 UTC | Critical Care Specialist | Critical Care |
| 1002025 | 2023-06-10 09:00:00+00:00 UTC | 2023-06-11 09:00:00+00:00 UTC | Respiratory Therapist | Respiratory Therapy |
| 1003036 | 2023-07-15 07:30:00+00:00 UTC | 2023-07-15 19:30:00+00:00 UTC | Attending Physician | Attending |
| 1003036 | 2023-07-15 07:30:00+00:00 UTC | 2023-07-16 07:30:00+00:00 UTC | Charge Nurse | Nurse |
| 1004047 | 2023-08-20 10:00:00+00:00 UTC | 2023-08-20 22:00:00+00:00 UTC | Physical Therapist | Therapy |


## microbiology_susceptibility



This table is used to store the susceptibility results of the organisms identified in the `Microbiology Culture`. 


**Example**: 
| organism_id | antimicrobial_name                 | antimicrobial_category      | sensitivity_name      | susceptibility_name             | susceptibility_category |
|-------------|------------------------------------|----------------------------|----------------------|-------------------------------|------------------------|
| 1           | avycex (ceftazidime/avibactam)     | ceftazidime_avibactam      | 8 MIC                | susceptible                   | susceptible            |
| 1           | amoxicillin clavulanic acid        | amoxicillin_clavulanate    | < 0.1 ug/mL          | susceptible                   | susceptible        |
| 1           | meropenem                         | meropenem                  | indeterminate        | indeterminate                  | indeterminate         |
| 1           | ampicillin 500mg                   | ampicillin                 | > 0.5 ug/mL          | resistant                     | non_susceptible        |
| 2           | unasyn                            | ampicillin_sulbactam       | susceptible dose dependent | susceptible             | susceptible            |
| 2           | Ertapenem                         | ertapenem                  | not reported         | NA                            | na                     |
| 2           | Vancomycin (non-Cdiff)            | vancomycin                 | > 0.25 ug/mL         | non susceptible, caution       | non_susceptible        |





## therapy_details


The `therapy_details` table is a wide longitudinal table that captures the details of therapy sessions. The table is designed to capture and categorize the most common therapy elements used in the ICU.



**Example**:

| hospitalization_id | session_start_dttm           | therapy_element_name     | therapy_element_category | therapy_element_value |
|-------------------|-----------------------------|-----------------------|------------------------|-------------------|
| 1001              | 2024-01-01 08:00:00+00:00 UTC  | Physical Therapy      | Rehabilitation         | 45.0             |
| 1001              | 2024-01-01 10:00:00+00:00 UTC  | Respiratory Therapy   | Respiratory Support    | 3.0              |
| 1002              | 2024-01-05 09:30:00+00:00 UTC  | Occupational Therapy  | Rehabilitation         | 60.0             |
| 1002              | 2024-01-05 11:00:00+00:00 UTC  | Speech Therapy        | Rehabilitation         | 30.0             |
| 1003              | 2024-01-10 07:00:00+00:00 UTC  | Ventilation Support   | Respiratory Support    | 2.5              |


## transfusion

This table provides detailed information about transfusion events linked to specific hospitalizations.


**Example**:

| hospitalization_id | transfusion_start_dttm           | transfusion_end_dttm             | component_name  | attribute_name    | volume_transfused | volume_unit | product_code |
|-------------------|----------------------------------|----------------------------------|----------------|-------------------|------------------|--------------|--------------|
| 123456            | 2024-12-03 08:30:00+00:00 UTC       | 2024-12-03 10:00:00+00:00 UTC       | Red Blood Cells | Leukocyte Reduced | 300              | mL           | E0382        |
| 789012            | 2024-12-04 14:00:00+00:00 UTC       | 2024-12-04 16:30:00+00:00 UTC       | Platelets       | Irradiated        | 250              | mL           | P0205        |
| 456789            | 2024-12-05 12:15:00+00:00 UTC       | 2024-12-05 13:45:00+00:00 UTC       | Plasma          |                   | 200              | mL           | F0781        |

## clinical_trial

This table captures whether a patient was enrolled in any clinical trial during their hospitalization. It enables longitudinal tracking of trial participation, including trial identifiers, arm assignment, and key consent, randomization, and withdrawal timestamps. This structure supports research into the effects of experimental therapies and interventions on patient outcomes.

**Example**:

| participant_id | patient_id | hospitalization_id | trial_id | trial_name                                    | arm_id     | consent_dttm                  | enrollment_dttm                | randomized_dttm                | withdrawal_dttm                |
|----------------|-----------|--------------------|----------|-----------------------------------------------|------------|-------------------------------|-------------------------------|-------------------------------|-------------------------------|
| PT1234         | 567890    | 234567             | T-001    | Early Vasopressor in Septic Shock (EVSS)      | Arm A      | 2024-06-01 10:15:00+00:00 UTC | 2024-06-01 14:00:00+00:00 UTC | 2024-06-01 15:00:00+00:00 UTC |                               |
| PT2345         | 678901    | 345678             | NCT04321 | Lung Protective Ventilation                   | Standard   | 2024-06-11 12:00:00+00:00 UTC | 2024-06-11 13:15:00+00:00 UTC |                               |                               |
| PT3456         | 789012    | 456789             | T-017    | Multi-center COVID-19 Anticoagulation Trial   | High Dose  | 2024-07-15 09:10:00+00:00 UTC | 2024-07-15 09:45:00+00:00 UTC | 2024-07-15 10:00:00+00:00 UTC | 2024-07-20 08:30:00+00:00 UTC |


## validated_diagnosis

The `validated_diagnosis` table captures clinician-validated diagnostic labels for research purposes. This table is designed for studies requiring confirmed diagnoses through chart review or consensus adjudication, enabling high-quality phenotyping for research cohorts.

**Notes**:
- This table is intended for research diagnoses that have undergone validation, not routine clinical diagnoses
- The `diagnosis_category` should map to a controlled vocabulary appropriate for the research context
- Multiple reviewers can validate the same diagnosis by creating separate rows with different `reviewer_id` values

**Example**:

| hospitalization_id | diagnosis_name | diagnosis_category | diagnosis_start_dttm | diagnosis_end_dttm | validation_method | diagnosis_status | reviewer_id | review_timestamp |
|-------------------|----------------|-------------------|---------------------|-------------------|------------------|-----------------|-------------|-----------------|
| 12345 | Septic shock | sepsis | 2024-12-01 08:00:00+00:00 UTC | 2024-12-03 14:00:00+00:00 UTC | manual_chart_review | confirmed | REV001 | 2024-12-15 10:30:00+00:00 UTC |
| 12345 | Acute kidney injury | aki | 2024-12-01 12:00:00+00:00 UTC | NULL | consensus_panel | confirmed | REV002 | 2024-12-16 09:00:00+00:00 UTC |
| 67890 | Acute respiratory failure | arf | 2024-11-28 06:00:00+00:00 UTC | 2024-11-30 18:00:00+00:00 UTC | automated_with_review | uncertain | REV001 | 2024-12-10 14:15:00+00:00 UTC |
| 54321 | Ischemic stroke | stroke | 2024-12-05 02:30:00+00:00 UTC | NULL | manual_chart_review | ruled_out | REV003 | 2024-12-18 11:45:00+00:00 UTC |


## clinical_notes_facts

The `clinical_notes_facts` table captures the metadata about clinical notes. It deliberately stores **only metadata** — the note text itself is not held in CLIF.

**Just-in-time note provisioning**:

Clinical note text is **not** stored in CLIF. Instead, notes are provisioned **"just in time"** — that is, **on-demand** — by directly querying each site's Clinical Data Warehouse (CDW) via SQL or API at the moment the text is needed for a given study. The `clinical_notes_facts` table provides the metadata index used to identify exactly which notes (and which revisions) to pull.

To simplify downstream pipelines, provisioned notes are extracted as **plain text files** using a standardized naming convention:

```
[hospitalization_id]__[note_id]_[revision_id].txt
```

This keeps text-heavy workloads out of the core CLIF tables while preserving a deterministic, revision-aware mapping back to the metadata in `clinical_notes_facts`.

**Notes**:
- The `revision_id` is rank-ordered per `(hospitalization_id, note_id)` by `revision_dttm` ascending 
- The triplet `(hospitalization_id, note_id, revision_id)` matches the `[hospitalization_id]__[note_id]_[revision_id].txt` naming convention used for just-in-time provisioned note text


**Example**:

| hospitalization_id | note_id | note_type | note_type_category | author_id | note_author_specialty | revision_id | creation_dttm | revision_dttm | service_date | note_status | cosigner_id | cosigner_specialty |
|-------------------|---------|-----------|-------------------|-----------|----------------------|-------------|---------------|---------------|--------------|-------------|-------------|-------------------|
| 12345 | N001 | Progress Note | progress_note | PROV001 | Critical Care | 1 | 2024-12-01 08:00:00+00:00 UTC | 2024-12-01 08:00:00+00:00 UTC | 2024-12-01 00:00:00+00:00 UTC | incomplete | | |
| 12345 | N001 | Progress Note | progress_note | PROV001 | Critical Care | 2 | 2024-12-01 08:00:00+00:00 UTC | 2024-12-01 12:45:00+00:00 UTC | 2024-12-01 00:00:00+00:00 UTC | signed | PROV010 | Critical Care |
| 12345 | N002 | Discharge Summary | discharge_summary | PROV002 | Internal Medicine | 1 | 2024-12-03 14:00:00+00:00 UTC | 2024-12-03 14:00:00+00:00 UTC | 2024-12-03 00:00:00+00:00 UTC | co-signed | PROV011 | Pulmonology |
| 67890 | N003 | PT Initial Evaluation | therapy_note | PROV003 | Physical Therapy | 1 | 2024-11-28 09:30:00+00:00 UTC | 2024-11-28 09:30:00+00:00 UTC | 2024-11-28 00:00:00+00:00 UTC | signed | | |
| 67890 | N004 | ID Consult | consult_note | PROV004 | Infectious Diseases | 1 | 2024-11-28 14:00:00+00:00 UTC | 2024-11-28 14:00:00+00:00 UTC | 2024-11-28 00:00:00+00:00 UTC | addendum | | |
| 67890 | N005 | Death Pronouncement | death_pronouncement | PROV005 | Critical Care | 1 | 2024-11-29 03:15:00+00:00 UTC | 2024-11-29 03:15:00+00:00 UTC | 2024-11-29 00:00:00+00:00 UTC | signed | | |

## microbiology_nonculture

The microbiology non-culture table captures the order and result times of non-culture microbiology tests, the type of fluid collected, the component of the test, and the result of the test. Positive results can produce multiple `result_dttm` rows as interim and final values are reported; negative results are stored as a single row per order.

**Example**:
| patient_id | hospitalization_id | order_dttm                | collect_dttm              | result_dttm               | fluid_name           | fluid_category      | method_name | method_category | micro_order_name                        | organism_category         | organism_group                                         | result_name                                   | result_category | reference_low | reference_high | result_unit | lab_loinc_code |
|------------|-------------------|---------------------------|---------------------------|---------------------------|----------------------|---------------------|-------------|----------------|------------------------------------------|--------------------------|--------------------------------------------------------|-----------------------------------------------|-----------------|--------------|---------------|--------------|---------------|
| 1          | 12121             | 2025-06-15 09:05:00+00:00 | 2025-06-15 09:30:00+00:00 | 2025-06-15 13:45:00+00:00 | BLOOD                | blood/buffy coat    | PCR         | pcr            | neisseria quantitative pcr, blood        | neisseria_sp             | neisseria (gonorrhoea, meningitidis, other species)    | 100,000 copies/uL of neisseria detected       | detected        |              |               | copies/mL    | 39528-5       |
| 2          | 32332             | 2025-06-16 11:15:00+00:00 | 2025-06-16 11:40:00+00:00 | 2025-06-16 15:25:00+00:00 | cerebrospinal fluid  | meninges and csf    | PCR         | pcr            | csf hsv pcr                             | herpes_simplex_virus      | herpes simplex (hsv1, hsv2)                           | no herspes simplex DNA measured               | not_detected    |              |               | IU/mL        | 16954-2       |
| 2          | 32332             | 2025-06-17 10:00:00+00:00 | 2025-06-17 10:20:00+00:00 | 2025-06-17 14:05:00+00:00 | feces                | feces/stool         | PCR         | pcr            | stool c. diff toxin                      | clostridioides_difficile  | clostridium difficile                                 | default in test for C. difficile toxin analysis | indeterminate   |              |               | copies/mL    | 34712-0       |
| 3          | 45454             | 2025-06-18 10:00:00+00:00 | 2025-06-18 10:20:00+00:00 | 2025-06-18 14:30:00+00:00 | BLOOD                | blood/buffy coat    | PCR         | pcr            | hiv quantitative pcr, blood              | hiv                       | hiv                                                   | not detected                                  | not_detected    |              |               | copies/mL    | 25835-0       |


## model_registry

The `model_registry` table is the registry of EHR-derived clinical scoring models deployed at a site (e.g., Epic Deterioration Index, Epic mortality, fall-risk models). It defines, per model version, the standardized category and whether the model is currently firing live alerts. Score values themselves live in `scores` and join back via `model_id`.

**Notes**:

- Each `model_id` row is unique. Sites should retain historical rows for retired model versions and use `is_live` to flag the active deployment(s).
- `model_category` is the mCIDE-controlled cross-site identifier; sites map their local `model_name` to this standardized `vendor_modelname` snake_case label.
- Official alert thresholds are intentionally **not** a column. Threshold tiers vary by site, change over time, and are often multi-tier (green/yellow/red); they are documented as remarks in the `model_category` mCIDE entry and are otherwise managed at the project / config-file level.
- `is_live` distinguishes models firing live alerts to clinicians from models running silently / in shadow mode.

**Example**:

| model_id | model_name             | model_category             | model_version | release_date | is_live |
|----------|------------------------|----------------------------|---------------|--------------|---------|
| SYS-001  | IP Deterioration Index | epic_deterioration_index   | 0.0.2         | 2023-06-01   | TRUE    |
| SYS-003  | Mortality Risk         | epic_mortality             | 0.3.1         | 2024-11-01   | TRUE    |
| SYS-002  | Rush Palliative Care   | rush_palliative_care       | 1.1.0         | 2022-09-15   | FALSE   |


## scores

The `scores` table is a long-form (one score event per row) longitudinal table that captures predictive-score outputs emitted by clinical scoring models defined in `model_registry`. Models such as the Epic Deterioration Index typically emit a value every ~15 minutes per active hospitalization, so this table can grow to hundreds of millions of rows per site; keeping it normalized to `model_registry` for metadata is intentional.

**Notes**:

- Join `scores` to `model_registry` on `model_id` to resolve the model name, category, version, and live status.
- A row does not imply that an alert was triggered. Threshold-derived alert categories are project-specific and resolved in code, not stored here.
- All `recorded_dttm` values must be timezone-aware UTC.
- Sites with very large score volumes are encouraged to partition the on-disk parquet by `model_id` (or `model_id` and date) to keep query costs manageable.

**Example**:

| model_id | hospitalization_id | recorded_dttm                  | score_value |
|----------|--------------------|--------------------------------|-------------|
| SYS-001  | 90210              | 2023-07-12 08:15:00+00:00 UTC  | 34.7        |
| SYS-001  | 90210              | 2023-07-12 08:30:00+00:00 UTC  | 36.2        |
| SYS-002  | 55443              | 2023-07-12 06:00:00+00:00 UTC  | 18.0        |
| SYS-003  | 55443              | 2023-07-12 06:00:00+00:00 UTC  | 0.275       |


## radiology

The `radiology` table captures one row per imaging study, including order/capture/report timestamps, the modality and anatomic region, IV contrast status, where the study was performed, and the final report narrative. This is the long-form imaging analog to the lab and microbiology tables — each row is a single completed study with a single accession.

**Notes**:

- One row per `radiology_accession`. The accession is the natural key within a site.
- All four `*_category` fields are mCIDE-controlled. See the [3.0 radiology mCIDE folder](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/tree/3.0/mCIDE/radiology) for the canonical permissible values.
- `radiology_report_text` is free text; sites that cannot share narratives may leave it null and join to a separately-governed text store via `radiology_accession`.
- `radiology_capture_dttm` (image acquisition) and `radiology_report_dttm` (final read) typically differ — the capture time is what should be used for clinical-event timing.

**Example**:

| patient_id | radiology_accession | radiology_order_dttm          | radiology_capture_dttm        | radiology_report_dttm         | radiology_order_name        | radiology_modality_category | radiology_region_category | iv_contrast_category | radiology_location_category | radiology_report_text                              |
|------------|---------------------|-------------------------------|-------------------------------|-------------------------------|-----------------------------|-----------------------------|---------------------------|----------------------|-----------------------------|----------------------------------------------------|
| 132424     | ACC0001             | 2024-11-01 08:00:00+00:00 UTC | 2024-11-01 08:25:00+00:00 UTC | 2024-11-01 09:10:00+00:00 UTC | XR CHEST PORTABLE 1V        | xr                          | chest                     | not_applicable       | portable                    | No acute cardiopulmonary process. ETT in good position. |
| 132424     | ACC0002             | 2024-11-02 14:00:00+00:00 UTC | 2024-11-02 14:35:00+00:00 UTC | 2024-11-02 16:00:00+00:00 UTC | CT CHEST W CONTRAST         | ct                          | chest                     | with_contrast        | radiology                   | No PE. Small bilateral pleural effusions.          |
| 132384     | ACC0003             | 2024-11-03 09:30:00+00:00 UTC | 2024-11-03 10:05:00+00:00 UTC | 2024-11-03 12:45:00+00:00 UTC | MR BRAIN W AND WO CONTRAST  | mr                          | brain                     | with_and_without_contrast | radiology               | No acute infarct. Stable chronic microvascular disease. |
| 542367     | ACC0004             | 2024-11-04 06:15:00+00:00 UTC | 2024-11-04 06:40:00+00:00 UTC | 2024-11-04 07:30:00+00:00 UTC | US ABDOMEN COMPLETE         | us                          | abdomen                   | not_applicable       | radiology                   | Hepatomegaly. No biliary dilation.                 |


## line

The `line` table captures vascular line placements during a hospitalization — one row per line. It tracks when each line was placed and removed, the standardized line type (`line_category`), the anatomic site (`line_site`), and the lumen count. Per the [steering committee vote](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/issues/208), lines, drains, and airways are kept as three separate tables rather than a unified LDA table.

**Notes**:

- Composite key is `(hospitalization_id, line_id)`. `line_id` maps to the Epic LDA ID where applicable.
- `removed_dttm` is null if the line is still in place at the time of data extraction.
- `line_category` and `line_site` are mCIDE-controlled — see [clif_line_categories.csv](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/3.0/mCIDE/line/clif_line_categories.csv) and [clif_line_sites.csv](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/3.0/mCIDE/line/clif_line_sites.csv) for the canonical permissible values.
- `line_site` is optional and typically null for lines that don't have a meaningful laterality (e.g., a PIV in the antecubital fossa not coded by side).
- `lumen_count` is optional but recommended for central lines and dialysis catheters.

**Example**:

| hospitalization_id | line_id   | placed_dttm                   | removed_dttm                  | line_category     | line_site         | lumen_count |
|--------------------|-----------|-------------------------------|-------------------------------|-------------------|-------------------|-------------|
| 123456             | LDA0001   | 2024-12-03 08:30:00+00:00 UTC | 2024-12-08 14:00:00+00:00 UTC | cvc               | right_ij          | 3           |
| 123456             | LDA0002   | 2024-12-03 09:10:00+00:00 UTC | 2024-12-06 11:30:00+00:00 UTC | art_line          | left_radial       | 1           |
| 789012             | LDA0073   | 2024-12-04 14:00:00+00:00 UTC |                               | picc              | right_brachial    | 2           |
| 456789             | LDA0144   | 2024-12-05 12:15:00+00:00 UTC | 2024-12-05 18:45:00+00:00 UTC | piv               |                   |             |


## drain

The `drain` table captures drain placements during a hospitalization — one row per drain. It tracks when each drain was placed and removed, the standardized drain type (`drain_category`), and a free-text `anatomical_location`.

**Notes**:

- Composite key is `(hospitalization_id, drain_id)`. `drain_id` maps to the Epic LDA ID where applicable.
- `removed_dttm` is null if the drain is still in place at the time of data extraction.
- `drain_category` is mCIDE-controlled — see [clif_drain_categories.csv](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/3.0/mCIDE/drain/clif_drain_categories.csv) for the canonical permissible values.
- `anatomical_location` is unstandardized free text (e.g., "right pleural", "subhepatic") because drain placement sites are too heterogeneous to enumerate.

**Example**:

| hospitalization_id | drain_id  | placed_dttm                   | removed_dttm                  | drain_category | anatomical_location |
|--------------------|-----------|-------------------------------|-------------------------------|----------------|---------------------|
| 123456             | LDA0301   | 2024-12-03 10:00:00+00:00 UTC | 2024-12-09 09:15:00+00:00 UTC | chest_tube     | right pleural       |
| 123456             | LDA0302   | 2024-12-03 11:30:00+00:00 UTC |                               | foley          | bladder             |
| 789012             | LDA0410   | 2024-12-04 15:45:00+00:00 UTC | 2024-12-07 08:00:00+00:00 UTC | jp_drain       | subhepatic          |
| 456789             | LDA0588   | 2024-12-05 06:20:00+00:00 UTC | 2024-12-05 22:10:00+00:00 UTC | ng_tube        | gastric             |


## airway

The `airway` table captures airway device placements during a hospitalization — one row per airway. It tracks when each airway was placed and removed, the standardized airway type (`airway_category`), the device size, and whether it is cuffed.

**Notes**:

- Composite key is `(hospitalization_id, airway_id)`. `airway_id` maps to the Epic LDA ID where applicable.
- `removed_dttm` is null if the airway is still in place at the time of data extraction.
- `airway_category` is mCIDE-controlled — see [clif_airway_categories.csv](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/3.0/mCIDE/airway/clif_airway_categories.csv) for the canonical permissible values.
- `airway_size` is the device size as recorded (e.g., 7.5 mm internal diameter for an ETT, 8 Fr for an NPA). Unit conventions follow the source EHR.
- `is_cuffed` is 1 if the device has an inflatable cuff (typical for ETTs and most tracheostomy tubes), 0 otherwise (typical for NPA/OPA).

**Example**:

| hospitalization_id | airway_id | placed_dttm                   | removed_dttm                  | airway_category | airway_size | is_cuffed |
|--------------------|-----------|-------------------------------|-------------------------------|-----------------|-------------|-----------|
| 123456             | LDA0701   | 2024-12-03 07:45:00+00:00 UTC | 2024-12-08 16:20:00+00:00 UTC | ett             | 7.5         | 1         |
| 789012             | LDA0802   | 2024-12-04 13:00:00+00:00 UTC |                               | trach           | 8.0         | 1         |
| 456789             | LDA0903   | 2024-12-05 04:30:00+00:00 UTC | 2024-12-05 06:00:00+00:00 UTC | opa             | 9           | 0         |
| 234567             | LDA1004   | 2024-12-06 22:10:00+00:00 UTC | 2024-12-07 03:45:00+00:00 UTC | npa             | 7           | 0         |


## patient_attributes

The `patient_attributes` table is the dynamic, patient-level counterpart to the (static) `patient` table. It stores social, behavioral, functional, reproductive, and administrative attributes that change over a patient's lifetime, in long entity-attribute-value form — one row per patient, per `recorded_dttm`, per `attribute_category`. The design parallels `vitals`, `labs`, and `patient_assessments`, but for slow-changing attributes such as smoking status, housing status, and marital status.

The distinction between the two tables is *whether the attribute is fixed for a person or can change over time*. The `patient` table holds immutable, lifelong demographics — exactly one row per patient — such as date of birth, sex, race, and ethnicity. The `patient_attributes` table holds time-varying attributes that therefore need a timestamp and may have many rows per patient; recording the same attribute again over time produces a new row rather than overwriting the old value.

**Notes**:

- Composite key is `(patient_id, recorded_dttm, attribute_category)`. The same attribute can be recorded multiple times over a patient's lifetime, with newer rows superseding older ones.
- `attribute_category` and `attribute_group` form a deterministic rollup — every `attribute_category` maps to exactly one `attribute_group` (e.g., `housing_status` → `health_related_social_needs`). Sites do not need to populate `attribute_group` independently if it can be derived.
- **`attribute_value_category` permissibles are conditional on `attribute_category`.** The column-level permissible list is the *union* of all attribute value sets. The conditional validity per category:

  | attribute_category | attribute_group | permissible attribute_value_category |
  |--------------------|-----------------|--------------------------------------|
  | alcohol_use | substance_use_behavior | none, social, heavy, unknown |
  | employment_status | sociodemographic | full_time, part_time, unemployed, retired, student, disabled, unknown |
  | financial_strain | health_related_social_needs | none, present, unknown |
  | food_insecurity | health_related_social_needs | secure, insecure, unknown |
  | functional_status | functional | independent, partially_dependent, fully_dependent, unknown |
  | housing_status | health_related_social_needs | housed, unstable, undomiciled, unknown |
  | interpersonal_safety | health_related_social_needs | safe, unsafe, unknown |
  | marital_status | sociodemographic | single, married, divorced, widowed, separated, unknown |
  | organ_donor | care_preferences | yes, no, unknown |
  | pregnancy_status | reproductive | pregnant, postpartum, not_pregnant, unknown |
  | smoking_status | substance_use_behavior | current, former, never, unknown |
  | social_isolation | health_related_social_needs | connected, isolated, unknown |
  | substance_use | substance_use_behavior | active, history, none, unknown |
  | transportation_barrier | health_related_social_needs | none, present, unknown |
  | utility_insecurity | health_related_social_needs | secure, insecure, unknown |

- Per the [steering committee discussion](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/issues/211), BMI is intentionally excluded (it belongs on `vitals`), isolation status belongs on `adt`, and insurance belongs on `hospitalization`. Advance-directive content rolls up under `organ_donor` / `care_preferences`.

**Example**:

| patient_id | recorded_dttm                 | attribute_name           | attribute_category    | attribute_group              | attribute_value_name | attribute_value_category |
|------------|-------------------------------|--------------------------|-----------------------|------------------------------|----------------------|--------------------------|
| 132424     | 2024-01-15 09:00:00+00:00 UTC | Marital Status           | marital_status        | sociodemographic             | Married              | married                  |
| 132424     | 2024-01-15 09:00:00+00:00 UTC | Smoking History          | smoking_status        | substance_use_behavior       | Former smoker        | former                   |
| 132424     | 2024-01-15 09:00:00+00:00 UTC | Housing Status           | housing_status        | health_related_social_needs  | Stable housing       | housed                   |
| 132424     | 2024-11-30 14:20:00+00:00 UTC | Smoking History          | smoking_status        | substance_use_behavior       | Never smoker         | never                    |
| 542367     | 2024-03-20 11:30:00+00:00 UTC | Housing Status           | housing_status        | health_related_social_needs  | Homeless             | undomiciled              |
| 542367     | 2024-03-20 11:30:00+00:00 UTC | Food Insecurity Screen   | food_insecurity       | health_related_social_needs  | Food insecure        | insecure                 |
| 542367     | 2024-03-20 11:30:00+00:00 UTC | Functional Status        | functional_status     | functional                   | ADL dependent        | partially_dependent      |
| 989862     | 2024-07-02 08:15:00+00:00 UTC | Pregnancy Status         | pregnancy_status      | reproductive                 | 32 weeks gestation   | pregnant                 |
| 989862     | 2024-07-02 08:15:00+00:00 UTC | Organ Donor Designation  | organ_donor           | care_preferences             | Donor on license     | yes                      |


## ed_encounter

The `ed_encounter` table captures one row per emergency department encounter linked to a hospitalization. It encodes ED workflow concepts that are not reliably recoverable from `adt` alone — arrival mode, triage system and acuity, chief complaint, final ED disposition, destination after ED, and observation pathway status. Per the [feature request](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/issues/178), `adt` remains the source of location-movement intervals and derived metrics such as boarding duration should be calculated downstream from timestamps rather than stored as core fields.

**Notes**:

- Grain is one row per ED encounter; together `(hospitalization_id, ed_encounter_id)` identifies a row. A hospitalization may have multiple ED encounters if the patient bounced back, but typically there is one.
- `triage_system_category` and `triage_acuity_category` are separated so non-ESI sites (e.g., CTAS-based) can still encode acuity on the common 5-level scale.
- `ed_disposition_category` (final ED outcome) and `ed_destination_category` (physical destination after the ED) are separated so transfers, observation admissions, and AMA / LWBS outcomes are not conflated with destination.
- `ed_destination_category` permissibles intentionally align with `hospitalization.discharge_category` so post-ED transitions and final hospital discharges share a vocabulary.
- `ed_observation_status` is a binary flag. Observation duration, ED length of stay, and boarding duration should be derived from `ed_arrival_dttm` / `ed_disposition_dttm` / `ed_departure_dttm` rather than persisted.

**Example**:

| hospitalization_id | ed_encounter_id   | ed_arrival_dttm               | ed_departure_dttm             | arrival_mode_category | triage_system_category | triage_acuity_category | triage_dttm                   | chief_complaint_name           | ed_disposition_category | ed_destination_category | ed_observation_status |
|--------------------|-------------------|-------------------------------|-------------------------------|-----------------------|------------------------|------------------------|-------------------------------|--------------------------------|-------------------------|-------------------------|-----------------------|
| 1001014            | ED-2026-0008721   | 2026-03-12 14:00:00+00:00 UTC | 2026-03-12 18:30:00+00:00 UTC | ems_ground            | esi                    | level_2                | 2026-03-12 14:07:00+00:00 UTC | Chest pain                     | admit                   | acute_care_hosp         | 0                     |
| 1001014            | ED-2026-0008944   | 2026-03-18 02:25:00+00:00 UTC | 2026-03-18 09:10:00+00:00 UTC | walk_in               | esi                    | level_3                | 2026-03-18 02:33:00+00:00 UTC | Abdominal pain x 2 days        | observation             | acute_care_hosp         | 1                     |
| 1002025            | ED-2026-0011027   | 2026-04-02 19:45:00+00:00 UTC | 2026-04-02 21:50:00+00:00 UTC | private_vehicle       | esi                    | level_4                | 2026-04-02 19:51:00+00:00 UTC | Forearm laceration             | discharge               | home                    | 0                     |
| 1002025            | ED-2026-0011533   | 2026-04-09 08:05:00+00:00 UTC | 2026-04-09 09:20:00+00:00 UTC | ems_air               | esi                    | level_1                | 2026-04-09 08:14:00+00:00 UTC | Cardiac arrest, ROSC en route  | admit                   | acute_care_hosp         | 0                     |
| 1003036            | ED-2026-0012890   | 2026-04-21 15:55:00+00:00 UTC | 2026-04-21 17:40:00+00:00 UTC | walk_in               | esi                    | level_4                | 2026-04-21 16:02:00+00:00 UTC | Sore throat                    | discharge               | home                    | 0                     |
| 1003036            | ED-2026-0013774   | 2026-05-04 23:35:00+00:00 UTC | 2026-05-05 02:15:00+00:00 UTC | law_enforcement       | ctas                   | level_2                | 2026-05-04 23:41:00+00:00 UTC | Altered mental status          | transfer                | mental_health_hosp      | 0                     |


## Future Proposed Tables

These are tables without any defined structure that the consortium has not yet committed to implementing.
\
**Clinical Decision Support**: This table will capture the actions of clinical decision support tools embedded in the EHR. The table will have the following fields: `cds_name`, `cds_category`, `cds_value`, `cds_trigger_ddtm`.

