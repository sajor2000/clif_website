## CLIF Data Dictionary

The CLIF Data Dictionary serves as a comprehensive guide to the Common Longitudinal ICU data Format, detailing the structure and purpose of each table within the framework. Designed to standardize and harmonize electronic health record data across multiple institutions, the dictionary outlines the entity-relationship model, variable definitions, and permissible values.

![ERD](/images/data-dictionary/ERD-2.1.0-0711.png)

## Beta Tables

The table purpose, structure, and field names for beta tables is complete and used in at least one federated CLIF project. The minimum Common ICU Data Elements (mCIDE) for category variables is defined. Actively testing the table's practical use in projects. Breaking changes unlikely, but backward compatible updates in future minor versions possible


## adt
The admission, discharge, and transfer (adt) table is a start-stop longitudinal dataset that contains information about each patient's movement within the hospital. It also has a *`hospital_id`* field to distinguish between different hospitals within a health system. 

**Notes**:

* ADT represents the patient's physical location, NOT the patient "status".
* Procedural areas and operating rooms should be mapped to `Procedural`. Pre/Intra/Post-procedural/OR EHR data (such as anesthesia flowsheet records from Labs, Vitals, Scores, Respiratory Support) **are not currently** represented in CLIF.

\
**Example**:

| hospitalization_id | hospital_id | hospital_type | in_dttm | out_dttm | location_name | location_category | location_type |
|-------------------|-------------|---------------|---------|----------|---------------|-------------------|----------------|
| 20010012 | ABC | academic | 2024-12-01 10:00:00+00:00 | 2024-12-01 14:00:00+00:00 | B06F | icu | general_icu |
| 20010012 | ABC | academic | 2024-12-01 14:30:00+00:00 | 2024-12-02 08:00:00+00:00 | B78D | ward | |
| 20010015 | ABC | academic | 2024-11-30 16:45:00+00:00 | 2024-12-01 12:00:00+00:00 | B06T | icu | general_icu |
| 20010015 | ABC | academic | 2024-12-01 12:30:00+00:00 | 2024-12-02 07:00:00+00:00 | N23E | procedural | |
| 20010020 | EFG | community | 2024-11-28 09:00:00+00:00 | 2024-11-29 17:00:00+00:00 | B78D | ward | |


## code_status

This table provides a longitudinal record of changes in a patient's code status during their hospitalization. It tracks the timeline and categorization of code status updates, facilitating the analysis of care preferences and decisions.


**Notes**:

- The `code_status_category` set of permissible values is under development

\
**Example**:

| patient_id | start_dttm                  | code_status_name   | code_status_category |
|------------|----------------------------|-------------------|---------------------|
| 123451     | 2024-12-01 08:30:00+00:00 | Do Not Resuscitate| DNR                 |
| 123452     | 2024-12-02 14:00:00+00:00 | Do Not Intubate   | DNR/DNI             |
| 123451     | 2024-12-03 10:15:00+00:00 | Full Code         | Full                |


## crrt_therapy

The crrt_therapy table captures Continuous Renal Replacement Therapy (CRRT) data, including different CRRT modalities, operational parameters, and fluid exchange details. The intermittent HD, peritoneal dialysis, PERT, and SLED tables are under development.

**Notes**: 
- **SCUF:** Slow Continuous Ultrafiltration
- **CVVH:** Continuous Veno-Venous Hemofiltration
- **CVVHD:** Continuous Veno-Venous Hemodialysis
- **CVVHDF:** Continuous Venous-Venous Hemodiafiltration
\
**CRRT Modalities and Parameter Usage**:

| **CRRT Modality** | **Blood Flow Rate** | **Pre-Filter Replacement Rate** | **Post-Filter Replacement Rate** | **Dialysate Flow Rate** | **Ultrafiltration Out** |
|-------------------|---------------------|---------------------------------|---------------------------------|-------------------------|-------------------------|
| **SCUF**          | Required            | Not Used                        | Not Used                        | Not Used                |   Required              |
| **CVVH**          | Required            | Required                        | Required                        | Not Used                |   Required              |
| **CVVHD**         | Required            | Not Used                        | Not Used                        | Required                |   Required              |
| **CVVHDF**        | Required            | Required                        | Required                        | Required                |   Required              |

**Example**:
| hospitalization_id | device_id | recorded_dttm | crrt_mode_name | crrt_mode_category | blood_flow_rate | pre_filter_replacement_fluid_rate | post_filter_replacement_fluid_rate | dialysate_flow_rate | ultrafiltration_out |
|-------------------|-----------|---------------|----------------|-------------------|-----------------|-----------------------------------|------------------------------------|---------------------|---------------------|
| 201 | J3 | 2024-02-15 07:00:00+00:00 | CVVHDF | CVVHDF | 200.0 | 1000.0 | 500.0 | 800.0 | 1500.0 |
| 202 | J7 | 2024-02-16 09:15:00+00:00 | CVVH | CVVH | 180.0 | 1200.0 | 300.0 | NA | 1300.0 |
| 203 | J11 | 2024-02-17 11:45:00+00:00 | SCUF | SCUF | 150.0 | NA | NA | NA | 800.0 |


