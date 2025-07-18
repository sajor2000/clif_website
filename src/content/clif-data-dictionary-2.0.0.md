The CLIF Data Dictionary serves as a comprehensive guide to the Common Longitudinal ICU data Format, detailing the structure and purpose of each table within the framework. Designed to standardize and harmonize electronic health record data across multiple institutions, the dictionary outlines the entity-relationship model, variable definitions, and permissible values.

![ERD](/images/ERD-2.0.0-071125.png)

# **Beta tables**

The table purpose, structure, and field names for beta tables is complete and used in at least one federated CLIF project. The [minimum Common ICU Data Elements (mCIDE)](https://clif-consortium.github.io/website/mCIDE.html) for category variables is defined. Actively testing the table’s practical use in projects. Breaking changes unlikely, but backward compatible updates in future minor versions possible

## ADT [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#adt)

The admission, discharge, and transfer (ADT) table is a start-stop longitudinal dataset that contains information about each patient’s movement within the hospital. It also has a `hospital_id` field to distinguish between different hospitals within a health system.

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter | No restriction |  |
| hospital\_id | VARCHAR | Assign a unique ID to each hospital within a healthsystem | No restriction |  |
| hospital\_type | VARCHAR | Maps `hospital_id` to a standardized list of hospital types | `academic`, `community` |  |
| in\_dttm | DATETIME | Start date and time at a particular location. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00` (UTC) |  |
| out\_dttm | DATETIME | End date and time at a particular location. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00` (UTC) |  |
| location\_name | VARCHAR | Location of the patient inside the hospital. This field is used to store the patient location from the source data. It is not used for analysis. | No restriction |  |
| location\_category | VARCHAR | Maps `location_name` to a standardized list of ADT location categories | `ed`, `ward`, `stepdown`, `icu`, `procedural`, `l&d`, `hospice`, `psych`, `rehab`, `radiology`, `dialysis`, `other` |  |

**Notes**:

- ADT represents the patient’s physical location, NOT the patient “status”.
- Procedural areas and operating rooms should be mapped to `Procedural`. Pre/Intra/Post-procedural/OR EHR data (such as anesthesia flowsheet records from Labs, Vitals, Scores, Respiratory Support) **are not currently** represented in CLIF.

**Example**:

| hospitalization_id | hospital_id | hospital_type | in_dttm | out_dttm | location_name | location_category |
|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | ABC | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">academic</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:00:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 14:00:00+00:00</span> | B06F | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">icu</span> |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | ABC | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">academic</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 14:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-02 08:00:00+00:00</span> | B78D | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">ward</span> |
| <span class="text-clif-burgundy font-mono font-semibold">20010015</span> | ABC | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">academic</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-30 16:45:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 12:00:00+00:00</span> | B06T | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">icu</span> |
| <span class="text-clif-burgundy font-mono font-semibold">20010015</span> | ABC | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">academic</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 12:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-02 07:00:00+00:00</span> | N23E | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">procedural</span> |
| <span class="text-clif-burgundy font-mono font-semibold">20010020</span> | EFG | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">community</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-28 09:00:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-29 17:00:00+00:00</span> | B78D | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">ward</span> |

## Hospitalization [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#hospitalization)

The hospitalization table contains information about each hospitalization event. Each row in this table represents a unique hospitalization event for a patient. This table is inspired by the [visit\_occurance](https://ohdsi.github.io/CommonDataModel/cdm54.html#visit_occurrence) OMOP table but is specific to inpatient hospitalizations (including those that begin in the emergency room).

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| patient\_id | VARCHAR | Unique identifier for each patient, linking to the `patient` table | No restriction | |
| hospitalization\_id | VARCHAR | Unique identifier for each hospitalization encounter. Each hospitalization\_id represents a unique stay in the hospital | No restriction | |
| hospitalization\_joined\_id | VARCHAR | Unique identifier for each continuous inpatient stay in a health system which may span different hospitals (Optional) | No restriction |
| admission\_dttm | DATETIME | Date and time the patient is admitted to the hospital. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00`(UTC) |
| discharge\_dttm | DATETIME | Date and time the patient is discharged from the hospital. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00`(UTC) |
| age\_at\_admission | INT | Age of the patient at the time of admission, in years | No restriction |
| admission\_type\_name | VARCHAR | Type of inpatient admission. Original string from the source data | e.g. “Direct admission”, “Transfer”, “Pre-op surgical” |
| admission\_type\_category | VARCHAR | Admission disposition mapped to mCIDE categories | Under-development |
| discharge\_name | VARCHAR | Original discharge disposition name string recorded in the raw data | No restriction, e.g. “home” |
| discharge\_category | VARCHAR | Maps `discharge_name` to a standardized list of discharge categories | `Home`, `Skilled Nursing Facility (SNF)`, `Expired`, `Acute Inpatient Rehab Facility`, `Hospice`, `Long Term Care Hospital (LTACH)`, `Acute Care Hospital`, `Group Home`, `Chemical Dependency`, `Against Medical Advice (AMA)`, `Assisted Living`, `Still Admitted`, `Missing`, `Other`, `Psychiatric Hospital`, `Shelter`, `Jail` |
| zipcode\_nine\_digit | VARCHAR | Patient’s 9 digit zip code, used to link with other indices such as ADI and SVI | No restriction |
| zipcode\_five\_digit | VARCHAR | Patient’s 5 digit zip code, used to link with other indices such as ADI and SVI | No restriction |
| census\_block\_code | VARCHAR | 15 digit FIPS code | No restriction |
| census\_block\_group\_code | VARCHAR | 12 digit FIPS code | No restriction |
| census\_tract | VARCHAR | 11 digit FIPS code | No restriction |
| state\_code | VARCHAR | 2 digit FIPS code | No restriction |
| county\_code | VARCHAR | 5 digit FIPS code | No restriction |

**Notes**:

1. If a patient is discharged to Home/Hospice, then `discharge_category == Hospice`.

2. The geographical indicators( `zipcode_nine_digit`, `zipcode_five_digit`, `census_block_code`, `census_block_group_code`, `census_tract`, `state_code`, `county_code`) should be added if they are available in your source dataset. `zipcode_nine_digit` is preferred over `zipcode_five_digit`, and `census_block_code` is ideal for census based indicators.The choice of geographical indicators may differ depending on the project.

3. If a patient is transferred between different hospitals within a health system, a new `hospitalization_id` should be created

4. If a patient is initially seen in an ER in hospital A and then admitted to inpatient status in hospital B, one `hospitalization_id` should be created for data from both stays

5. A `hospitalization_joined_id` can also be created from a CLIF table from contiguous `hospitalization_ids`


**Example**:

| patient\_id | hospitalization\_id | hospitalization\_joined\_id | admission\_dttm | discharge\_dttm | age\_at\_admission | admission\_type\_name | admission\_type\_category | discharge\_name | discharge\_category | zipcode\_five\_digit | zipcode\_nine\_digit | census\_block\_code | latitude | longitude |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">101001</span> | <span class="text-clif-burgundy font-mono font-semibold">12345678</span> | <span class="text-clif-burgundy font-mono font-semibold">22334455</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-01 08:15:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-04 14:30:00+00:00</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">65</span> | Direct admission | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Inpatient</span> | Discharged to Home or Self Care (Routine Discharge) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Home</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60637</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">606370000</span> | 170313202001 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">41.81030</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">-87.59697</span> |
| <span class="text-clif-burgundy font-mono font-semibold">101002</span> | <span class="text-clif-burgundy font-mono font-semibold">87654321</span> | <span class="text-clif-burgundy font-mono font-semibold">22334455</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-04 15:00:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-11-07 11:00:00+00:00</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">72</span> | Transfer from another hospital | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Acute Care Transfer</span> | Transferred to Acute Inpatient Rehab Facility | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Acute Inpatient Rehab Facility</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">46311</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">463110000</span> | 170313301002 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">41.55030</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">-87.30101</span> |
| <span class="text-clif-burgundy font-mono font-semibold">101003</span> | <span class="text-clif-burgundy font-mono font-semibold">11223344</span> | <span class="text-clif-burgundy font-mono font-semibold">11223344</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-10-20 07:45:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-10-22 10:20:00+00:00</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">59</span> | Pre-op surgical | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Pre-op</span> | Expired | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Expired</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60446</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">604460000</span> | 170313401003 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">41.70010</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">-87.60315</span> |

## Labs [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#labs)

The labs table is a long form (one lab result per row) longitudinal table.

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter. | No restriction |
| lab\_order\_dttm | DATETIME | Date and time when the lab is ordered. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00` (UTC) |
| lab\_collect\_dttm | DATETIME | Date and time when the specimen is collected. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00` (UTC) |
| lab\_result\_dttm | DATETIME | Date and time when the lab results are available. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00` (UTC) |
| lab\_order\_name | VARCHAR | Procedure name for the lab, e.g. “Complete blood count w/ diff” | No restriction |
| lab\_order\_category | VARCHAR | Maps `lab_order_name` to standardized list of common lab order names, e.g. “CBC” | [List of lab order categories in CLIF](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_labs_order_categories.csv) |
| lab\_name | VARCHAR | Original lab component as recorded in the raw data, e.g. “AST (SGOT)”. | No restriction |
| lab\_category | VARCHAR | Maps `lab_name` to a minimum set of standardized labs identified by the CLIF consortium as minimum necessary labs for the study of critical illness. | [List of lab categories in CLIF](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_lab_categories.csv) |
| lab\_value | VARCHAR | Recorded value corresponding to a lab. Lab values are often strings that can contain non-numeric results (e.g. “> upper limit of detection”). | No restriction |
| lab\_value\_numeric | DOUBLE | Parse out numeric part of the lab\_value variable (optional). | Numeric |
| reference\_unit | VARCHAR | Unit of measurement for that lab. | Permissible reference values for each `lab_category` listed [here](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_lab_categories.csv) |
| lab\_specimen\_name | VARCHAR | Original fluid or tissue name the lab was collected from as given in the source data | No restriction |
| lab\_specimen\_category | VARCHAR | fluid or tissue the lab was collected from, analogous to the LOINC “system” component. | working CDE `c(blood/plasma/serum, urine, csf, other)`. |
| lab\_loinc\_code | VARCHAR | [LOINC](https://loinc.org/get-started/loinc-term-basics/) code for the lab | No restrictions |

**Note**: The `lab_value` field often has non-numeric entries that are useful to make project-specific decisions. A site may choose to keep the `lab_value` field as a character and create a new field `lab_value_numeric` that only parses the character field to extract the numeric part of the string.

**Example**:

| hospitalization\_id | lab\_order\_dttm | lab\_collect\_dttm | lab\_result\_dttm | lab\_order\_name | lab\_name | lab\_category | lab\_value | lab\_value\_numeric | reference\_unit | lab\_loinc\_code | lab\_order\_category | lab\_specimen\_category | lab\_specimen\_name |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:00:00+00:00</span> | Complete Blood Count | Hemoglobin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">hemoglobin</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">12.3</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">12.3</span> | g/dL | 718-7 | Complete Blood Count | blood |  |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:05:00+00:00</span> | Complete Blood Count | White Blood Cell Count | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">wbc</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5.6</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5.6</span> | 10^3/uL | 6690-2 | Complete Blood Count | blood |  |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:10:00+00:00</span> | Metabolic Panel | Sodium | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sodium</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">138</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">138</span> | mmol/L | 2951-2 | Metabolic Panel | serum |  |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:20:00+00:00</span> | Metabolic Panel | Potassium | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">potassium</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">4.1</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">4.1</span> | mmol/L | 2823-3 | Metabolic Panel | serum |  |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:45:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:15:00+00:00</span> | Arterial Blood Gas | pH | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">ph</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">7.35</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">7.35</span> |  | 2744-1 | Arterial Blood Gas | blood |  |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:45:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:20:00+00:00</span> | Arterial Blood Gas | pCO2 | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">pco2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">40</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">40</span> | mmHg | 2019-8 | Arterial Blood Gas | blood |  |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:45:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:25:00+00:00</span> | Arterial Blood Gas | pO2 | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">po2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">90</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">90</span> | mmHg | 2703-7 | Arterial Blood Gas | blood |  |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:30:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:45:00+00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:30:00+00:00</span> | Arterial Blood Gas | Bicarbonate | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">bicarbonate</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">24</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">24</span> | mmol/L | 2028-3 | Arterial Blood Gas | blood |  |

## Medication Admin Continuous [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#medication-admin-continuous)

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

The medication admin continuous table is a long-form (one medication administration record per) longitudinal table designed for continuous infusions of common ICU medications such as vasopressors and sedation (Boluses of these drugs should be recorded in `med_admin_intermittent`). Note that it only reflects dose changes of the continuous medication and does not have a specific “end\_time” variable to indicate the medication being stopped. The end of a continuous infusion should be recorded as a new row with med\_dose = 0 and an appropriate mar\_action\_name (e.g. “stopped” or “paused”).

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter |  |
| med\_order\_id | VARCHAR | Medication order ID. Foreign key to link this table to other medication tables |  |
| admin\_dttm | DATETIME | Date and time when the medicine was administered. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00`(UTC) |
| med\_name | VARCHAR | Original med name string recorded in the raw data which often contains concentration e.g. “NOREPInephrine 8 mg/250 mL” |  |
| med\_category | VARCHAR | Maps `med_name` to a limited set of active ingredients for important ICU medications, e.g. “norepinephrine” | [List of continuous medication categories in CLIF](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_medication_admin_continuous_med_categories.csv) |
| med\_group | VARCHAR | Limited number of ICU medication groups identified by the CLIF consortium, e.g. “vasoactives” | [List of continuous medication groups in CLIF](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_medication_admin_continuous_med_categories.csv) |
| med\_route\_name | VARCHAR | Medicine delivery route | e.g. IV, enteral |
| med\_route\_category | VARCHAR | Maps `med_route_name` to a standardized list of medication delivery routes | Under-development |
| med\_dose | DOUBLE | Quantity taken in dose |  |
| med\_dose\_unit | VARCHAR | Unit of dose. It must be a rate, e.g. mcg/min. Boluses should be mapped to `med_admin_intermittent` |  |
| mar\_action\_name | VARCHAR | MAR (medication administration record) action, e.g. “stopped” |  |
| mar\_action\_category | VARCHAR | Maps `mar_action_name` to a standardized list of MAR actions | Under-development |

**Example**:

| hospitalization\_id | admin\_dttm | med\_name | med\_category | med\_group | med\_route\_name | med\_route\_category | med\_dose | med\_dose\_unit | mar\_action\_name |
|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">792391</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-11-13 12:28:00+00:00</span> | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">propofol</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sedation</span> | Intravenous | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">75.0000</span> | mcg/kg/min | New Bag |
| <span class="text-clif-burgundy font-mono font-semibold">792391</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-11-13 13:49:00+00:00</span> | REMIFENTANIL CONTINUOUS IV (ANESTHESIA) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">remifentanil</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sedation</span> | NA | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.0500</span> | mcg/kg/min | New Bag |
| <span class="text-clif-burgundy font-mono font-semibold">792391</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-11-13 14:03:00+00:00</span> | PROPOFOL 10 MG/ML INTRAVENOUS EMULSION | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">propofol</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sedation</span> | Intravenous | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.0000</span> | mcg/kg/min | Stopped |
| <span class="text-clif-burgundy font-mono font-semibold">370921</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-02-12 03:07:00+00:00</span> | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">phenylephrine</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">vasoactives</span> | Intravenous | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20.0000</span> | mcg/min | New Bag |
| <span class="text-clif-burgundy font-mono font-semibold">370921</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-02-12 03:14:00+00:00</span> | PHENYLEPHRINE 5 MG/50 ML (100 MCG/ML) IN 0.9 % SODIUM CHLORIDE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">phenylephrine</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">vasoactives</span> | Intravenous | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">50.0000</span> | mcg/min | Rate Change |
| <span class="text-clif-burgundy font-mono font-semibold">702344</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-04-27 04:30:00+00:00</span> | HEPARIN (PORCINE) 25,000 UNIT/250 ML IN 0.45 % SODIUM CHLORIDE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">heparin</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">anticoagulation</span> | Intravenous | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">18.0000</span> | Units/kg/hr | New Bag |

## Patient [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#patient)

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

This table contains demographic information about the patient that does not vary between hospitalizations. It is inspired by the OMOP [Person](https://ohdsi.github.io/CommonDataModel/cdm54.html#person) table

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| patient\_id | VARCHAR | Unique identifier for each patient. This is presumed to be a distinct individual. |  |
| race\_name | VARCHAR | Patient race string from source data | No restriction |
| race\_category | VARCHAR | A standardized CDE description of patient’s race per the US Census permissible values. The source data may contain different strings for race. | `Black or African American`, `White`, `American Indian or Alaska Native`, `Asian`, `Native Hawaiian or Other Pacific Islander`, `Unknown`, `Other` |
| ethnicity\_name | VARCHAR | Patient ethnicity string from source data | No restriction |
| ethnicity\_category | VARCHAR | Description of patient’s ethnicity per the US census definition. The source data may contain different strings for ethnicity. | `Hispanic`, `Non-Hispanic`, `Unknown` |
| sex\_name | VARCHAR | Patient’s biological sex as given in the source data. | No restriction |
| sex\_category | VARCHAR | Patient’s biological sex. | `Male`, `Female`, `Unknown` |
| birth\_date | DATETIME | Patient’s date of birth. | Date format should be `YYYY-MM-DD` |
| death\_dttm | DATETIME | Patient’s death date, including time if available. | Datetime format should be `YYYY-MM-DD HH:MM:SS+00:00` (UTC) |
| language\_name | VARCHAR | Patient’s preferred language. | Original string from the source data |
| language\_category | VARCHAR | Maps `language_name` to a standardized list of spoken languages | Under-development |

**Example**:

| patient\_id | race\_name | race\_category | ethnicity\_name | ethnicity\_category | sex\_category | birth\_date | death\_dttm | language\_name | language\_category |
|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">132424</span> | Black or African-American | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Black or African American</span> | Not Hispanic, Latino/a, or Spanish origin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-Hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Male</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2145-05-09</span> | NA | English | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">English</span> |
| <span class="text-clif-burgundy font-mono font-semibold">132384</span> | White | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">White</span> | Not Hispanic, Latino/a, or Spanish origin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-Hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Female</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2145-03-30</span> | NA | English | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">English</span> |
| <span class="text-clif-burgundy font-mono font-semibold">542367</span> | Black or African-American | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Black or African American</span> | Not Hispanic, Latino/a, or Spanish origin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-Hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Male</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2145-01-29</span> | NA | English | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">English</span> |
| <span class="text-clif-burgundy font-mono font-semibold">989862</span> | White | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">White</span> | Not Hispanic, Latino/a, or Spanish origin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-Hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Female</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2145-11-06</span> | NA | English | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">English</span> |
| <span class="text-clif-burgundy font-mono font-semibold">428035</span> | More than one Race | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Other</span> | Not Hispanic, Latino/a, or Spanish origin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-Hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Male</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2145-10-13</span> | NA | English | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">English</span> |

## Patient Assessments [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#patient-assessments)

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

The patient\_assessments table captures various assessments performed on patients across different domains, including neurological status, sedation levels, pain, and withdrawal. The table is designed to provide detailed information about the assessments, such as the name of the assessment, the category, and the recorded values.

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | Primary Identifier. Unique identifier linking assessments to a specific patient hospitalization. |  |
| recorded\_dttm | DATETIME | The exact date and time when the assessment was recorded, ensuring temporal accuracy. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00`(UTC) |
| assessment\_name | VARCHAR | Assessment Tool Name. The primary name of the assessment tool used (e.g., GCS, NRS, SAT Screen). | No restriction |
| assessment\_category | VARCHAR | Maps `assessment_name` to a standardized list of patient assessments | List of permissible assessment categories [here](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_patient_assessment_categories.csv) |
| assessment\_group | VARCHAR | Broader Assessment Group. This groups the assessments into categories such as “Sedation,” “Neurologic,” “Pain,” etc. | List of permissible assessment groups [here](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_patient_assessment_categories.csv) |
| numerical\_value | DOUBLE | Numerical Assessment Result. The numerical result or score from the assessment component. | Applicable for assessments with numerical outcomes (e.g., 0-10, 3-15). |
| categorical\_value | VARCHAR | Categorical Assessment Result. The categorical outcome from the assessment component. | Applicable for assessments with categorical outcomes (e.g., Pass/Fail, Yes/No). |
| text\_value | VARCHAR | Textual Assessment Result. The textual explanation or notes from the assessment component. | Applicable for assessments requiring textual data. |

**Example**:

| hospitalization\_id | recorded\_dttm | assessment\_name | assessment\_category | assessment\_group | numerical\_value | categorical\_value | text\_value |
|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | NUR RA GLASGOW ADULT EYE OPENING | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gcs\_eye</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Neurological</span> | <span class="bg-green-50 text-green-700 px-1 rounded font-semibold">4</span> | NA | NA |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | NUR RA GLASGOW ADULT VERBAL RESPONSE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gcs\_verbal</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Neurological</span> | <span class="bg-green-50 text-green-700 px-1 rounded font-semibold">5</span> | NA | NA |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | NUR RA GLASGOW ADULT BEST MOTOR RESPONSE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gcs\_motor</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Neurological</span> | <span class="bg-green-50 text-green-700 px-1 rounded font-semibold">6</span> | NA | NA |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | NUR RA GLASGOW ADULT SCORING | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gcs\_total</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Neurological</span> | <span class="bg-green-50 text-green-700 px-1 rounded font-semibold">15</span> | NA | NA |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:30:00+00:00</span> | BRADEN ASSESSMENT | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">braden\_total</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Nursing Risk</span> | <span class="bg-green-50 text-green-700 px-1 rounded font-semibold">18</span> | NA | NA |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:30:00+00:00</span> | SAT SCREEN | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sat\_delivery\_pass\_fail</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Sedation</span> | NA | <span class="bg-green-50 text-green-700 px-1 rounded font-semibold">Pass</span> | NA |

## Position [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#position)

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

The position table is a long form (one position per row) longitudinal table that captures all documented position changes of the patient. The table is designed for the explicit purpose of constructing the `position_category` CDE and identifying patients in prone position.

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter. This table only includes those encounters that have proning documented ever. |  |
| recorded\_dttm | DATETIME | Date and time when the vital is recorded. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| position\_name | VARCHAR | This field is used to store the description of the position from the source data. This field is not used for analysis. | No restriction |
| position\_category | VARCHAR | Maps `position_name` to either prone or not prone. | `prone`, `not_prone` |

**Example**:

| hospitalization\_id | recorded\_dttm | position\_name | position\_category |
|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 00:00:00+00:00</span> | Supine–turn R | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 06:00:00+00:00</span> | Supine–turn L | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 12:00:00+00:00</span> | Supine–back | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 16:00:00+00:00</span> | Supine–turn R | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 20:00:00+00:00</span> | Supine–back;Supine–turn intolerant | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 22:00:00+00:00</span> | Supine–turn intolerant,microturn L | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 00:00:00+00:00</span> | Supine–turn intolerant,microturn L;Supine–back | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">84</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2123-06-20 01:10:00+00:00</span> | 30 Degrees | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not_prone</span> |

## Respiratory Support [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#respiratory-support)

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

The respiratory support table is a wider longitudinal table that captures simultaneously recorded ventilator settings and observed ventilator parameters. The table is designed to capture the most common respiratory support devices and modes used in the ICU. It will be sparse for patients who are not on mechanical ventilation.

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter |  |
| recorded\_dttm | DATETIME | Date and time when the device settings and/or measurement was recorded. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` (UTC) |
| device\_name | VARCHAR | Includes raw string of the devices. Not used for analysis | No restriction |
| device\_category | VARCHAR | Maps `device_name` to a standardized list of respiratory support device categories | `IMV`, `NIPPV`, `CPAP`, `High Flow NC`, `Face Mask`, `Trach Collar`, `Nasal Cannula`, `Room Air`, `Other` |
| vent\_brand\_name | VARCHAR | Ventilator model name when `device_category` is `IMV` or `NIPPV` (Optional) | No restriction |
| mode\_name | VARCHAR | Includes raw string of the modes, e.g. “CMV volume control” | No restriction |
| mode\_category | VARCHAR | Maps `mode_name` to a standardized list of modes of mechanical ventilation | `Assist Control-Volume Control`, `Pressure Control`, `Pressure-Regulated Volume Control`, `SIMV`, `Pressure Support/CPAP`, `Volume Support`, `Blow by`, `Other` |
| tracheostomy | INT | Indicates if tracheostomy is present | 0 = No, 1 = Yes |
| fio2\_set | DOUBLE | Fraction of inspired oxygen set in decimals (e.g. 0.21) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| lpm\_set | DOUBLE | Liters per minute set | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| tidal\_volume\_set | DOUBLE | Tidal volume set (in mL) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| resp\_rate\_set | DOUBLE | Respiratory rate set (in bpm) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| pressure\_control\_set | DOUBLE | Pressure control set (in cmH2O) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| pressure\_support\_set | DOUBLE | Pressure support set (in cmH2O) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| flow\_rate\_set | DOUBLE | Flow rate set | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| peak\_inspiratory\_pressure\_set | DOUBLE | Peak inspiratory pressure set (in cmH2O) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| inspiratory\_time\_set | DOUBLE | Inspiratory time set (in seconds) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| peep\_set | DOUBLE | Positive-end-expiratory pressure set (in cmH2O) | No restriction, see [Expected \_set values for each device\_category and mode\_category](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/outlier-handling/outlier_thresholds_respiratory_support.csv) |
| tidal\_volume\_obs | DOUBLE | Observed tidal volume (in mL) | No restriction |
| resp\_rate\_obs | DOUBLE | Observed respiratory rate (in bpm) | No restriction |
| plateau\_pressure\_obs | DOUBLE | Observed plateau pressure (in cmH2O) | No restriction |
| peak\_inspiratory\_pressure\_obs | DOUBLE | Observed peak inspiratory pressure (in cmH2O) | No restriction |
| peep\_obs | DOUBLE | Observed positive-end-expiratory pressure (in cmH2O) | No restriction |
| minute\_vent\_obs | DOUBLE | Observed minute ventilation (in liters) | No restriction |
| mean\_airway\_pressure\_obs | DOUBLE | Observed mean airway pressure | No restriction |

### Expected `*_set` values for each `device_category` and `mode_category` [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#expected-_set-values-for-each-device_category-and-mode_category)

#### `device_category` == “IMV” [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#device_category-imv)

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

#### `device_category` == “NIPPV” [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#device_category-nippv)

`mode_category` is `Pressure Support/CPAP` and the `fio2_set`, `peep_set` , and either `pressure_support_set` OR `peak_inspiratory_pressure_set` (IPAP) is required.

#### `device_category` == “CPAP” [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#device_category-cpap)

`mode_category` is `Pressure Support/CPAP` and the `fio2_set` and `peep_set` are required.

#### `device_category` == “High Flow NC” [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#device_category-high-flow-nc)

`mode_category` is NA and the `fio2_set` and `lpm_set` are required.

#### `device_category` == “Face Mask” [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#device_category-face-mask)

`mode_category` is NA `lpm_set` is required. `fio2_set` is possible.

#### `device_category` == “Trach Collar” or “Nasal Cannula” [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#device_category-trach-collar-or-nasal-cannula)

`mode_category` is NA and `lpm_set` is required.

**Example**:

| hospitalization\_id | recorded\_dttm | device\_name | device\_category | mode\_name | mode\_category | vent\_brand\_name | tracheostomy | fio2\_set | lpm\_set | tidal\_volume\_set | resp\_rate\_set | pressure\_control\_set | pressure\_support\_set | flow\_rate\_set | peak\_inspiratory\_pressure\_set | inspiratory\_time\_set | peep\_set | tidal\_volume\_obs | resp\_rate\_obs | plateau\_pressure\_obs | peak\_inspiratory\_pressure\_obs | peep\_obs | minute\_vent\_obs | mean\_airway\_pressure\_obs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:00:00+00:00</span> | Ventilator | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">IMV</span> | CMV Volume Ctrl | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Assist Control-Volume Control</span> | Vent A | 1 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.50</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">40</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">500</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">18</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">15</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">50</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">450</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">18</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">25</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">9.0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">12.0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">12345</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:00:00+00:00</span> | Ventilator | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">IMV</span> | SIMV | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">SIMV</span> | Vent A | 1 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.45</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">35</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">480</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">18</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">8</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">55</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">470</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">21</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">28</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">6</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">10.5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">14.0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 10:30:00+00:00</span> | HFNC | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">High Flow NC</span> | N/A | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Other</span> | N/A | 0 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.30</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60</span> | NA | NA | NA | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60</span> | NA | NA | NA | NA | NA | NA | NA |
| <span class="text-clif-burgundy font-mono font-semibold">67890</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 11:00:00+00:00</span> | CPAP | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">CPAP</span> | CPAP | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Pressure Support/CPAP</span> | CPAP X | 0 | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.40</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">50</span> | NA | NA | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">10</span> | NA | NA | NA | NA | NA | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">8</span> | NA | NA |

## Vitals [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#vitals)

The vitals table is a long-form (one vital sign per row) longitudinal table.

[![](https://img.shields.io/badge/Maturity-Beta-yellow.png)](https://clif-consortium.github.io/website/maturity.html)

| Column | Type | Description | Permissible Values | Notes |
|---|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter. | No restriction |
| recorded\_dttm | DATETIME | Date and time when the vital is recorded. All datetime variables must be timezone-aware and set to UTC. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` (UTC) |
| vital\_name | VARCHAR | This field is used to store the description of the flowsheet measure from the source data. This field is not used for analysis. | No restriction |
| vital\_category | VARCHAR | Maps `vital_name` to a list standard vital sign categories | `temp_c`, `heart_rate`, `sbp`, `dbp`, `spo2`, `respiratory_rate`, `map`, `height_cm`, `weight_kg` |
| vital\_value | DOUBLE | Recorded value of the vital. Ensure that the measurement unit is aligned with the permissible units of measurements. | `temp_c = Celsius`, `height_cm = Centimeters`, `weight_kg = Kg`, `map = mm/Hg`, `spo2 = %`. No unit for `heart_rate`, `sbp`, `dbp`, and `respiratory_rate` |
| meas\_site\_name | VARCHAR | Site where the vital is recorded. No CDE corresponding to this variable (Optional field) | No restrictions. Note: no \_category CDE variable exists yet |

**Example**:

| hospitalization\_id | recorded\_dttm | vital\_name | vital\_category | vital\_value | meas\_site\_name |
|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:00:00+00:00</span> | HEIGHT | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">height\_cm</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">170.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:15:00+00:00</span> | WEIGHT | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">weight\_kg</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">70.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:30:00+00:00</span> | PULSE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">heart\_rate</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">72.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:45:00+00:00</span> | BLOOD PRESSURE (SYSTOLIC) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sbp</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">120.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:45:00+00:00</span> | BLOOD PRESSURE (DIASTOLIC) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">dbp</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">80.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 08:50:00+00:00</span> | RESPIRATORY RATE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">respiratory\_rate</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">16.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:00:00+00:00</span> | TEMPERATURE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">temp\_c</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">36.8</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010012</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:15:00+00:00</span> | SPO2 | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">spo2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">98.0</span> | unspecified |
| <span class="text-clif-burgundy font-mono font-semibold">20010013</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-12-01 09:30:00+00:00</span> | MEAN ARTERIAL PRESSURE (MAP) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">map</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">85.0</span> | arterial |

# **Concept tables**

A planned future CLIF table that has yet to be used in a federated project. The table structure and CDE elements are in draft form. Permissible values of category variables may still need to be defined. Seeking conceptual feedback. Significant changes to all aspects of the table are possible.

## Code Status [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#code-status)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

This table provides a longitudinal record of changes in a patient’s code status during their hospitalization. It tracks the timeline and categorization of code status updates, facilitating the analysis of care preferences and decisions.

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| patient\_id | VARCHAR | Unique identifier for each patient, presumed to be a distinct individual. |  |
| start\_dttm | DATETIME | The date and time when the specific code status was initiated. | Example: `2024-12-03 08:30:00+00:00` |
| code\_status\_name | VARCHAR | The name/description of the code status. | Free text to describe the code status. |
| code\_status\_category | VARCHAR | Categorical variable specifying the code status during the hospitalization. | E.g., `DNR`, `DNAR`, `UDNR`, `DNR/DNI`, `DNAR/DNI`, `AND`, `Full`, `Presume Full`, `Other` |

**Notes**:

- The `code_status_category` set of permissible values is under development

**Example**:

| patient\_id | start\_dttm | code\_status\_name | code\_status\_category |
|---|---|---|---|
| 12345 | 2024-12-01 08:30:00+00:00 | Do Not Resuscitate | DNR |
| 12345 | 2024-12-02 14:00:00+00:00 | Do Not Intubate | DNR/DNI |
| 12345 | 2024-12-03 10:15:00+00:00 | Full Code | Full |

## CRRT Therapy [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#crrt-therapy)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The crrt\_therapy table captures Continuous Renal Replacement Therapy (CRRT) data, including different CRRT modalities, operational parameters, and fluid exchange details. The intermittent HD, peritoneal dialysis, PERT, and SLED tables are under development.

| Column | Type | Description |
|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for hospitalization episode |
| device\_id | VARCHAR | Unique identifier for dialysis machine |
| recorded\_dttm | DATETIME | Timestamp when CRRT parameters were recorded |
| crrt\_mode\_name | VARCHAR | Name of CRRT mode (e.g., “CVVHDF”) |
| crrt\_mode\_category | VARCHAR | `scuf`, `cvvh`, `cvvhd`, `cvvhdf` |
| dialysis\_machine\_name | VARCHAR | Unique identifier for the dialysis machine |
| blood\_flow\_rate | DOUBLE | Rate of blood flow through the CRRT circuit (mL/hr) |
| pre\_filter\_replacement\_fluid\_rate | DOUBLE | Rate of pre-filter replacement fluid infusion (mL/hr) |
| post\_filter\_replacement\_fluid\_rate | DOUBLE | Rate of post-filter replacement fluid infusion (mL/hr) |
| dialysate\_flow\_rate | DOUBLE | Flow rate of dialysate solution (mL/hr) |
| ultrafiltration\_out | DOUBLE | Net ultrafiltration output (mL) |

**Notes**:

1. **SCUF:** Slow Continuous Ultrafiltration
2. **CVVH:** Continuous Veno-Venous Hemofiltration
3. **CVVHD:** Continuous Veno-Venous Hemodialysis
4. **CVVHDF:** Continuous Venous-Venous Hemodiafiltration

#### **CRRT Modalities and Parameter Usage**: [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#crrt-modalities-and-parameter-usage)

| crrt\_mode\_category | blood\_flow\_rate | pre\_filter\_replacement\_fluid\_rate | post\_filter\_replacement\_fluid\_rate | dialysate\_flow\_rate | ultrafiltration\_out |
|---|---|---|---|---|---|
| **SCUF** | Required | Not Used | Not Used | Not Used | Required |
| **CVVH** | Required | Required | Required | Not Used | Required |
| **CVVHD** | Required | Not Used | Not Used | Required | Required |
| **CVVHDF** | Required | Required | Required | Required | Required |

**Example**:

| hospitalization\_id | device\_id | recorded\_dttm | crrt\_mode\_name | crrt\_mode\_category | blood\_flow\_rate | pre\_filter\_replacement\_fluid\_rate | post\_filter\_replacement\_fluid\_rate | dialysate\_flow\_rate | ultrafiltration\_out |
|---|---|---|---|---|---|---|---|---|---|
| 201 | J3 | 2024-02-15 07:00:00+00:00 | CVVHDF | CVVHDF | 200.0 | 1000.0 | 500.0 | 800.0 | 1500.0 |
| 202 | J7 | 2024-02-16 09:15:00+00:00 | CVVH | CVVH | 180.0 | 1200.0 | 300.0 | NA | 1300.0 |
| 203 | J11 | 2024-02-17 11:45:00+00:00 | SCUF | SCUF | 150.0 | NA | NA | NA | 800.0 |

## ECMO\_MCS [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#ecmo_mcs)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The ECMO/MCS table is a wider longitudinal table that captures the start and stop times of ECMO/MCS support, the type of device used, and the work rate of the device.

| Column | Type | Description |
|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for the hospitalization event. |
| recorded\_dttm | DATETIME | Date and time when the device settings and/or measurement was recorded. |
| device\_name | VARCHAR | Name of the ECMO/MCS device used including brand information, e.g. “Centrimag” |
| device\_category | VARCHAR | Maps `device_name` to a standardized mCIDE, e.g.: `Impella`, `Centrimag`, `TandemHeart`, `HeartMate`, `ECMO`, `Other` |
| mcs\_group | VARCHAR | Maps `device_category` to a standardized mCIDE of MCS types ( `durable_LVAD`, `temporary_LVAD`, `RVAD`, `IABP`, `ECMO`). [List of mcs groups available on CLIF](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_ecmo_mcs_groups.csv) |
| device\_metric\_name | VARCHAR | String that captures the measure of work rate of the device, e.g., RPMs. |
| device\_rate | DOUBLE | Numeric value of work rate, e.g., 3000 RPMs. |
| flow | DOUBLE | Blood flow in L/min. |
| sweep | DOUBLE | Gas flow rate in L/min. |
| fdO2 | DOUBLE | Fraction of delivered oxygen. |

**Example**:

| hospitalization\_id | recorded\_dttm | device\_name | device\_category | mcs\_group | device\_metric\_name | device\_rate | flow | sweep | fdO2 |
|---|---|---|---|---|---|---|---|---|---|
| 1001 | 2024-01-01 08:00:00+00:00 | Centrimag | CentriMag\_LV | temporary\_LVAD | RPMs | 3000 | 4.5 | NULL | NULL |
| 1002 | 2024-01-05 12:00:00+00:00 | ECMO VV | VV\_ECMO | ECMO | RPMs | NULL | 5.2 | 2.0 | 1.0 |
| 1003 | 2024-01-10 09:00:00+00:00 | TandemHeart | TandemHeart\_LV | temporary\_LVAD | RPMs | 2800 | 3.8 | NULL | NULL |
| 1004 | 2024-01-15 14:00:00+00:00 | ECMO VA | VA\_ECMO | ECMO | RPMs | 3500 | 4.0 | 4.0 | 1.0 |

## Hospital Diagnosis [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#hospital-diagnosis)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

Record of all diagnoses associated with the hospitalization. Expect breaking changes to this table as we seek to align it with existing diagnosis ontologies

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| patient\_id | VARCHAR | Unique identifier for each patient | No restriction |
| diagnostic\_code | DOUBLE | numeric diagnosis code | valid code in the `diagnositic_code_format` |
| diagnosis\_code\_format | VARCHAR | description of the diagnostic code format | `icd9` , `icd10` |
| start\_dttm | DATETIME | date time the diagnosis was recorded | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| end\_dttm | DATETIME | date time the diagnosis was noted as resolved (if resolved) | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |

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

## Intake\_Output [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#intake_output)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The intake\_output table is long form table that captures the times intake and output events were recorded, the type of fluid administered or recorded as “out”, and the amount of fluid.

| Column | Type | Description |
|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for the hospitalization event. |
| intake\_dttm | DATETIME | Date and time of intake. |
| fluid\_name | Name of the fluid administered. |
| amount | Amount of fluid administered (in mL). |
| in\_out\_flag | Indicator for intake or output (1 for intake, 0 for output). |

**Example**:

| hospitalization\_id | intake\_dttm | fluid\_name | amount | in\_out\_flag |
|---|---|---|---|---|
| 1001 | 2024-01-01 08:00:00+00:00 | Normal Saline | 500 | 1 |
| 1001 | 2024-01-01 10:30:00+00:00 | Urine | 300 | 0 |
| 1002 | 2024-01-05 09:15:00+00:00 | Dextrose | 250 | 1 |
| 1002 | 2024-01-05 14:00:00+00:00 | Urine | 400 | 0 |
| 1003 | 2024-01-10 07:45:00+00:00 | Lactated Ringer’s | 600 | 1 |
| 1003 | 2024-01-10 12:00:00+00:00 | Drainage | 200 | 0 |

## Invasive Hemodynamics [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#invasive-hemodynamics)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The `invasive_hemodynamics` table records invasive hemodynamic measurements during a patient’s hospitalization. These measurements represent pressures recorded via invasive monitoring and are expressed in millimeters of mercury (mmHg).

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier linking to the specific hospitalization. | N/A |
| recorded\_dttm | DATETIME | The date and time when the measurement was recorded. | N/A |
| measure\_name | VARCHAR | Description of the site or context of the invasive hemodynamic measurement. | Free text (e.g., “Right Atrium”) |
| measure\_category | VARCHAR | Categorical variable specifying the type of invasive hemodynamic measurement. | `CVP`, `RA`, `RV`, `PA_systolic`, `PA_diastolic`, `PA_mean`, `PCWP` |
| measure\_value | DDOUBLE | The numerical value of the invasive hemodynamic measurement in mmHg. | Positive decimal values (e.g., `5.00`, `25.65`) |

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

**Example**:

| hospitalization\_id | recorded\_dttm | measure\_name | measure\_category | measure\_value |
|---|---|---|---|---|
| 12345 | 2024-12-01 08:30:00+00:00 | CVP | CVP | 12.50 |
| 12345 | 2024-12-01 09:00:00+00:00 | Pulmonary Artery-Sys | PA\_systolic | 25.00 |
| 12345 | 2024-12-01 09:30:00+00:00 | Wedge | PCWP | 18.75 |

## Key ICU orders [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#key-icu-orders)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The `key_icu_orders` table captures key orders related to physical therapy (PT) and occupational therapy (OT) during ICU stays. It includes details about the hospitalization, the timing of the order, the specific name of the order, its category, and the status of the order (completed or sent).

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier linking the order to a specific hospitalization. | N/A |
| order\_dttm | DATETIME | Date and time when the order was placed. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| order\_name | VARCHAR | Name of the specific order (e.g., “PT Evaluation”, “OT Treatment”). | N/A |
| order\_category | VARCHAR | Category of the order. Permissible values are: | Under-development. Some examples include: `PT_evaluation`, `PT_treat`, `OT_evaluation`, `OT_treat` |
| order\_status\_name | VARCHAR | Status of the order. Permissible values are: | `sent`, `completed` |

**Example**:

| hospitalization\_id | order\_dttm | order\_name | order\_category | order\_status\_name |
|---|---|---|---|---|
| 12345 | 2024-12-15 10:00:00+00:00 | PT Initial Evaluation | PT\_evaluation | completed |
| 67890 | 2024-12-16 14:30:00+00:00 | OT Follow-up Treatment | OT\_treat | sent |
| 54321 | 2024-12-16 08:00:00+00:00 | PT Mobility Session | PT\_treat | completed |
| 98765 | 2024-12-15 11:15:00+00:00 | OT Cognitive Assessment | OT\_evaluation | sent |

## Medication Admin Intermittent [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#medication-admin-intermittent)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

This table has exactly the same schema as [`medication_admin_continuous`](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html#medication-admin-continuous) described below. The consortium decided to separate the medications that are administered intermittently from the continuously administered medications. The mCIDE for `medication_category` for intermittent meds can be found [here](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_medication_admin_intermittent_med_categories.csv).

## Medication Orders [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#medication-orders)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

This table records the ordering (not administration) of medications. The table is in long form (one medication order per row) longitudinal table. Linkage to the `medication_admin_continuous` and `medication_admin_intermittent` tables is through the `med_order_id` field.

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for each hospitalization, linking medication orders to a specific encounter | No restrictions |
| med\_order\_id | VARCHAR | Unique identifier for each medication order | No restrictions |
| order\_start\_dttm | DATETIME | Date and time when the medication order was initiated | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| order\_end\_dttm | DATETIME | Date and time when the medication order ended or was discontinued | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| ordered\_dttm | DATETIME | Date and time when the medication was actually ordered | Datetime format should be \` `YYY-MM-DD HH:MM:SS+00:00` |
| med\_name | VARCHAR | Name of the medication ordered | No restrictions |
| med\_category | VARCHAR | Maps `med_name` to a list of permissible medication names | Combined CDE of `medication_admin_continuous` and `medication_admin_intermittent` |
| med\_group | VARCHAR | Limited number of medication groups identified by the CLIF consortium |  |
| med\_order\_status\_name | VARCHAR | Status of the medication order, e.g. “held”, or “given” | No restrictions |
| med\_order\_status\_category | VARCHAR | Maps `med_order_status_name` to a standardized list of medication order statuses | Under-development |
| med\_route\_name | VARCHAR | Route of administration for the medication | No restrictions, Examples include `Oral`, `Intravenous` |
| med\_dose | DOUBLE | Dosage of the medication ordered | Numeric |
| med\_dose\_unit | VARCHAR | Unit of measurement for the medication dosage | Examples include `mg`, `mL`, `units` |
| med\_frequency | VARCHAR | Frequency with which the medication is administered, as per the order | Examples include `Once Daily`, `Every 6 hours` |
| prn | BOOLEAN | Indicates whether the medication is to be given “as needed” (PRN) | `0` (No), `1` (Yes) |

**Example**:

| hospitalization\_id | med\_order\_id | order\_start\_dttm | order\_end\_dttm | ordered\_dttm | med\_name | med\_category | med\_group | med\_order\_status\_name | med\_order\_status\_category | med\_route\_name | med\_dose | med\_dose\_unit | med\_frequency | prn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12345 | 456789 | 2023-10-01 14:00:00+00:00 | 2023-10-02 14:00:00+00:00 | 2023-10-01 13:30:00+00:00 | Norepinephrine 8 mg/250 mL | norepinephrine | vasoactives | active | ongoing | Intravenous | 8.0 | mg/mL | Continuous | 0 |
| 12346 | 456790 | 2023-10-01 16:00:00+00:00 | 2023-10-02 10:00:00+00:00 | 2023-10-01 15:30:00+00:00 | Vancomycin 1 g IV | vancomycin | antibiotics | active | ongoing | Intravenous | 1.0 | g | Every 12 hours | 0 |
| 12347 | 456791 | 2023-10-02 08:00:00+00:00 | 2023-10-03 08:00:00+00:00 | 2023-10-02 07:30:00+00:00 | Furosemide 40 mg IV | furosemide | diuretics | discontinued | discontinued | Intravenous | 40.0 | mg | Once Daily | 0 |
| 12348 | 456792 | 2023-10-02 12:00:00+00:00 | 2023-10-02 18:00:00+00:00 | 2023-10-02 11:45:00+00:00 | Insulin Regular 100 units/mL SC | insulin | endocrine | held | held | Subcutaneous | 100.0 | units/mL | As Needed | 1 |
| 12349 | 456793 | 2023-10-03 08:00:00+00:00 | 2023-10-03 20:00:00+00:00 | 2023-10-03 07:30:00+00:00 | Acetaminophen 1 g PO | acetaminophen | analgesics | active | ongoing | Oral | 1.0 | g | Every 6 hours | 0 |
| 12350 | 456794 | 2023-10-03 10:00:00+00:00 | 2023-10-03 18:00:00+00:00 | 2023-10-03 09:45:00+00:00 | Heparin 5,000 units SC | heparin | anticoagulant | active | ongoing | Subcutaneous | 5000.0 | units | Every 8 hours | 0 |
| 12351 | 456795 | 2023-10-03 14:00:00+00:00 | 2023-10-03 22:00:00+00:00 | 2023-10-03 13:30:00+00:00 | Morphine Sulfate 2 mg IV | morphine | analgesics | active | ongoing | Intravenous | 2.0 | mg | As Needed | 1 |
| 12352 | 456796 | 2023-10-03 20:00:00+00:00 | 2023-10-04 08:00:00+00:00 | 2023-10-03 19:45:00+00:00 | Dexamethasone 10 mg IV | dexamethasone | steroids | active | ongoing | Intravenous | 10.0 | mg | Once Daily | 0 |

## Microbiology Culture [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#microbiology-culture)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The microbiology culture table is a wide longitudinal table that captures the order and result times of microbiology culture tests, the type of fluid collected, the component of the test, and the organism identified.

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | ID variable for each patient encounter. |  |
| order\_dttm | DATETIME | Date and time when the test is ordered. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| collect\_dttm | DATETIME | Date and time when the specimen is collected. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| result\_dttm | DATETIME | Date and time when the results are available. | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| fluid\_name | VARCHAR | Cleaned fluid name string from the raw data. This field is not used for analysis. | No restriction. Check this [file for examples](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/mCIDE_mapping_examples/clif_vocab_microbiology_culture_fluid_ucmc.csv) |
| fluid\_category | VARCHAR | Fluid categories defined according to the NIH common data elements. | [CDE NIH Infection Site](https://github.com/clif-consortium/CLIF/blob/main/mCIDE/clif_microbiology_culture_fluid_categories.csv) |
| method\_name | VARCHAR | Original method names from the source data. | No restriction |
| method\_category | VARCHAR | Maps `method_name` to a standardized list of method categories | `culture`, `gram stain`, `smear` |
| organism\_category | VARCHAR | Cleaned organism name string from the raw data. This field is not used for analysis. | No restriction. [Check this file for examples](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_microbiology_culture_organism_categories.csv) |
| organism\_group | VARCHAR | Maps `organism_name` to the standardized list of organisms in the NIH CDE | [CDE NIH Organism](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_microbiology_culture_organism_groups.csv) |

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

## Microbiology Non-culture [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#microbiology-non-culture)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The microbiology non-culture table is a wide longitudinal table that captures the order and result times of non-culture microbiology tests, the type of fluid collected, the component of the test, and the result of the test.

| Column | Type | Description |
|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for the hospitalization event. |
| result\_dttm | DATETIME | Date and time when the non-culture result was obtained. |
| collect\_dttm | Date and time when the sample was collected. |
| order\_dttm | Date and time when the test was ordered. |
| fluid\_name | Name of the fluid sample. |
| component\_category | Category of the component tested. |
| result\_unit\_category | Unit category of the test result. |
| result\_category | Category of the test result. |

**Example**:

| hospitalization\_id | result\_dttm | collect\_dttm | order\_dttm | fluid\_name | component\_category | result\_unit\_category | result\_category |
|---|---|---|---|---|---|---|---|
| 101 | 2024-01-01 10:00:00+00:00 | 2024-01-01 08:00:00+00:00 | 2024-01-01 07:30:00+00:00 | Blood | PCR | Units/mL | Positive |
| 102 | 2024-01-02 11:30:00+00:00 | 2024-01-02 09:30:00+00:00 | 2024-01-02 08:15:00+00:00 | Cerebrospinal Fluid | Antigen Detection | mg/L | Negative |
| 103 | 2024-01-03 15:00:00+00:00 | 2024-01-03 13:00:00+00:00 | 2024-01-03 12:45:00+00:00 | Sputum | Gene Amplification | copies/mL | Detected |
| 104 | 2024-01-04 09:45:00+00:00 | 2024-01-04 07:15:00+00:00 | 2024-01-04 06:30:00+00:00 | Urine | Molecular Pathogen ID | ng/mL | Not Detected |
| 105 | 2024-01-05 18:00:00+00:00 | 2024-01-05 16:00:00+00:00 | 2024-01-05 15:00:00+00:00 | Pleural Fluid | Protein Quantification | g/dL | Elevated |

## Procedures [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#procedures)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

A longitudinal record of each bedside ICU procedure performed on the patient (e.g. central line placement, chest tube placement). Note that this table is not intended to capture the full set of procedures performed on inpatients.

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for each hospitalization, linking the procedure to a specific encounter |  |
| procedure\_name | VARCHAR | Name of the procedure performed on the patient | Examples include “ `Central Line Placement`” |
| procedure\_category | VARCHAR | Maps `procedure_name` to a list of standardized procedures | CDE under development |
| diagnosis | VARCHAR | The diagnosis or reason for performing the procedure |  |
| start\_dttm | DATETIME | Date and time when the procedure was initiated |  |

**Example**:

| hospitalization\_id | procedure\_name | procedure\_category | diagnosis | start\_dttm |
|---|---|---|---|---|
| 1001 | Central Line Placement | Vascular Access | Sepsis with hypotension | 2024-01-01 08:00:00 |
| 1001 | Chest Tube Placement | Respiratory Support | Pneumothorax | 2024-01-01 10:00:00 |
| 1002 | Endotracheal Intubation | Airway Management | Acute Respiratory Failure | 2024-01-05 09:30:00 |
| 1002 | Paracentesis | Diagnostic Procedure | Suspected peritonitis | 2024-01-05 11:00:00 |
| 1003 | Arterial Line Placement | Vascular Access | Hemodynamic Monitoring | 2024-01-10 07:00:00 |

## Provider [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#provider)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

Continuous start stop record of every provider who cared for the patient.

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for each hospitalization, linking the provider to a specific encounter | No restriction |
| provider\_id | VARCHAR | Unique identifier for each provider. This represents individual healthcare providers | No restriction |
| start\_dttm | DATETIME | Date and time when the provider’s care or involvement in the patient’s case began | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| stop\_dttm | DATETIME | Date and time when the provider’s care or involvement in the patient’s case ended | Datetime format should be `YYY-MM-DD HH:MM:SS+00:00` |
| provider\_role\_name | VARCHAR | The original string describing the role or specialty of the provider during the hospitalization | No restriction |
| provider\_role\_category | VARCHAR | Maps `provider_role_name` to list of standardized provider roles | under development |

**Example**:

| hospitalization\_id | start\_dttm | stop\_dttm | provider\_role\_name | provider\_role\_category |
|---|---|---|---|---|
| 1001014 | 2023-05-01 08:00:00+00:00 | 2023-05-01 20:00:00+00:00 | Attending Physician | Attending |
| 1001014 | 2023-05-01 08:00:00+00:00 | 2023-05-02 08:00:00+00:00 | Resident Physician | Resident |
| 1001014 | 2023-05-01 08:00:00+00:00 | 2023-05-03 08:00:00+00:00 | Nurse Practitioner | Nurse Practitioner |
| 1002025 | 2023-06-10 09:00:00+00:00 | 2023-06-10 21:00:00+00:00 | Critical Care Specialist | Critical Care |
| 1002025 | 2023-06-10 09:00:00+00:00 | 2023-06-11 09:00:00+00:00 | Respiratory Therapist | Respiratory Therapy |
| 1003036 | 2023-07-15 07:30:00+00:00 | 2023-07-15 19:30:00+00:00 | Attending Physician | Attending |
| 1003036 | 2023-07-15 07:30:00+00:00 | 2023-07-16 07:30:00+00:00 | Charge Nurse | Nurse |
| 1004047 | 2023-08-20 10:00:00+00:00 | 2023-08-20 22:00:00+00:00 | Physical Therapist | Therapy |

## Sensitivity [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#sensitivity)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

This table is used to store the susceptibility results of the organisms identified in the `Microbiology Culture` table and may be renamed to `Microbiology_Susceptibility`

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| culture\_id | VARCHAR | Unique identifier linking to the culture from which the sensitivity test was performed |  |
| antibiotic | VARCHAR | Name of the antibiotic tested for sensitivity | Examples include `Penicillin`, `Vancomycin` |
| sensitivity | VARCHAR | The result of the sensitivity test, indicating the organism’s resistance or susceptibility | `Resistant`, `Intermediate`, `Susceptible` |
| mic | DOUBLE | Minimum Inhibitory Concentration (MIC) value, which measures the lowest concentration of an antibiotic needed to inhibit growth |  |

**Example**:

| culture\_id | antibiotic | sensitivity | mic |
|---|---|---|---|
| 1001 | Penicillin | Susceptible | 0.25 |
| 1001 | Vancomycin | Resistant | 8.0 |
| 1002 | Amoxicillin | Intermediate | 4.0 |
| 1003 | Ciprofloxacin | Susceptible | 0.5 |
| 1004 | Gentamicin | Resistant | 16.0 |

## Therapy Details [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#therapy-details)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

The `therapy_details` table is a wide longitudinal table that captures the details of therapy sessions. The table is designed to capture and categorize the most common therapy elements used in the ICU.

| Column | Type | Description |
|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier for the hospitalization event. |
| session\_start\_dttm | DATETIME | Date and time when the therapy session started. |
| therapy\_element\_name | Name of the therapy element. |
| therapy\_element\_category | Category of the therapy element. |
| therapy\_element\_value | Value associated with the therapy element. |

**Example**:

| hospitalization\_id | session\_start\_dttm | therapy\_element\_name | therapy\_element\_category | therapy\_element\_value |
|---|---|---|---|---|
| 1001 | 2024-01-01 08:00:00+00:00 | Physical Therapy | Rehabilitation | 45.0 |
| 1001 | 2024-01-01 10:00:00+00:00 | Respiratory Therapy | Respiratory Support | 3.0 |
| 1002 | 2024-01-05 09:30:00+00:00 | Occupational Therapy | Rehabilitation | 60.0 |
| 1002 | 2024-01-05 11:00:00+00:00 | Speech Therapy | Rehabilitation | 30.0 |
| 1003 | 2024-01-10 07:00:00+00:00 | Ventilation Support | Respiratory Support | 2.5 |

## Transfusion [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-2.0.0.html\#transfusion)

[![](https://img.shields.io/badge/Maturity-Concept-orange.png)](https://clif-consortium.github.io/website/maturity.html)

This table provides detailed information about transfusion events linked to specific hospitalizations.

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| hospitalization\_id | VARCHAR | Unique identifier linking the transfusion event to a specific hospitalization in the CLIF database. | Unique identifier, e.g., `123456` |
| transfusion\_start\_dttm | DATETIME | The date and time the transfusion of the blood component began. | Example: `2024-12-03 08:30:00+00:00` |
| transfusion\_end\_dttm | DATETIME | The date and time the transfusion of the blood component ended. | Example: `2024-12-03 10:00:00+00:00` |
| component\_name | VARCHAR | The name of the blood component transfused. | E.g., `Red Blood Cells`, `Plasma`, `Platelets` |
| attribute\_name | VARCHAR | Attributes describing modifications to the component. | E.g., `Leukocyte Reduced`, `Irradiated` |
| volume\_transfused | DOUBLE | The volume of the blood component transfused. | Example: `300` |
| volume\_units | VARCHAR | The unit of measurement for the transfused volume. | Example: `mL` |
| product\_code | VARCHAR | ISBT 128 Product Description Code representing the specific blood product. | Example: `E0382` |

**Example**:

| hospitalization\_id | transfusion\_start\_dttm | transfusion\_end\_dttm | component\_name | attribute\_name | volume\_transfused | volume\_units | product\_code |
|---|---|---|---|---|---|---|---|
| 123456 | 2024-12-03 08:30:00+00:00 | 2024-12-03 10:00:00+00:00 | Red Blood Cells | Leukocyte Reduced | 300 | mL | E0382 |
| 789012 | 2024-12-04 14:00:00+00:00 | 2024-12-04 16:30:00+00:00 | Platelets | Irradiated | 250 | mL | P0205 |
| 456789 | 2024-12-05 12:15:00+00:00 | 2024-12-05 13:45:00+00:00 | Plasma |  | 200 | mL | F0781 |

# **Future proposed tables**

These are tables without any defined structure that the consortium has not yet committed to implementing.

- **Clinical Decision Support**: This table will capture the actions of clinical decision support tools embedded in the EHR. The table will have the following fields: `cds_name`, `cds_category`, `cds_value`, `cds_trigger_ddtm`.