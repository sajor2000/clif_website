## CLIF Data Dictionary

The CLIF Data Dictionary serves as a comprehensive guide to the Common Longitudinal ICU data Format, detailing the structure and purpose of each table within the framework. Designed to standardize and harmonize electronic health record data across multiple institutions, the dictionary outlines the entity-relationship model, variable definitions, and permissible values.

![ERD](/images/data-dictionary/ERD-2.1.0.png)

## Beta Tables

The table purpose, structure, and field names for beta tables is complete and used in at least one federated CLIF project. The [minimum Common ICU Data Elements (mCIDE)](https://clif-consortium.github.io/website/mCIDE.html) for category variables is defined. Actively testing the table's practical use in projects. Breaking changes unlikely, but backward compatible updates in future minor versions possible

## ADT

The admission, discharge, and transfer (ADT) table is a start-stop longitudinal dataset that contains information about each patient's movement within the hospital. It also has a `hospital_id` field to distinguish between different hospitals within a health system.

**Notes**:

- ADT represents the patient's physical location, NOT the patient "status".
- Procedural areas and operating rooms should be mapped to `Procedural`. Pre/Intra/Post-procedural/OR EHR data (such as anesthesia flowsheet records from Labs, Vitals, Scores, Respiratory Support) **are not currently** represented in CLIF.
\
**Example**:

| hospitalization\_id | hospital\_id | hospital\_type | in\_dttm | out\_dttm | location\_name | location\_category | location\_type |
|---|---|---|---|---|---|---|---|
| 20010012 | ABC | academic | 2024-12-01 10:00:00+00:00 | 2024-12-01 14:00:00+00:00 | B06F | icu | general\_icu |
| 20010012 | ABC | academic | 2024-12-01 14:30:00+00:00 | 2024-12-02 08:00:00+00:00 | B78D | ward |  |
| 20010015 | ABC | academic | 2024-11-30 16:45:00+00:00 | 2024-12-01 12:00:00+00:00 | B06T | icu | general\_icu |
| 20010015 | ABC | academic | 2024-12-01 12:30:00+00:00 | 2024-12-02 07:00:00+00:00 | N23E | procedural |  |
| 20010020 | EFG | community | 2024-11-28 09:00:00+00:00 | 2024-11-29 17:00:00+00:00 | B78D | ward |  |

## Code Status

This table provides a longitudinal record of changes in a patient's code status during their hospitalization. It tracks the timeline and categorization of code status updates, facilitating the analysis of care preferences and decisions.


**Notes**:

- The `code_status_category` set of permissible values is under development
\
**Example**:

| patient\_id | start\_dttm | code\_status\_name | code\_status\_category |
|---|---|---|---|
| 123451 | 2024-12-01 08:30:00+00:00 | Do Not Resuscitate | DNR |
| 123452 | 2024-12-02 14:00:00+00:00 | Do Not Intubate | DNR/DNI |
| 123451 | 2024-12-03 10:15:00+00:00 | Full Code | Full |

## CRRT Therapy

The crrt\_therapy table captures Continuous Renal Replacement Therapy (CRRT) data, including different CRRT modalities, operational parameters, and fluid exchange details. The intermittent HD, peritoneal dialysis, PERT, and SLED tables are under development.



**Notes**:

1. **SCUF:** Slow Continuous Ultrafiltration
2. **CVVH:** Continuous Veno-Venous Hemofiltration
3. **CVVHD:** Continuous Veno-Venous Hemodialysis
4. **CVVHDF:** Continuous Venous-Venous Hemodiafiltration
\
**CRRT Modalities and Parameter Usage**:

| crrt\_mode\_category | blood\_flow\_rate | pre\_filter\_replacement\_fluid\_rate | post\_filter\_replacement\_fluid\_rate | dialysate\_flow\_rate | ultrafiltration\_out |
|--------------------|-----------------|-----------------------------------|------------------------------------|---------------------|---------------------|
| SCUF               | Required        | Not Used                          | Not Used                           | Not Used            | Required            |
| CVVH               | Required        | Required                          | Required                           | Not Used            | Required            |
| CVVHD              | Required        | Not Used                          | Not Used                           | Required            | Required            |
| CVVHDF             | Required        | Required                          | Required                           | Required            | Required            |

\
**Example**:

| hospitalization\_id | device\_id | recorded\_dttm | crrt\_mode\_name | crrt\_mode\_category | blood\_flow\_rate | pre\_filter\_replacement\_fluid\_rate | post\_filter\_replacement\_fluid\_rate | dialysate\_flow\_rate | ultrafiltration\_out |
|---|---|---|---|---|---|---|---|---|---|
| 201 | J3 | 2024-02-15 07:00:00+00:00 | CVVHDF | CVVHDF | 200.0 | 1000.0 | 500.0 | 800.0 | 1500.0 |
| 202 | J7 | 2024-02-16 09:15:00+00:00 | CVVH | CVVH | 180.0 | 1200.0 | 300.0 | NA | 1300.0 |
| 203 | J11 | 2024-02-17 11:45:00+00:00 | SCUF | SCUF | 150.0 | NA | NA | NA | 800.0 |

## ECMO MCS

The ECMO/MCS table is a wider longitudinal table that captures the start and stop times of ECMO/MCS support, the type of device used, and the work rate of the device.


**Example**:

| hospitalization\_id | recorded\_dttm | device\_name | device\_category | mcs\_group | device\_metric\_name | device\_rate | flow | sweep | fdO2 |
|---|---|---|---|---|---|---|---|---|---|
| 1001 | 2024-01-01 08:00:00+00:00 | Centrimag | CentriMag\_LV | temporary\_LVAD | RPMs | 3000 | 4.5 | NULL | NULL |
| 1002 | 2024-01-05 12:00:00+00:00 | ECMO VV | VV\_ECMO | ECMO | RPMs | NULL | 5.2 | 2.0 | 1.0 |
| 1003 | 2024-01-10 09:00:00+00:00 | TandemHeart | TandemHeart\_LV | temporary\_LVAD | RPMs | 2800 | 3.8 | NULL | NULL |
| 1004 | 2024-01-15 14:00:00+00:00 | ECMO VA | VA\_ECMO | ECMO | RPMs | 3500 | 4.0 | 4.0 | 1.0 |

## Hospitalization

The hospitalization table contains information about each hospitalization event. Each row in this table represents a unique hospitalization event for a patient. This table is inspired by the [visit\_occurance](https://ohdsi.github.io/CommonDataModel/cdm54.html#visit_occurrence) OMOP table but is specific to inpatient hospitalizations (including those that begin in the emergency room).



**Notes**:

1. If a patient is discharged to Home/Hospice, then `discharge_category == Hospice`.

2. The geographical indicators( `zipcode_nine_digit`, `zipcode_five_digit`, `census_block_code`, `census_block_group_code`, `census_tract`, `state_code`, `county_code`) should be added if they are available in your source dataset. `zipcode_nine_digit` is preferred over `zipcode_five_digit`, and `census_block_code` is ideal for census based indicators.The choice of geographical indicators may differ depending on the project.

3. If a patient is transferred between different hospitals within a health system, a new `hospitalization_id` should be created

4. If a patient is initially seen in an ER in hospital A and then admitted to inpatient status in hospital B, one `hospitalization_id` should be created for data from both stays

5. A `hospitalization_joined_id` can also be created from a CLIF table from contiguous `hospitalization_ids`
\
**Example**:

| patient\_id | hospitalization\_id | hospitalization\_joined\_id | admission\_dttm | discharge\_dttm | age\_at\_admission | admission\_type\_name | admission\_type\_category | discharge\_name | discharge\_category | zipcode\_five\_digit | zipcode\_nine\_digit | census\_block\_code | latitude | longitude |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 101001 | 12345678 | 22334455 | 2024-11-01 08:15:00+00:00 | 2024-11-04 14:30:00+00:00 | 65 | Direct admission | Inpatient | Discharged to Home or Self Care (Routine Discharge) | Home | 60637 | 606370000 | 170313202001 | 41.81030 | -87.59697 |
| 101002 | 87654321 | 22334455 | 2024-11-04 15:00:00+00:00 | 2024-11-07 11:00:00+00:00 | 72 | Transfer from another hospital | Acute Care Transfer | Transferred to Acute Inpatient Rehab Facility | Acute Inpatient Rehab Facility | 46311 | 463110000 | 170313301002 | 41.55030 | -87.30101 |
| 101003 | 11223344 | 11223344 | 2024-10-20 07:45:00+00:00 | 2024-10-22 10:20:00+00:00 | 59 | Pre-op surgical | Pre-op | Expired | Expired | 60446 | 604460000 | 170313401003 | 41.70010 | -87.60315 |

## Hospital Diagnosis

Record of all diagnoses associated with the hospitalization. Expect breaking changes to this table as we seek to align it with existing diagnosis ontologies



**Example**:

| patient\_id | diagnostic\_code | diagnosis\_code\_format | start\_dttm | end\_dttm |
|---|---|---|---|---|
| 1001014 | 250.00 | icd9 | 2023-05-01 08:00:00+00:00 | 2023-05-10 08:00:00+00:00 |
| 1001014 | J45.909 | icd10 | 2023-05-01 08:00:00+00:00 | 2023-05-15 08:00:00+00:00 |
| 1002025 | 401.9 | icd9 | 2023-06-10 09:00:00+00:00 | 2023-06-12 09:00:00+00:00 |
| 1002025 | E11.9 | icd10 | 2023-06-10 09:00:00+00:00 | 2023-06-20 09:00:00+00:00 |
| 1003036 | 414.01 | icd9 | 2023-07-15 07:30:00+00:00 | 2023-07-30 07:30:00+00:00 |
| 1003036 | I25.10 | icd10 | 2023-07-15 07:30:00+00:00 | 2023-07-25 07:30:00+00:00 |
| 1004047 | 530.81 | icd9 | 2023-08-20 10:00:00+00:00 | 2023-08-22 10:00:00+00:00 |
| 1004047 | K21.9 | icd10 | 2023-08-20 10:00:00+00:00 | 2023-08-24 10:00:00+00:00 |

## Labs

The labs table is a long form (one lab result per row) longitudinal table.

**Notes**: The `lab_value` field often has non-numeric entries that are useful to make project-specific decisions. A site may choose to keep the `lab_value` field as a character and create a new field `lab_value_numeric` that only parses the character field to extract the numeric part of the string.
\
**Example**:

| hospitalization\_id | lab\_order\_dttm | lab\_collect\_dttm | lab\_result\_dttm | lab\_order\_name | lab\_name | lab\_category | lab\_value | lab\_value\_numeric | reference\_unit | lab\_loinc\_code | lab\_specimen\_name | lab\_specimen\_category |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12345 | 2024-12-01 08:15:00+00:00 | 2024-12-01 08:30:00+00:00 | 2024-12-01 09:00:00+00:00 | Complete Blood Count | Hemoglobin | hemoglobin | 12.3 | 12.3 | g/dL | 718-7 | Complete Blood Count | blood |
| 12345 | 2024-12-01 08:15:00+00:00 | 2024-12-01 08:30:00+00:00 | 2024-12-01 09:05:00+00:00 | Complete Blood Count | White Blood Cell Count | wbc | 5.6 | 5.6 | 10^3/uL | 6690-2 | Complete Blood Count | blood |  |
| 12345 | 2024-12-01 08:15:00+00:00 | 2024-12-01 08:30:00+00:00 | 2024-12-01 09:10:00+00:00 | Metabolic Panel | Sodium | sodium | 138 | 138 | mmol/L | 2951-2 | Metabolic Panel | serum |  |
| 12345 | 2024-12-01 08:15:00+00:00 | 2024-12-01 08:30:00+00:00 | 2024-12-01 09:20:00+00:00 | Metabolic Panel | Potassium | potassium | 4.1 | 4.1 | mmol/L | 2823-3 | Metabolic Panel | serum |  |
| 67890 | 2024-12-01 09:30:00+00:00 | 2024-12-01 09:45:00+00:00 | 2024-12-01 10:15:00+00:00 | Arterial Blood Gas | pH | ph | 7.35 | 7.35 |  | 2744-1 | Arterial Blood Gas | blood |  |
| 67890 | 2024-12-01 09:30:00+00:00 | 2024-12-01 09:45:00+00:00 | 2024-12-01 10:20:00+00:00 | Arterial Blood Gas | pCO2 | pco2 | 40 | 40 | mmHg | 2019-8 | Arterial Blood Gas | blood |  |
| 67890 | 2024-12-01 09:30:00+00:00 | 2024-12-01 09:45:00+00:00 | 2024-12-01 10:25:00+00:00 | Arterial Blood Gas | pO2 | po2 | 90 | 90 | mmHg | 2703-7 | Arterial Blood Gas | blood |  |
| 67890 | 2024-12-01 09:30:00+00:00 | 2024-12-01 09:45:00+00:00 | 2024-12-01 10:30:00+00:00 | Arterial Blood Gas | Bicarbonate | bicarbonate | 24 | 24 | mmol/L | 2028-3 | Arterial Blood Gas | blood |  |

## Medication Admin Continuous

The medication admin continuous table is a long-form (one medication administration record per) longitudinal table designed for continuous infusions of common ICU medications such as vasopressors and sedation (Boluses of these drugs should be recorded in `med_admin_intermittent`). Note that it only reflects dose changes of the continuous medication and does not have a specific "end\_time" variable to indicate the medication being stopped. The end of a continuous infusion should be recorded as a new row with med\_dose = 0 and an appropriate mar\_action\_name (e.g. "stopped" or "paused").



**Example**:

| hospitalization\_id | admin\_dttm | med\_name | med\_category | med\_group | med\_route\_name | med\_route\_category | med\_dose | med\_dose\_unit | mar\_action\_name |
|---|---|---|---|---|---|---|---|---|---|
| 792391 | 2123-11-13 12:28:00+00:00 | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION | propofol | sedation | Intravenous | NA | 75.0000 | mcg/kg/min | New Bag |
| 792391 | 2123-11-13 13:49:00+00:00 | REMIFENTANIL CONTINUOUS IV (ANESTHESIA) | remifentanil | sedation | NA | NA | 0.0500 | mcg/kg/min | New Bag |
| 792391 | 2123-11-13 14:03:00+00:00 | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION | propofol | sedation | Intravenous | NA | 0.0000 | mcg/kg/min | Stopped |
| 370921 | 2123-02-12 03:07:00+00:00 | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE | phenylephrine | vasoactives | Intravenous | NA | 20.0000 | mcg/min | New Bag |
| 370921 | 2123-02-12 03:14:00+00:00 | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE | phenylephrine | vasoactives | Intravenous | NA | 50.0000 | mcg/min | Rate Change |
| 702344 | 2123-04-27 04:30:00+00:00 | HEPARIN (PORCINE) 25,000 UNIT/250 ML IN 0.45 % SODIUM CHLORIDE | heparin | anticoagulation | Intravenous | NA | 18.0000 | Units/kg/hr | New Bag |

## Microbiology Culture

The microbiology culture table is a wide longitudinal table that captures the order and result times of microbiology culture tests, the type of fluid collected, the component of the test, and the organism identified.



**Example**:

| hospitalization\_id | order\_dttm | collect\_dttm | result\_dttm | fluid\_name | fluid\_category | method\_name | method\_category | organism\_category | organism\_group |
|---|---|---|---|---|---|---|---|---|---|
| 12345 | 2023-10-01 14:00:00+00:00 | 2023-10-01 15:00:00+00:00 | 2023-10-03 10:00:00+00:00 | culture, blood (bacterial & fungal) | blood/buffy coat | culture | culture | no growth | no growth |
| 12345 | 2023-10-01 16:00:00+00:00 | 2023-10-01 17:00:00+00:00 | 2023-10-03 12:00:00+00:00 | culture, urine | genito-urinary tract | culture | culture | escherichia\_coli | escherichia (also e. coli) |
| 12346 | 2023-11-01 10:30:00+00:00 | 2023-11-01 11:15:00+00:00 | 2023-11-02 09:00:00+00:00 | culture & stain, respiratory | lower respiratory tract | gram stain | gram stain | gram positive cocci | gram positive cocci (nos) |
| 12346 | 2023-11-02 12:00:00+00:00 | 2023-11-02 12:45:00+00:00 | 2023-11-03 08:30:00+00:00 | culture, cerebrospinal fluid | csf | culture | culture | no growth | no growth |
| 12347 | 2023-09-15 14:20:00+00:00 | 2023-09-15 15:00:00+00:00 | 2023-09-17 11:30:00+00:00 | culture & stain, afb | other unspecified | afb smear | smear | no growth | no growth |
| 12348 | 2023-08-10 09:00:00+00:00 | 2023-08-10 09:45:00+00:00 | 2023-08-12 08:00:00+00:00 | culture, blood (bacterial & fungal) | blood/buffy coat | culture | culture | staphylococcus\_aureus | staphylococcus (all) |
| 12349 | 2023-07-25 11:00:00+00:00 | 2023-07-25 11:30:00+00:00 | 2023-07-27 10:15:00+00:00 | culture, urine | genito-urinary tract | culture | culture | enterococcus\_faecium | enterococcus (all species) |
| 12350 | 2023-06-15 13:30:00+00:00 | 2023-06-15 14:00:00+00:00 | 2023-06-17 09:45:00+00:00 | culture & stain, respiratory | lower respiratory tract | gram stain | gram stain | gram negative rod | gram negative rod (nos) |

## Microbiology Non culture

The microbiology non-culture table is a wide longitudinal table that captures the order and result times of non-culture microbiology tests, the type of fluid collected, the component of the test, and the result of the test.



**Example**:

| hospitalization\_id | result\_dttm | collect\_dttm | order\_dttm | fluid\_name | component\_category | result\_unit\_category | result\_category |
|---|---|---|---|---|---|---|---|
| 101 | 2024-01-01 10:00:00+00:00 | 2024-01-01 08:00:00+00:00 | 2024-01-01 07:30:00+00:00 | Blood | PCR | Units/mL | Positive |
| 102 | 2024-01-02 11:30:00+00:00 | 2024-01-02 09:30:00+00:00 | 2024-01-02 08:15:00+00:00 | Cerebrospinal Fluid | Antigen Detection | mg/L | Negative |
| 103 | 2024-01-03 15:00:00+00:00 | 2024-01-03 13:00:00+00:00 | 2024-01-03 12:45:00+00:00 | Sputum | Gene Amplification | copies/mL | Detected |
| 104 | 2024-01-04 09:45:00+00:00 | 2024-01-04 07:15:00+00:00 | 2024-01-04 06:30:00+00:00 | Urine | Molecular Pathogen ID | ng/mL | Not Detected |
| 105 | 2024-01-05 18:00:00+00:00 | 2024-01-05 16:00:00+00:00 | 2024-01-05 15:00:00+00:00 | Pleural Fluid | Protein Quantification | g/dL | Elevated |

## Patient

This table contains demographic information about the patient that does not vary between hospitalizations. It is inspired by the OMOP [Person](https://ohdsi.github.io/CommonDataModel/cdm54.html#person) table



**Example**:

| patient\_id | race\_name | race\_category | ethnicity\_name | ethnicity\_category | sex\_category | birth\_date | death\_dttm | language\_name | language\_category |
|---|---|---|---|---|---|---|---|---|---|
| 132424 | Black or African-American | Black or African American | Not Hispanic, Latino/a, or Spanish origin | Non-Hispanic | Male | 2145-05-09 | NA | English | English |
| 132384 | White | White | Not Hispanic, Latino/a, or Spanish origin | Non-Hispanic | Female | 2145-03-30 | NA | English | English |
| 542367 | Black or African-American | Black or African American | Not Hispanic, Latino/a, or Spanish origin | Non-Hispanic | Male | 2145-01-29 | NA | English | English |
| 989862 | White | White | Not Hispanic, Latino/a, or Spanish origin | Non-Hispanic | Female | 2145-11-06 | NA | English | English |
| 428035 | More than one Race | Other | Not Hispanic, Latino/a, or Spanish origin | Non-Hispanic | Male | 2145-10-13 | NA | English | English |

## Patient Assessments

The patient\_assessments table captures various assessments performed on patients across different domains, including neurological status, sedation levels, pain, and withdrawal. The table is designed to provide detailed information about the assessments, such as the name of the assessment, the category, and the recorded values.


**Example**:

| hospitalization\_id | recorded\_dttm | assessment\_name | assessment\_category | assessment\_group | numerical\_value | categorical\_value | text\_value |
|---|---|---|---|---|---|---|---|
| 12345 | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT EYE OPENING | gcs\_eye | Neurological | 4 | NA | NA |
| 12345 | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT VERBAL RESPONSE | gcs\_verbal | Neurological | 5 | NA | NA |
| 12345 | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT BEST MOTOR RESPONSE | gcs\_motor | Neurological | 6 | NA | NA |
| 12345 | 2024-12-01 08:15:00+00:00 | NUR RA GLASGOW ADULT SCORING | gcs\_total | Neurological | 15 | NA | NA |
| 67890 | 2024-12-01 10:30:00+00:00 | BRADEN ASSESSMENT | braden\_total | Nursing Risk | 18 | NA | NA |
| 67890 | 2024-12-01 10:30:00+00:00 | SAT SCREEN | sat\_delivery\_pass\_fail | Sedation | NA | Pass | NA |

## Position

The position table is a long form (one position per row) longitudinal table that captures all documented position changes of the patient. The table is designed for the explicit purpose of constructing the `position_category` CDE and identifying patients in prone position.



**Example**:

| hospitalization\_id | recorded\_dttm | position\_name | position\_category |
|---|---|---|---|
| 84 | 2123-06-20 00:00:00+00:00 | Supine–turn R | not\_prone |
| 84 | 2123-06-20 06:00:00+00:00 | Supine–turn L | not\_prone |
| 84 | 2123-06-20 12:00:00+00:00 | Supine–back | not\_prone |
| 84 | 2123-06-20 16:00:00+00:00 | Supine–turn R | not\_prone |
| 84 | 2123-06-20 20:00:00+00:00 | Supine–back;Supine–turn intolerant | not\_prone |
| 84 | 2123-06-20 22:00:00+00:00 | Supine–turn intolerant,microturn L | not\_prone |
| 84 | 2123-06-20 00:00:00+00:00 | Supine–turn intolerant,microturn L;Supine–back | not\_prone |
| 84 | 2123-06-20 01:10:00+00:00 | 30 Degrees | not\_prone |

## Respiratory Support

The respiratory support table is a wider longitudinal table that captures simultaneously recorded ventilator settings and observed ventilator parameters. The table is designed to capture the most common respiratory support devices and modes used in the ICU. It will be sparse for patients who are not on mechanical ventilation.

**Notes**:
**Expected `*_set` values for each `device_category` and `mode_category`**

**1. `device_category` == "IMV"**

|     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- |
| ventilator setting | `Assist Control-Volume Control` | `Pressure Support/CPAP` | `Pressure Control` | `Pressure-Regulated Volume Control` | `SIMV` | `Volume Support` |
| fio2\_set | E | E | E | E | E | E |
| tidal\_volume\_set | E |  |  | E | P | E |
| resp\_rate\_set | E |  | E | E | E |  |
| pressure\_control\_set |  |  | E |  | P |  |
| pressure\_support\_set |  | E |  |  | E |  |
| flow\_rate\_set | P |  |  |  | P |  |
| inspiratory\_time\_set | P |  | E |  | P |  |
| peep\_set | E | E | E | E | E | E |

E = Expected ventilator setting for the mode, P = possible ventilator setting for the mode.

**2. `device_category` == "NIPPV"**

`mode_category` is `Pressure Support/CPAP` and the `fio2_set`, `peep_set` , and either `pressure_support_set` OR `peak_inspiratory_pressure_set` (IPAP) is required.

**3. `device_category` == "CPAP"**

`mode_category` is `Pressure Support/CPAP` and the `fio2_set` and `peep_set` are required.

**4.`device_category` == "High Flow NC"**

`mode_category` is NA and the `fio2_set` and `lpm_set` are required.

**5. `device_category` == "Face Mask"**

`mode_category` is NA `lpm_set` is required. `fio2_set` is possible.

**6. `device_category` == "Trach Collar" or "Nasal Cannula"**

`mode_category` is NA and `lpm_set` is required.
\
**Example**:

| hospitalization\_id | recorded\_dttm | device\_name | device\_id | device\_category | mode\_name | mode\_category | vent\_brand\_name | tracheostomy | fio2\_set | lpm\_set | tidal\_volume\_set | resp\_rate\_set | pressure\_control\_set | pressure\_support\_set | flow\_rate\_set | peak\_inspiratory\_pressure\_set | tidal\_volume\_obs | resp\_rate\_obs | plateau\_pressure\_obs | peak\_inspiratory\_pressure\_obs | peep\_obs | minute\_vent\_obs | mean\_airway\_pressure\_obs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12345 | 2024-12-01 08:00:00+00:00 | Ventilator | DEV001 | IMV | CMV Volume Ctrl | Assist Control-Volume Control | Vent A | 1 | 0.50 | 40 | 500 | 18 | 15 | 5 | 50 | 450 | 18 | 20 | 25 | 5 | 9.0 | 12.0 |
| 12345 | 2024-12-01 09:00:00+00:00 | Ventilator | DEV001 | IMV | SIMV | SIMV | Vent A | 1 | 0.45 | 35 | 480 | 20 | 18 | 8 | 55 | 470 | 20 | 21 | 28 | 6 | 10.5 | 14.0 |
| 67890 | 2024-12-01 10:30:00+00:00 | HFNC | DEV002 | High Flow NC | N/A | Other | N/A | 0 | 0.30 | 60 | NA | NA | NA | NA | 60 | NA | NA | NA | NA | NA | NA | NA |
| 67890 | 2024-12-01 11:00:00+00:00 | CPAP | DEV003 | CPAP | CPAP | Pressure Support/CPAP | CPAP X | 0 | 0.40 | 50 | NA | NA | NA | 10 | NA | NA | NA | NA | NA | 8 | NA | NA |

## Vitals

The vitals table is a long-form (one vital sign per row) longitudinal table.



**Example**:

| hospitalization\_id | recorded\_dttm | vital\_name | vital\_category | vital\_value | meas\_site\_name |
|---|---|---|---|---|---|
| 20010012 | 2024-12-01 08:00:00+00:00 | HEIGHT | height\_cm | 170.0 | unspecified |
| 20010012 | 2024-12-01 08:15:00+00:00 | WEIGHT | weight\_kg | 70.0 | unspecified |
| 20010012 | 2024-12-01 08:30:00+00:00 | PULSE | heart\_rate | 72.0 | unspecified |
| 20010012 | 2024-12-01 08:45:00+00:00 | BLOOD PRESSURE (SYSTOLIC) | sbp | 120.0 | unspecified |
| 20010012 | 2024-12-01 08:45:00+00:00 | BLOOD PRESSURE (DIASTOLIC) | dbp | 80.0 | unspecified |
| 20010012 | 2024-12-01 08:50:00+00:00 | RESPIRATORY RATE | respiratory\_rate | 16.0 | unspecified |
| 20010012 | 2024-12-01 09:00:00+00:00 | TEMPERATURE | temp\_c | 36.8 | unspecified |
| 20010012 | 2024-12-01 09:15:00+00:00 | SPO2 | spo2 | 98.0 | unspecified |
| 20010013 | 2024-12-01 09:30:00+00:00 | MEAN ARTERIAL PRESSURE (MAP) | map | 85.0 | arterial |

## Concept Tables

A planned future CLIF table that has yet to be used in a federated project. The table structure and CDE elements are in draft form. Permissible values of category variables may still need to be defined. Seeking conceptual feedback. Significant changes to all aspects of the table are possible.

## Intake Output

The intake\_output table is long form table that captures the times intake and output events were recorded, the type of fluid administered or recorded as "out", and the amount of fluid.


**Example**:

| hospitalization\_id | intake\_dttm | fluid\_name | amount | in\_out\_flag |
|---|---|---|---|---|
| 1001 | 2024-01-01 08:00:00+00:00 | Normal Saline | 500 | 1 |
| 1001 | 2024-01-01 10:30:00+00:00 | Urine | 300 | 0 |
| 1002 | 2024-01-05 09:15:00+00:00 | Dextrose | 250 | 1 |
| 1002 | 2024-01-05 14:00:00+00:00 | Urine | 400 | 0 |
| 1003 | 2024-01-10 07:45:00+00:00 | Lactated Ringer's | 600 | 1 |
| 1003 | 2024-01-10 12:00:00+00:00 | Drainage | 200 | 0 |

## Invasive Hemodynamics

The `invasive_hemodynamics` table records invasive hemodynamic measurements during a patient's hospitalization. These measurements represent pressures recorded via invasive monitoring and are expressed in millimeters of mercury (mmHg).



**Notes**:

- All `measure_value` entries should be recorded in mmHg.
- The `measure_category` field ensures standardization of invasive hemodynamic data.

  - `CVP` \- Central Venous Pressure
  - `RA` \- Right Atrial Pressure
  - `RV` \- Right Ventricular Pressure
  - `PA_systolic` \- Pulmonary Artery Systolic Pressure
  - `PA_diastolic` \- Pulmonary Artery Diastolic Pressure
  - `PA_mean` \- Pulmonary Artery Mean Pressure
  - `PCWP` \- Pulmonary Capillary Wedge Pressure
\
**Example**:

| hospitalization\_id | recorded\_dttm | measure\_name | measure\_category | measure\_value |
|---|---|---|---|---|
| 12345 | 2024-12-01 08:30:00+00:00 | CVP | CVP | 12.50 |
| 12345 | 2024-12-01 09:00:00+00:00 | Pulmonary Artery-Sys | PA\_systolic | 25.00 |
| 12345 | 2024-12-01 09:30:00+00:00 | Wedge | PCWP | 18.75 |

## Key ICU orders

The `key_icu_orders` table captures key orders related to physical therapy (PT) and occupational therapy (OT) during ICU stays. It includes details about the hospitalization, the timing of the order, the specific name of the order, its category, and the status of the order (completed or sent).



**Example**:

| hospitalization\_id | order\_dttm | order\_name | order\_category | order\_status\_name |
|---|---|---|---|---|
| 12345 | 2024-12-15 10:00:00+00:00 | PT Initial Evaluation | PT\_evaluation | completed |
| 67890 | 2024-12-16 14:30:00+00:00 | OT Follow-up Treatment | OT\_treat | sent |
| 54321 | 2024-12-16 08:00:00+00:00 | PT Mobility Session | PT\_treat | completed |
| 98765 | 2024-12-15 11:15:00+00:00 | OT Cognitive Assessment | OT\_evaluation | sent |

## Medication Admin Intermittent

This table has exactly the same schema as [`medication_admin_continuous`](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.1.0.html#medication-admin-continuous) described below. The consortium decided to separate the medications that are administered intermittently from the continuously administered medications. The mCIDE for `