## ecmo_mcs

The ECMO/MCS table is a wider longitudinal table that captures the start and stop times of ECMO/MCS support, the type of device used, and the work rate of the device.

**Example**:
| hospitalization_id | recorded_dttm | device_name | device_category | mcs_group | device_metric_name | device_rate | flow | sweep | fdO2 |
|-------------------|---------------|-------------|-----------------|-----------|-------------------|-------------|------|-------|------|
| 1001 | 2024-01-01 08:00:00+00:00 | Centrimag | CentriMag_LV | temporary_LVAD | RPMs | 3000 | 4.5 | NULL | NULL |
| 1002 | 2024-01-05 12:00:00+00:00 | ECMO VV | VV_ECMO | ECMO | RPMs | NULL | 5.2 | 2.0 | 1.0 |
| 1003 | 2024-01-10 09:00:00+00:00 | TandemHeart | TandemHeart_LV | temporary_LVAD | RPMs | 2800 | 3.8 | NULL | NULL |
| 1004 | 2024-01-15 14:00:00+00:00 | ECMO VA | VA_ECMO | ECMO | RPMs | 3500 | 4.0 | 4.0 | 1.0 |


## hospitalization

The hospitalization table contains information about each hospitalization event. Each row in this table represents a unique hospitalization event for a patient. This table is inspired by the [visit_occurance](https://ohdsi.github.io/CommonDataModel/cdm54.html#visit_occurrence) OMOP table but is specific to inpatient hospitalizations (including those that begin in the emergency room).


**Notes**:

- If a patient is discharged to Home/Hospice, then `discharge_category == Hospice`.
- The geographical indicators (`zipcode_nine_digit`, `zipcode_five_digit`, `census_block_code`, `census_block_group_code`, `census_tract`, `state_code`, `county_code`) should be added if they are available in your source dataset. `zipcode_nine_digit` is preferred over `zipcode_five_digit`, and `census_block_code` is ideal for census based indicators. The choice of geographical indicators may differ depending on the project.
- If a patient is transferred between different hospitals within a health system, a new `hospitalization_id` should be created.
- If a patient is initially seen in an ER in hospital A and then admitted to inpatient status in hospital B, one `hospitalization_id` should be created for data from both stays.
- A `hospitalization_joined_id` can also be created from a CLIF table from contiguous `hospitalization_ids`.

\
**Example**:

| patient_id | hospitalization_id | hospitalization_joined_id | admission_dttm | discharge_dttm | age_at_admission | admission_type_name | admission_type_category | discharge_name | discharge_category | zipcode_five_digit | zipcode_nine_digit | census_block_group_code | latitude | longitude |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 101001 | 12345678 | 22334455 | 2024-11-01 08:15:00+00:00 | 2024-11-04 14:30:00+00:00 | 65 | Direct admission | Inpatient | Discharged to Home or Self Care (Routine Discharge) | Home | 60637 | 606370000 | 170313202001 | 41.81030 | -87.59697 |
| 101002 | 87654321 | 22334455 | 2024-11-04 15:00:00+00:00 | 2024-11-07 11:00:00+00:00 | 72 | Transfer from another hospital | Acute Care Transfer | Transferred to Acute Inpatient Rehab Facility | Acute Inpatient Rehab Facility | 46311 | 463110000 | 170313301002 | 41.55030 | -87.30101 |
| 101003 | 11223344 | 11223344 | 2024-10-20 07:45:00+00:00 | 2024-10-22 10:20:00+00:00 | 59 | Pre-op surgical | Pre-op | Expired | Expired | 60446 | 604460000 | 170313401003 | 41.70010 | -87.60315 |


## hospital_diagnosis

Record of all diagnoses associated with the hospitalization. Expect breaking changes to this table as we seek to align it with existing diagnosis ontologies

**Example**:
| hospitalization_id | diagnostic_code | diagnosis_code_format | start_dttm                | end_dttm                  |
|-------------------|-----------------|----------------------|---------------------------|---------------------------|
| 1001014           | 250.00          | icd9                 | 2023-05-01 08:00:00+00:00 | 2023-05-10 08:00:00+00:00 |
| 1001014           | J45.909         | icd10                | 2023-05-01 08:00:00+00:00 | 2023-05-15 08:00:00+00:00 |
| 1002025           | 401.9           | icd9                 | 2023-06-10 09:00:00+00:00 | 2023-06-12 09:00:00+00:00 |
| 1002025           | E11.9           | icd10                | 2023-06-10 09:00:00+00:00 | 2023-06-20 09:00:00+00:00 |
| 1003036           | 414.01          | icd9                 | 2023-07-15 07:30:00+00:00 | 2023-07-30 07:30:00+00:00 |
| 1003036           | I25.10          | icd10                | 2023-07-15 07:30:00+00:00 | 2023-07-25 07:30:00+00:00 |
| 1004047           | 530.81          | icd9                 | 2023-08-20 10:00:00+00:00 | 2023-08-22 10:00:00+00:00 |
| 1004047           | K21.9           | icd10                | 2023-08-20 10:00:00+00:00 | 2023-08-24 10:00:00+00:00 |


## labs

The labs table is a long form (one lab result per row) longitudinal table. 

**Notes**:

The `lab_value` field often has non-numeric entries that are useful to make project-specific decisions. A site may choose to keep the `lab_value` field as a character and create a new field `lab_value_numeric` that only parses the character field to extract the numeric part of the string.
\
**Example**:

| hospitalization_id | lab_order_dttm         | lab_collect_dttm        | lab_result_dttm         | lab_order_name                | lab_order_category | lab_name         | lab_category | lab_value | lab_value_numeric | reference_unit | lab_specimen_name | lab_specimen_category | lab_loinc_code |
|-------------------|------------------------|-------------------------|-------------------------|-------------------------------|--------------------|------------------|-------------|----------|------------------|----------------|-------------------|----------------------|---------------|
| 1001014           | 2023-05-01 07:00:00+00:00 | 2023-05-01 07:15:00+00:00 | 2023-05-01 08:00:00+00:00 | Complete blood count w/ diff  | CBC                | WBC              | white_blood_cell_count | 8.2      | 8.2              | 10^3/uL        | blood             | blood/plasma/serum   | 6690-2        |
| 1001014           | 2023-05-01 07:00:00+00:00 | 2023-05-01 07:15:00+00:00 | 2023-05-01 08:00:00+00:00 | Complete blood count w/ diff  | CBC                | HGB              | hemoglobin            | 13.5     | 13.5             | g/dL           | blood             | blood/plasma/serum   | 718-7         |
| 1002025           | 2023-06-10 08:30:00+00:00 | 2023-06-10 08:45:00+00:00 | 2023-06-10 09:00:00+00:00 | Basic metabolic panel         | BMP                | Sodium           | sodium               | 140      | 140              | mmol/L         | blood             | blood/plasma/serum   | 2951-2        |
| 1002025           | 2023-06-10 08:30:00+00:00 | 2023-06-10 08:45:00+00:00 | 2023-06-10 09:00:00+00:00 | Basic metabolic panel         | BMP                | Potassium        | potassium            | 4.2      | 4.2              | mmol/L         | blood             | blood/plasma/serum   | 2823-3        |
| 1003036           | 2023-07-15 06:45:00+00:00 | 2023-07-15 07:00:00+00:00 | 2023-07-15 07:30:00+00:00 | Liver function panel          | LFT                | AST (SGOT)       | ast                  | 35       | 35               | U/L            | blood             | blood/plasma/serum   | 1920-8        |
| 1003036           | 2023-07-15 06:45:00+00:00 | 2023-07-15 07:00:00+00:00 | 2023-07-15 07:30:00+00:00 | Liver function panel          | LFT                | ALT (SGPT)       | alt                  | 28       | 28               | U/L            | blood             | blood/plasma/serum   | 1742-6        |


## medication_admin_continuous

The medication admin continuous table is a long-form (one medication administration record per) longitudinal table designed for continuous infusions of common ICU medications such as vasopressors and sedation (Boluses of these drugs should be recorded in `med_admin_intermittent`). Note that it only reflects dose changes of the continuous medication and does not have a specific “end_time” variable to indicate the medication being stopped. The end of a continuous infusion should be recorded as a new row with med_dose = 0 and an appropriate mar_action_name (e.g. "stopped" or "paused").

**Example**:

| hospitalization_id | admin_dttm                | med_name                                                           | med_category  | med_group     | med_route_name | med_route_category | med_dose | med_dose_unit | mar_action_name |
|-------------------|---------------------------|--------------------------------------------------------------------|---------------|---------------|----------------|-------------------|----------|---------------|----------------|
| 792391            | 2123-11-13 12:28:00+00:00 | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION                            | propofol      | sedation      | Intravenous    | NA                | 75.0000  | mcg/kg/min    | New Bag        |
| 792391            | 2123-11-13 13:49:00+00:00 | REMIFENTANIL CONTINUOUS IV (ANESTHESIA)                           | remifentanil  | sedation      | NA             | NA                | 0.0500   | mcg/kg/min    | New Bag        |
| 792391            | 2123-11-13 14:03:00+00:00 | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION                            | propofol      | sedation      | Intravenous    | NA                | 0.0000   | mcg/kg/min    | Stopped        |
| 370921            | 2123-02-12 03:07:00+00:00 | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE    | phenylephrine | vasoactives   | Intravenous    | NA                | 20.0000  | mcg/min       | New Bag        |
| 370921            | 2123-02-12 03:14:00+00:00 | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE    | phenylephrine | vasoactives   | Intravenous    | NA                | 50.0000  | mcg/min       | Rate Change    |
| 702344            | 2123-04-27 04:30:00+00:00 | HEPARIN (PORCINE) 25,000 UNIT/250 ML IN 0.45 % SODIUM CHLORIDE    | heparin       | anticoagulation| Intravenous    | NA                | 18.0000  | Units/kg/hr   | New Bag        |


## microbiology_culture

The microbiology culture table is a wide longitudinal table that captures the order and result times of microbiology culture tests, the type of fluid collected, the component of the test, and the organism identified.

**Example**:
| hospitalization_id | order_dttm                  | collect_dttm                | result_dttm                 | fluid_name                           | fluid_category           | method_name | method_category | organism_category       | organism_group           |
|-------------------|----------------------------|----------------------------|----------------------------|--------------------------------------|------------------------|----------------|-------------------|------------------------|------------------------------|
| 12345             | 2023-10-01 14:00:00+00:00 | 2023-10-01 15:00:00+00:00 | 2023-10-03 10:00:00+00:00 | culture, blood (bacterial & fungal)  | blood/buffy coat       | culture        | culture           | no growth              | no growth                     |
| 12345             | 2023-10-01 16:00:00+00:00 | 2023-10-01 17:00:00+00:00 | 2023-10-03 12:00:00+00:00 | culture, urine                       | genito-urinary tract   | culture        | culture           | escherichia_coli       | escherichia (also e. coli)    |
| 12346             | 2023-11-01 10:30:00+00:00 | 2023-11-01 11:15:00+00:00 | 2023-11-02 09:00:00+00:00 | culture & stain, respiratory         | lower respiratory tract | gram stain     | gram stain        | gram positive cocci    | gram positive cocci (nos)     |
| 12346             | 2023-11-02 12:00:00+00:00 | 2023-11-02 12:45:00+00:00 | 2023-11-03 08:30:00+00:00 | culture, cerebrospinal fluid         | csf                    | culture        | culture           | no growth              | no growth                     |
| 12347             | 2023-09-15 14:20:00+00:00 | 2023-09-15 15:00:00+00:00 | 2023-09-17 11:30:00+00:00 | culture & stain, afb                 | other unspecified      | afb smear      | smear             | no growth              | no growth                     |
| 12348             | 2023-08-10 09:00:00+00:00 | 2023-08-10 09:45:00+00:00 | 2023-08-12 08:00:00+00:00 | culture, blood (bacterial & fungal)  | blood/buffy coat       | culture        | culture           | staphylococcus_aureus  | staphylococcus (all)          |
| 12349             | 2023-07-25 11:00:00+00:00 | 2023-07-25 11:30:00+00:00 | 2023-07-27 10:15:00+00:00 | culture, urine                       | genito-urinary tract   | culture        | culture           | enterococcus_faecium   | enterococcus (all species)    |
| 12350             | 2023-06-15 13:30:00+00:00 | 2023-06-15 14:00:00+00:00 | 2023-06-17 09:45:00+00:00 | culture & stain, respiratory         | lower respiratory tract | gram stain     | gram stain        | gram negative rod      | gram negative rod (nos)       |


## microbiology_nonculture

The microbiology non-culture table is a wide longitudinal table that captures the order and result times of non-culture microbiology tests, the type of fluid collected, the component of the test, and the result of the test.

**Example**:
| hospitalization_id | result_dttm                | collect_dttm               | order_dttm                | fluid_name          | component_category      | result_unit_category | result_category |
|-------------------|---------------------------|---------------------------|---------------------------|--------------------|-----------------------|-------------------|----------------|
| 101               | 2024-01-01 10:00:00+00:00 | 2024-01-01 08:00:00+00:00 | 2024-01-01 07:30:00+00:00 | Blood               | PCR                    | Units/mL           | Positive        |
| 102               | 2024-01-02 11:30:00+00:00 | 2024-01-02 09:30:00+00:00 | 2024-01-02 08:15:00+00:00 | Cerebrospinal Fluid | Antigen Detection      | mg/L              | Negative        |
| 103               | 2024-01-03 15:00:00+00:00 | 2024-01-03 13:00:00+00:00 | 2024-01-03 12:45:00+00:00 | Sputum              | Gene Amplification     | copies/mL          | Detected        |
| 104               | 2024-01-04 09:45:00+00:00 | 2024-01-04 07:15:00+00:00 | 2024-01-04 06:30:00+00:00 | Urine               | Molecular Pathogen ID  | ng/mL             | Not Detected    |
| 105               | 2024-01-05 18:00:00+00:00 | 2024-01-05 16:00:00+00:00 | 2024-01-05 15:00:00+00:00 | Pleural Fluid       | Protein Quantification | g/dL              | Elevated        |


## patient

This table contains demographic information about the patient that does not vary between hospitalizations. It is inspired by the OMOP [Person](https://ohdsi.github.io/CommonDataModel/cdm54.html#person) table


**Example**:
| patient_id | race_name                  | race_category              | ethnicity_name                                    | ethnicity_category | sex_category | birth_date  | death_dttm | language_name | language_category |
|------------|---------------------------|---------------------------|--------------------------------------------------|-------------------|--------------|-------------|------------|---------------|------------------|
| 132424     | Black or African-American | Black or African American | Not Hispanic, Latino/a, or Spanish origin        | Non-Hispanic      | Male         | 2145-05-09  | NA         | English       | English          |
| 132384     | White                     | White                     | Not Hispanic, Latino/a, or Spanish origin        | Non-Hispanic      | Female       | 2145-03-30  | NA         | English       | English          |
| 542367     | Black or African-American | Black or African American | Not Hispanic, Latino/a, or Spanish origin        | Non-Hispanic      | Male         | 2145-01-29  | NA         | English       | English          |
| 989862     | White                     | White                     | Not Hispanic, Latino/a, or Spanish origin        | Non-Hispanic      | Female       | 2145-11-06  | NA         | English       | English          |
| 428035     | More than one Race        | Other                     | Not Hispanic, Latino/a, or Spanish origin        | Non-Hispanic      | Male         | 2145-10-13  | NA         | English       | English          |


## patient_assessments

The patient_assessments table captures various assessments performed on patients across different domains, including neurological status, sedation levels, pain, and withdrawal. The table is designed to provide detailed information about the assessments, such as the name of the assessment, the category, and the recorded values.

**Example**:
| hospitalization_id | recorded_dttm                | assessment_name                                | assessment_category    | assessment_group | numerical_value | categorical_value | text_value |
|-------------------|----------------------------|----------------------------------------------|---------------------|----------------|----------------|-----------------|------------|
| 12345             | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT EYE OPENING             | gcs_eye            | Neurological   | 4              | NA              | NA         |
| 12345             | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT VERBAL RESPONSE         | gcs_verbal         | Neurological   | 5              | NA              | NA         |
| 12345             | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT BEST MOTOR RESPONSE     | gcs_motor          | Neurological   | 6              | NA              | NA         |
| 12345             | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT SCORING                 | gcs_total          | Neurological   | 15             | NA              | NA         |
| 67890             | 2024-12-01 10:30:00+00:00 | BRADEN ASSESSMENT                            | braden_total       | Nursing Risk   | 18             | NA              | NA         |
| 67890             | 2024-12-01 10:30:00+00:00 | SAT SCREEN                                   | sat_delivery_pass_fail | Sedation     | NA             | Pass            | NA         |


## position

The position table is a long form (one position per row) longitudinal table that captures all documented position changes of the patient. The table is designed for the explicit purpose of constructing the `position_category` CDE and identifying patients in prone position.

**Example**:
| hospitalization_id | recorded_dttm                | position_name                                                | position_category |
|-------------------|----------------------------|-------------------------------------------------------------|------------------|
| 84                | 2123-06-20 00:00:00+00:00 | Supine–turn R                                               | not_prone        |
| 84                | 2123-06-20 06:00:00+00:00 | Supine–turn L                                               | not_prone        |
| 84                | 2123-06-20 12:00:00+00:00 | Supine–back                                                 | not_prone        |
| 84                | 2123-06-20 16:00:00+00:00 | Supine–turn R                                               | not_prone        |
| 84                | 2123-06-20 20:00:00+00:00 | Supine–back;Supine–turn intolerant                          | not_prone        |
| 84                | 2123-06-20 22:00:00+00:00 | Supine–turn intolerant,microturn L                          | not_prone        |
| 84                | 2123-06-20 00:00:00+00:00 | Supine–turn intolerant,microturn L;Supine–back              | not_prone        |
| 84                | 2123-06-20 01:10:00+00:00 | 30 Degrees                                                  | not_prone        |


## respiratory_support

The respiratory support table is a wider longitudinal table that captures simultaneously recorded ventilator settings and observed ventilator parameters. The table is designed to capture the most common respiratory support devices and modes used in the ICU. It will be sparse for patients who are not on mechanical ventilation.

**Notes**:

**Expected setting values for each device_category and mode_category**

- `device_category` == "IMV"

| ventilator_setting        | Assist Control-Volume Control | Pressure Support/CPAP | Pressure Control | Pressure-Regulated Volume Control | SIMV | Volume Support |
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

- `device_category` == "NIPPV"

`mode_category` is `Pressure Support/CPAP` and the `fio2_set`, `peep_set`, and either `pressure_support_set` OR `peak_inspiratory_pressure_set` (IPAP) is required.

- `device_category` == "CPAP"

`mode_category` is `Pressure Support/CPAP` and the `fio2_set` and `peep_set` are required.

- `device_category` == "High Flow NC"

`mode_category` is NA and the `fio2_set` and `lpm_set` are required.

- `device_category` == "Face Mask"

`mode_category` is NA
`lpm_set` is required.
`fio2_set` is possible.

- `device_category` == "Trach Collar" or "Nasal Cannula"

`mode_category` is NA
`lpm_set` is required


**Example**:

| hospitalization_id | recorded_dttm           | device_name | device_id | device_category | mode_name         | mode_category                | vent_brand_name | tracheostomy | fio2_set | lpm_set | tidal_volume_set | resp_rate_set | pressure_control_set | pressure_support_set | flow_rate_set | tidal_volume_obs | resp_rate_obs | plateau_pressure_obs | peak_inspiratory_pressure_obs | peep_obs | minute_vent_obs | mean_airway_pressure_obs |
|-------------------|-------------------------|-------------|-----------|-----------------|-------------------|------------------------------|-----------------|--------------|----------|---------|------------------|---------------|----------------------|----------------------|---------------|------------------|---------------|----------------------|-----------------------------|----------|-----------------|-------------------------|
| 12345             | 2024-12-01 08:00:00+00:00 | Ventilator   | DEV001    | IMV             | CMV Volume Ctrl   | Assist Control-Volume Control| Vent A          | 1            | 0.50     | 40      | 500              | 18            | 15                   | 5                    | 50            | 450              | 18            | 20                   | 25                          | 5        | 9.0             | 12.0                    |
| 12345             | 2024-12-01 09:00:00+00:00 | Ventilator   | DEV001    | IMV             | SIMV              | SIMV                         | Vent A          | 1            | 0.45     | 35      | 480              | 20            | 18                   | 8                    | 55            | 470              | 20            | 21                   | 28                          | 6        | 10.5            | 14.0                    |
| 67890             | 2024-12-01 10:30:00+00:00 | HFNC         | DEV002    | High Flow NC    | N/A               | Other                        | N/A             | 0            | 0.30     | 60      | NA               | NA            | NA                   | NA                   | 60            | NA               | NA            | NA                   | NA                          | NA       | NA              | NA                      |
| 67890             | 2024-12-01 11:00:00+00:00 | CPAP         | DEV003    | CPAP            | CPAP              | Pressure Support/CPAP        | CPAP X          | 0            | 0.40     | 50      | NA               | NA            | NA                   | 10                   | NA            | NA               | NA            | NA                   | NA                          | 8        | NA              | NA                      |

## vitals

The vitals table is a long-form (one vital sign per row) longitudinal table.


**Example**:

| hospitalization_id | recorded_dttm                | vital_name                   | vital_category   | vital_value | meas_site_name |
|-------------------|----------------------------|------------------------------|-----------------|-------------|----------------|
| 20010012          | 2024-12-01 08:00:00+00:00 | HEIGHT                       | height_cm       | 170.0      | unspecified    |
| 20010012          | 2024-12-01 08:15:00+00:00 | WEIGHT                       | weight_kg       | 70.0       | unspecified    |
| 20010012          | 2024-12-01 08:30:00+00:00 | PULSE                        | heart_rate      | 72.0       | unspecified    |
| 20010012          | 2024-12-01 08:45:00+00:00 | BLOOD PRESSURE (SYSTOLIC)    | sbp             | 120.0      | unspecified    |
| 20010012          | 2024-12-01 08:45:00+00:00 | BLOOD PRESSURE (DIASTOLIC)   | dbp             | 80.0       | unspecified    |
| 20010012          | 2024-12-01 08:50:00+00:00 | RESPIRATORY RATE             | respiratory_rate| 16.0       | unspecified    |
| 20010012          | 2024-12-01 09:00:00+00:00 | TEMPERATURE                  | temp_c          | 36.8       | unspecified    |
| 20010012          | 2024-12-01 09:15:00+00:00 | SPO2                         | spo2            | 98.0       | unspecified    |
| 20010013          | 2024-12-01 09:30:00+00:00 | MEAN ARTERIAL PRESSURE (MAP) | map             | 85.0       | arterial       |


## Concept Tables

A planned future CLIF table that has yet to be used in a federated project. The table structure and CDE elements are in draft form. Permissible values of category variables may still need to be defined. Seeking conceptual feedback. Significant changes to all aspects of the table are possible.

## intake_output


The intake_output table is long form table that captures the times intake and output events were recorded, the type of fluid administered or recorded as "out", and the amount of fluid.



**Example**:

| hospitalization_id | intake_dttm                  | fluid_name        | amount | in_out_flag |
|-------------------|------------------------------|------------------|---------|-------------|
| 1001              | 2024-01-01 08:00:00+00:00   | Normal Saline    | 500     | 1           |
| 1001              | 2024-01-01 10:30:00+00:00   | Urine           | 300     | 0           |
| 1002              | 2024-01-05 09:15:00+00:00   | Dextrose        | 250     | 1           |
| 1002              | 2024-01-05 14:00:00+00:00   | Urine           | 400     | 0           |
| 1003              | 2024-01-10 07:45:00+00:00   | Lactated Ringer's| 600     | 1           |
| 1003              | 2024-01-10 12:00:00+00:00   | Drainage        | 200     | 0           |


## invasive_hemodynamics



The `invasive_hemodynamics` table records invasive hemodynamic measurements during a patient’s hospitalization. These measurements represent pressures recorded via invasive monitoring and are expressed in millimeters of mercury (mmHg).


**Notes**:

- All `measure_value` entries should be recorded in mmHg.
- The `measure_category` field ensures standardization of invasive hemodynamic data:
        1. `CVP` - Central Venous Pressure
        2. `RA` - Right Atrial Pressure
        3. `RV` - Right Ventricular Pressure
        4. `PA_systolic` - Pulmonary Artery Systolic Pressure
        5. `PA_diastolic` - Pulmonary Artery Diastolic Pressure
        6. `PA_mean` - Pulmonary Artery Mean Pressure
        7. `PCWP` - Pulmonary Capillary Wedge Pressure

\
**Example**:

| hospitalization_id | recorded_dttm                | measure_name         | measure_category | measure_value |
|-------------------|----------------------------|-------------------|-----------------|--------------|
| 12345             | 2024-12-01 08:30:00+00:00 | CVP               | CVP             | 12.50        |
| 12345             | 2024-12-01 09:00:00+00:00 | Pulmonary Artery-Sys | PA_systolic     | 25.00        |
| 12345             | 2024-12-01 09:30:00+00:00 | Wedge             | PCWP            | 18.75        |


## key_icu_orders



The `key_icu_orders` table captures key orders related to physical therapy (PT) and occupational therapy (OT) during ICU stays. It includes details about the hospitalization, the timing of the order, the specific name of the order, its category, and the status of the order (completed or sent).


**Example**:

| hospitalization_id | order_dttm                | order_name                | order_category | order_status_name |
|-------------------|---------------------------|--------------------------|---------------|-----------------|
| 12345             | 2024-12-15 10:00:00+00:00 | PT Initial Evaluation     | PT_evaluation  | completed       |
| 67890             | 2024-12-16 14:30:00+00:00 | OT Follow-up Treatment    | OT_treat       | sent            |
| 54321             | 2024-12-16 08:00:00+00:00 | PT Mobility Session       | PT_treat       | completed       |
| 98765             | 2024-12-15 11:15:00+00:00 | OT Cognitive Assessment   | OT_evaluation  | sent            |


## medication_admin_intermittent

This table has exactly the same schema as [`medication_admin_continuous`](#medication-admin-continuous) described below. The consortium decided to separate the medications that are administered intermittently from the continuously administered medications. The mCIDE for `medication_category` for intermittent meds can be found [here](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_medication_admin_intermittent_med_categories.csv).


## medication_orders


This table records the ordering (not administration) of medications. The table is in long form (one medication order per row) longitudinal table. Linkage to the `medication_admin_continuous` and `medication_admin_intermittent` tables is through the `med_order_id` field.



**Example**:

| hospitalization_id | med_order_id | order_start_dttm              | order_end_dttm                | ordered_dttm                  | med_name                                                           | med_category    | med_group      | med_order_status_name | med_order_status_category | med_route_name | med_dose | med_dose_unit | med_frequency  | prn |
|-------------------|--------------|------------------------------|------------------------------|------------------------------|------------------------------------------------------------------|----------------|---------------|---------------------|------------------------|---------------|-----------|---------------|---------------|-----|
| 12345             | 456789       | 2023-10-01 14:00:00+00:00   | 2023-10-02 14:00:00+00:00   | 2023-10-01 13:30:00+00:00   | Norepinephrine 8 mg/250 mL                                         | norepinephrine | vasoactives   | active              | ongoing                 | Intravenous   | 8.0      | mg/mL        | Continuous    | 0   |
| 12346             | 456790       | 2023-10-01 16:00:00+00:00   | 2023-10-02 10:00:00+00:00   | 2023-10-01 15:30:00+00:00   | Vancomycin 1 g IV                                                  | vancomycin     | antibiotics   | active              | ongoing                 | Intravenous   | 1.0      | g            | Every 12 hours| 0   |
| 12347             | 456791       | 2023-10-02 08:00:00+00:00   | 2023-10-03 08:00:00+00:00   | 2023-10-02 07:30:00+00:00   | Furosemide 40 mg IV                                                | furosemide     | diuretics     | discontinued         | discontinued            | Intravenous   | 40.0     | mg           | Once Daily    | 0   |
| 12348             | 456792       | 2023-10-02 12:00:00+00:00   | 2023-10-02 18:00:00+00:00   | 2023-10-02 11:45:00+00:00   | Insulin Regular 100 units/mL SC                                     | insulin        | endocrine     | held                | held                    | Subcutaneous  | 100.0    | units/mL     | As Needed     | 1   |
| 12349             | 456793       | 2023-10-03 08:00:00+00:00   | 2023-10-03 20:00:00+00:00   | 2023-10-03 07:30:00+00:00   | Acetaminophen 1 g PO                                               | acetaminophen  | analgesics    | active              | ongoing                 | Oral          | 1.0      | g            | Every 6 hours | 0   |
| 12350             | 456794       | 2023-10-03 10:00:00+00:00   | 2023-10-03 18:00:00+00:00   | 2023-10-03 09:45:00+00:00   | Heparin 5,000 units SC                                             | heparin        | anticoagulant | active              | ongoing                 | Subcutaneous  | 5000.0   | units        | Every 8 hours | 0   |
| 12351             | 456795       | 2023-10-03 14:00:00+00:00   | 2023-10-03 22:00:00+00:00   | 2023-10-03 13:30:00+00:00   | Morphine Sulfate 2 mg IV                                           | morphine       | analgesics    | active              | ongoing                 | Intravenous   | 2.0      | mg           | As Needed     | 1   |
| 12352             | 456796       | 2023-10-03 20:00:00+00:00   | 2023-10-04 08:00:00+00:00   | 2023-10-03 19:45:00+00:00   | Dexamethasone 10 mg IV                                             | dexamethasone  | steroids      | active              | ongoing                 | Intravenous   | 10.0     | mg           | Once Daily    | 0   |


## procedures



A longitudinal record of each bedside ICU procedure performed on the patient (e.g. central line placement, chest tube placement). Note that this table is not intended to capture the full set of procedures performed on inpatients.



**Example**:
| hospitalization_id | procedure_name | procedure_category | diagnosis | start_dttm |
|-------------------|----------------|-------------------|-----------|------------|
| 1001 | Central Line Placement | Vascular Access | Sepsis with hypotension | 2024-01-01 08:00:00 |
| 1001 | Chest Tube Placement | Respiratory Support | Pneumothorax | 2024-01-01 10:00:00 |
| 1002 | Endotracheal Intubation | Airway Management | Acute Respiratory Failure | 2024-01-05 09:30:00 |
| 1002 | Paracentesis | Diagnostic Procedure | Suspected peritonitis | 2024-01-05 11:00:00 |
| 1003 | Arterial Line Placement | Vascular Access | Hemodynamic Monitoring | 2024-01-10 07:00:00 |


## provider



Continuous start stop record of every provider who cared for the patient.



**Example**:
| hospitalization_id | start_dttm | stop_dttm | provider_role_name | provider_role_category |
|-------------------|------------|-----------|-------------------|----------------------|
| 1001014 | 2023-05-01 08:00:00+00:00 | 2023-05-01 20:00:00+00:00 | Attending Physician | Attending |
| 1001014 | 2023-05-01 08:00:00+00:00 | 2023-05-02 08:00:00+00:00 | Resident Physician | Resident |
| 1001014 | 2023-05-01 08:00:00+00:00 | 2023-05-03 08:00:00+00:00 | Nurse Practitioner | Nurse Practitioner |
| 1002025 | 2023-06-10 09:00:00+00:00 | 2023-06-10 21:00:00+00:00 | Critical Care Specialist | Critical Care |
| 1002025 | 2023-06-10 09:00:00+00:00 | 2023-06-11 09:00:00+00:00 | Respiratory Therapist | Respiratory Therapy |
| 1003036 | 2023-07-15 07:30:00+00:00 | 2023-07-15 19:30:00+00:00 | Attending Physician | Attending |
| 1003036 | 2023-07-15 07:30:00+00:00 | 2023-07-16 07:30:00+00:00 | Charge Nurse | Nurse |
| 1004047 | 2023-08-20 10:00:00+00:00 | 2023-08-20 22:00:00+00:00 | Physical Therapist | Therapy |


## sensitivity



This table is used to store the susceptibility results of the organisms identified in the `Microbiology Culture` table and may be renamed to `Microbiology_Susceptibility`


**Example**:

| culture_id | antibiotic    | sensitivity  | mic  |
|------------|---------------|--------------|------|
| 1001       | Penicillin    | Susceptible  | 0.25 |
| 1001       | Vancomycin    | Resistant    | 8.0  |
| 1002       | Amoxicillin   | Intermediate | 4.0  |
| 1003       | Ciprofloxacin | Susceptible  | 0.5  |
| 1004       | Gentamicin    | Resistant    | 16.0 |


## therapy_details


The `therapy_details` table is a wide longitudinal table that captures the details of therapy sessions. The table is designed to capture and categorize the most common therapy elements used in the ICU.



**Example**:

| hospitalization_id | session_start_dttm           | therapy_element_name     | therapy_element_category | therapy_element_value |
|-------------------|-----------------------------|-----------------------|------------------------|-------------------|
| 1001              | 2024-01-01 08:00:00+00:00  | Physical Therapy      | Rehabilitation         | 45.0             |
| 1001              | 2024-01-01 10:00:00+00:00  | Respiratory Therapy   | Respiratory Support    | 3.0              |
| 1002              | 2024-01-05 09:30:00+00:00  | Occupational Therapy  | Rehabilitation         | 60.0             |
| 1002              | 2024-01-05 11:00:00+00:00  | Speech Therapy        | Rehabilitation         | 30.0             |
| 1003              | 2024-01-10 07:00:00+00:00  | Ventilation Support   | Respiratory Support    | 2.5              |


## transfusion

This table provides detailed information about transfusion events linked to specific hospitalizations.


**Example**:

| hospitalization_id | transfusion_start_dttm           | transfusion_end_dttm             | component_name  | attribute_name    | volume_transfused | volume_units | product_code |
|-------------------|----------------------------------|----------------------------------|----------------|-------------------|------------------|--------------|--------------|
| 123456            | 2024-12-03 08:30:00+00:00       | 2024-12-03 10:00:00+00:00       | Red Blood Cells | Leukocyte Reduced | 300              | mL           | E0382        |
| 789012            | 2024-12-04 14:00:00+00:00       | 2024-12-04 16:30:00+00:00       | Platelets       | Irradiated        | 250              | mL           | P0205        |
| 456789            | 2024-12-05 12:15:00+00:00       | 2024-12-05 13:45:00+00:00       | Plasma          |                   | 200              | mL           | F0781        |


## Future Proposed Tables

These are tables without any defined structure that the consortium has not yet committed to implementing.
\
**Clinical Decision Support**: This table will capture the actions of clinical decision support tools embedded in the EHR. The table will have the following fields: `cds_name`, `cds_category`, `cds_value`, `cds_trigger_ddtm`.
