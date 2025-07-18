Below is the entity-relationship diagram (ERD) that provides an overview of the relational CLIF database structure. This version of CLIF is [![](https://img.shields.io/badge/Maturity-Deprecated-lightgrey.png)](https://clif-consortium.github.io/website/maturity.html)![](/images/data-dictionary/ERD-1.0.0.png)

Relational CLIF tables are organized into clinically relevant column categories - demographics, objective measures, respiratory support, orders, and inputs-outputs. Below are sample templates for each table in R-CLIF. Here you can find detailed descriptions of each table and their fields.

You can use our custom GPT- [CLIF Assistant](https://chatgpt.com/g/g-h1nk6d3eR-clif-assistant) to learn more about CLIF.

## Patient\_encounters [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#patient_encounters)

| Column | Type | Description |
|---|---|---|
| patient\_id | VARCHAR | ID variable for each patient. Every patient assigned a unique identifier is presumed to be a distinct individual |
| encounter\_id | VARCHAR | ID variable for each patient encounter (a given patient can have multiple encounters). Each encounter\_id represents a unique hospitalization for a patient, capturing the entire duration of the hospital stay. This is the primary key for most other tables |

**Example:**

| patient\_id | encounter\_id |
|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="text-clif-burgundy font-mono font-semibold">1</span> |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="text-clif-burgundy font-mono font-semibold">2</span> |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="text-clif-burgundy font-mono font-semibold">3</span> |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="text-clif-burgundy font-mono font-semibold">10</span> |
| <span class="text-clif-burgundy font-mono font-semibold">6</span> | <span class="text-clif-burgundy font-mono font-semibold">11</span> |
| <span class="text-clif-burgundy font-mono font-semibold">6</span> | <span class="text-clif-burgundy font-mono font-semibold">12</span> |

## Patient\_demographics [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#patient_demographics)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter |  |
| race | VARCHAR | Description of patient's race. Each site could have different strings in source data | `Black` , `White`, `American Indian or Alaska Native`, `Asian`, `Native Hawaiian or Other Pacific Islander`, `Unknown`, `Other` |
| ethnicity | VARCHAR | Description of patient's ethnicity | `Hispanic`, `Non-Hispanic`, `Unknown` |
| sex | VARCHAR | Patient's biological sex | `Male` , `Female`, `Unknown` |

**Example:**

| encounter\_id | race | ethnicity | sex |
|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Black</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Female</span> |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Black</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Male</span> |
| <span class="text-clif-burgundy font-mono font-semibold">6</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">White</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Male</span> |
| <span class="text-clif-burgundy font-mono font-semibold">32</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Asian</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Male</span> |
| <span class="text-clif-burgundy font-mono font-semibold">43</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">White</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Female</span> |
| <span class="text-clif-burgundy font-mono font-semibold">62</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Other</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Non-hispanic</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Female</span> |

## Limited\_identifiers [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#limited_identifiers)

| Column | Type | Description |
|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter. Each encounter\_id represents a unique hospitalization for a patient, capturing the entire duration of the hospital stay |
| admission\_dttm | DATETIME | Date and time the patient is admitted (in the format %Y-%m-%d %H:%M:%S). Use this date to determine the start date and time of the patient hospitalization |
| discharge\_dttm | DATETIME | Date and time the patient is discharged (in the format %Y-%m-%d %H:%M:%S). Use this date to determine the distacharge date of the patient hospitalization |
| birth\_date | DATETIME | Patient date of birth. This variable is used to calculate age at admission for analysis |
| zipcode\_9digit | VARCHAR | Patient zipcode. This variable is used to link the database with other indices like ADI, SVI etc |

**Example:**

| encounter\_id | admission\_dttm | discharge\_dttm | birth\_date | zipcode\_9digit |
|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-08-27 08:15:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-08-27 18:59:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2014-08-10</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-06-28 07:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-06-27 19:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2000-02-11</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">3</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-09-17 08:43:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-09-17 18:59:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2000-02-11</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">10</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-08-12 00:44:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-08-12 18:59:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">1990-04-21</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">11</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-04-19 06:23:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-04-19 18:59:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2019-01-23</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">12</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-10-06 10:43:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-10-06 18:59:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2019-01-23</span> |  |

## Encounter\_demographics\_disposition [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#encounter_demographics_disposition)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter. |  |
| age\_at\_admission | INT | Age of the patient at the time of admission. Calculated using the admission\_dttm and birth\_date from the limited identifiers table. |  |
| disposition\_name | VARCHAR | Original disposition name string recorded in the raw data. This field allows for the storing of the dispostion value as it appears in the source data. This field is not used for analysis. |  |
| disposition\_category | VARCHAR | Description of disposition when discharged. Map source values stored in disposition\_name to the mCIDE categories. | `Home`, `Hospice`, `Discharged to another facility`, `Dead`, `Admitted`, `Other` |

**Example:**

| encounter\_id | age\_at\_admission | disposition\_name | disposition\_category |
|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">6</span> | Discharged to Home or Self Care (Routine Discharge) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Home</span> |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">22</span> | Discharged/transferred to Home Under Care of Organized Home Health Service Org | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Home</span> |
| <span class="text-clif-burgundy font-mono font-semibold">3</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">54</span> | Left Against Medical Advice or Discontinued Care | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Home</span> |
| <span class="text-clif-burgundy font-mono font-semibold">10</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20</span> | Discharged/transferred to a Short-Term General Hospital for Inpatient Care | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Discharged to another facility</span> |
| <span class="text-clif-burgundy font-mono font-semibold">11</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">2</span> | Discharged/transferred to a Facility that Provides Custodial or Supportive Care | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Discharged to another facility</span> |
| <span class="text-clif-burgundy font-mono font-semibold">62</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">66</span> | Hospice - Medical Facility (Certified) Providing Hospice Level of Care | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Hospice</span> |
| <span class="text-clif-burgundy font-mono font-semibold">634</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">827</span> | Expired | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Dead</span> |

## ADT [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#adt)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter |  |
| hospital\_id | VARCHAR | Assign an ID to each hospital in the hospital system |  |
| in\_dttm | DATETIME | Start date and time at a particular location | Datetime format should be %Y-%m-%d %H:%M:%S |
| out\_dttm | DATETIME | End date and time at a particular location | Datetime format should be %Y-%m-%d %H:%M:%S |
| location\_name | VARCHAR | Location of the patient inside the hospital. This field is used to store the patient location from the source data. This field is not used for analysis. | No restriction |
| location\_category | VARCHAR | Map location\_name from the source data to categories identified under CLIF. | `ER`, `OR`, `ICU`, `Ward`, `Other` |

**Example:**

| encounter\_id | hospital\_id | in\_dttm | out\_dttm | location\_name | location\_category |
|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | A | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-12-28 10:35:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-12-29 03:21:00</span> | ED CCD | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">ER</span> |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | A | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-12-29 03:21:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2020-12-29 07:25:00</span> | N03W | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Ward</span> |
| <span class="text-clif-burgundy font-mono font-semibold">3</span> | A | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-18 05:02:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-19 20:22:00</span> | N03W | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">ICU</span> |
| <span class="text-clif-burgundy font-mono font-semibold">3</span> | B | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-19 20:22:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-22 09:30:00</span> | T5SW | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Ward</span> |
| <span class="text-clif-burgundy font-mono font-semibold">11</span> | F | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 23:30:00</span> | ER COMER | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">ER</span> |

## Vitals [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#vitals)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter. |  |
| recorded\_dttm | DATETIME | Date and time when the vital is recorded. | Datetime format should be %Y-%m-%d %H:%M:%S |
| vital\_name | VARCHAR | This field is used to store the description of the flowsheet measure from the source data. This field is not used for analysis. | No restriction |
| vital\_category | VARCHAR | Map flowsheet measures stored in vital\_name to the to categories identified under CLIF. | `temp_c`, `pulse`, `sbp`, `dbp`, `spo2`, `respiratory_rate`, `map`, `height_inches`, `weight_kg` |
| vital\_value | DOUBLE | Recorded value of the vital. Ensure that the measurement unit is aligned with the permissible units of measurements. | `temp_c = Celsius`, `height_inches = Inch`, `weight_kg = Kg`, `map = mm/Hg`, `spo2 = %`, No unit for `pulse`, `sbp`, `dbp`, and `respiratory_rate` |
| meas\_site\_name | VARCHAR | Site where vital is recorded | No restrictions. Record the site name from the source data. |

**Example:**

| encounter\_id | recorded\_dttm | vital\_name | vital\_category | vital\_value | meas\_site\_name |
|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-05-05 04:18:00</span> | RESPIRATIONS | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">respiratory\_rate</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">18</span> | not specified |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-05-05 04:18:00</span> | PULSE OXIMETRY | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">spo2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">97</span> | not specified |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-05-05 04:18:00</span> | NUR RS CORE TEMPERATURE MEASUREMENT | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">temp\_c</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">98.1</span> | core |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-05-05 04:18:00</span> | PULSE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">pulse</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">73</span> | not specified |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-05-01 11:23:00</span> | WEIGHT/SCALE | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">weight\_kg</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">78.8</span> | not specified |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-05-01 11:23:00</span> | HEIGHT | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">height\_inches</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">73</span> | not specified |

## Labs [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#labs)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter. |  |
| lab\_order\_dttm | DATETIME | Date and time when the lab is ordered. | Datetime format should be %Y-%m-%d %H:%M:%S |
| lab\_collect\_dttm | DATETIME | Date and time when the specimen is collected. | Datetime format should be %Y-%m-%d %H:%M:%S |
| lab\_result\_dttm | DATETIME | Date and time when the lab results are available. | Datetime format should be %Y-%m-%d %H:%M:%S |
| lab\_name | VARCHAR | Original lab name string recorded in the raw data. This field is not used for analysis. |  |
| lab\_category | VARCHAR | 43 labs identified by the CLIF consortium. | [List of lab categories in CLIF](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_vocab_labs.csv) |
| lab\_group | VARCHAR | Lab categories roll up to form lab groups. | `ABG`, `BMP`, `CBC`, `Coags`, `LFT`, `Lactic Acid`, `Misc`, `VBG` |
| lab\_value | DOUBLE | Recorded value corresponding to a lab. |  |
| reference\_unit | VARCHAR | Unit of measurement for that lab . | Permissible reference values for each `lab_category` listed [here](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_vocab_labs.csv) |
| lab\_type\_name | VARCHAR | Type of lab. | `arterial`, `venous`, `standard`, `poc` |

**Example:**

| encounter\_id | lab\_order\_dttm | lab\_collect\_dttm | lab\_result\_dttm | lab\_name | lab\_group | lab\_category | lab\_value | reference\_unit | lab\_type\_name |
|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:05:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:53:00</span> | BASOPHILS | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">CBC</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">basophil</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">1</span> | % | standard |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:05:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:53:00</span> | MONOCYTES | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">CBC</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">monocyte</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">7</span> | % | standard |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:05:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:53:00</span> | NEUTROPHILS | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">CBC</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">neutrophil</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">47</span> | % | standard |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:05:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:53:00</span> | LYMPHOCYTES | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">CBC</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">lymphocyte</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">44</span> | % | standard |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:05:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:53:00</span> | EOSINOPHILS | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">CBC</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">eosinophils</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">1</span> | % | standard |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 17:50:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:05:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2022-09-30 18:53:00</span> | BILIRUBIN, UNCONJUGATED | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">LFT</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">bilirubin\_unconjugated</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.9</span> | mg/dL | standard |

_Note_: The `lab_value` field often has non-numeric entries that are useful to make project-specific decisions. A site may choose to keep the `lab_value` field as a character and create a new field `lab_value_numeric` that only parses the character field to extract the numeric part of the string.

## Microbiology [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#microbiology)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter. |  |
| test\_id | VARCHAR | An ID for a specific component, such as a gram culture smear, taken from a fluid sample with a unique order and collection time, if two different pathogens are identified, the result will be recorded as two separate rows, each sharing the same test\_id. |  |
| order\_dttm | DATETIME | Date and time when the test is ordered. | Datetime format should be %Y-%m-%d %H:%M:%S |
| collect\_dttm | DATETIME | Date and time when the specimen is collected. | Datetime format should be %Y-%m-%d %H:%M:%S |
| result\_dttm | DATETIME | Date and time when the results are available. | Datetime format should be %Y-%m-%d %H:%M:%S |
| fluid\_name | VARCHAR | Cleaned fluid name string from the raw data. This field is not used for analysis. | No restriction. Check this file for examples: [clif\_vocab\_microbiology\_fluid\_ucmc.csv](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/ucmc/clif_vocab_microbiology_fluid_ucmc.csv) |
| fluid\_category | VARCHAR | Fluid categories defined according to the NIH common data elements. | [CDE NIH Infection Site](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_nih_vocab_microbiology_fluid.csv) |
| component\_name | VARCHAR | Original componenet names from the source data. | No restriction |
| component\_category | VARCHAR | Map component names to the categories identified under CLIF. | `culture`, `gram stain`, `smear` |
| organism\_name | VARCHAR | Cleaned oragnism name string from the raw data. This field is not used for analysis. | No restriction. Check this file for examples: [clif\_vocab\_microbiology\_organism\_ucmc.csv](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/ucmc/clif_vocab_microbiology_organism_ucmc.csv) |
| organism\_category | VARCHAR | Organism categories defined according to the NIH common data elements. | [CDE NIH Organism](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_nih_vocab_microbiology_organism.csv) |

**Example:**

| encounter\_id | test\_id | order\_dttm | collect\_dttm | result\_dttm | fluid\_name | fluid\_category | component\_name | component\_category | organism\_name | organism\_category |
|---|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="text-clif-burgundy font-mono font-semibold">1</span> | | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">5/11/20 15:14</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">5/11/20 15:17</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">5/12/20 15:17</span> | culture & stain, pleural fluid | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">pleural cavity, pleural fluid</span> | quant. gram stain | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gram stain</span> | gram negative rod (nos) | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gram negative rod (nos)</span> |
| <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="text-clif-burgundy font-mono font-semibold">1</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">5/11/20 15:14</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">5/11/20 15:17</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">5/14/20 15:17</span> | culture & stain, pleural fluid | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">pleural cavity, pleural fluid</span> | culture | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">culture</span> | morganella\_morganii | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">other bacteria</span> |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="text-clif-burgundy font-mono font-semibold">3</span> | | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">7/20/20 19:23</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">7/20/20 19:24</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">7/22/20 16:07</span> | culture & stain, fluid | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gallbladder and billary tree (not hepatitis), pancreas</span> | gram stain | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gram stain</span> | no growth | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">no growth</span> |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="text-clif-burgundy font-mono font-semibold">4</span> | <span class="text-clif-burgundy font-mono font-semibold">2</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">7/20/20 19:23</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">7/20/20 19:24</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">7/23/20 17:07</span> | culture & stain, fluid | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">gallbladder and billary tree (not hepatitis), pancreas</span> | culture | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">culture</span> | haemophilus\_influenzae | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">haemophilus (all species including influenzae)</span> |
| <span class="text-clif-burgundy font-mono font-semibold">3</span> | <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="text-clif-burgundy font-mono font-semibold">3</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">8/7/20 22:38</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">8/8/20 22:38</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">8/10/20 22:38</span> | culture & stain, respiratory | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">lower respiratory tract (lung)</span> | culture, fungal and bacterial | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">culture</span> | rhizopus\_sp | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">mucormycosis (zygomycetes, rhizopus)</span> |

## Respiratory\_support [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#respiratory_support)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter |  |
| recorded\_dttm | DATETIME | Date and time when the device started | Datetime format should be %Y-%m-%d %H:%M:%S |
| device\_name | VARCHAR | Includes raw string of the devices. Not used for analysis | [Example mapping for device name to device category](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_vocab_respiratory_support_devices.csv) |
| device\_category | VARCHAR | Includes a limited number of devices identified by the CLIF consortium | `Vent`, `NIPPV`, `CPAP`, `High Flow NC`, `Face Mask`, `Trach Collar`, `Nasal Cannula`, `Room Air`, `Other` |
| mode\_name | VARCHAR | Includes raw string of the modes. Not used for analysis | [Example mapping for mode name to mode category](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_vocab_respiratory_support_modes.csv) |
| mode\_category | VARCHAR | Limited number of modes identified by the CLIF consortium | `Assist Control-Volume Control`, `Pressure Support/CPAP`, `Pressure Control`, `Pressure-Regulated Volume Control`, `Other`, `SIMV`, `Blow by` |
| tracheostomy | BOOLEAN | Indicates if tracheostomy is performed | 0 = No, 1 = Yes |
| fio2\_set | DOUBLE | Fraction of inspired oxygen set |  |
| lpm\_set | DOUBLE | Liters per minute set |  |
| tidal\_volume\_set | DOUBLE | Tidal volume set (in mL) |  |
| resp\_rate\_set | DOUBLE | Respiratory rate set (in bpm) |  |
| pressure\_control\_set | DOUBLE | Pressure control set (in cmH2O) |  |
| pressure\_support\_set | DOUBLE | Pressure support set (in cmH2O) |  |
| flow\_rate\_set | DOUBLE | Flow rate set |  |
| peak\_inspiratory\_pressure\_set | DOUBLE | Peak inspiratory pressure set (in cmH2O) |  |
| inspiratory\_time\_set | DOUBLE | Inspiratory time set (in seconds) |  |
| peep\_set | DOUBLE | Positive-end-expiratory pressure set (in cmH2O) |  |
| tidal\_volume\_obs | DOUBLE | Observed tidal volume (in mL) |  |
| resp\_rate\_obs | DOUBLE | Observed respiratory rate (in bpm) |  |
| plateau\_pressure\_obs | DOUBLE | Observed plateau pressure (in cmH2O) |  |
| peak\_inspiratory\_pressure\_obs | DOUBLE | Observed peak inspiratory pressure (in cmH2O) |  |
| peep\_obs | DOUBLE | Observed positive-end-expiratory pressure (in cmH2O) |  |
| minute\_vent\_obs | DOUBLE | Observed minute ventilation (in liters) |  |
|  |  |  |  |

**Example:**

| encounter\_id | recorded\_dttm | device\_name | device\_category | mode\_name | mode\_category | tracheostomy | fio2\_set | lpm\_set | tidal\_volume\_set | resp\_rate\_set | pressure\_control\_set | pressure\_support\_set | flow\_rate\_set | peak\_inspiratory\_pressure\_set | inspiratory\_time\_set | peep\_set | tidal\_volume\_obs | resp\_rate\_obs | plateau\_pressure\_obs | peak\_inspiratory\_pressure\_obs | peep\_obs | minute\_vent\_obs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-05 19:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Nasal Cannula</span> |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">6</span> |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-05 20:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">High Flow NC</span> |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">100</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60</span> |  |  |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60</span> |  |  |  |  |  |  |  |  |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-05 21:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">High Flow NC</span> |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">100</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60</span> |  |  |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">60</span> |  |  |  |  |  |  |  |  |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-05 22:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Vent</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Assist-Control/Volume Control</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">100</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">500</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">1.2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">14</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">30</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">35</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">7</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-05 23:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Vent</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Assist-Control/Volume Control</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">80</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">14</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">1.2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">14</span> |  |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">7</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-06 00:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Vent</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Assist-Control/Volume Control</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">75</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">14</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">1.2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">22</span> |  |  |  |  |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-06 03:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Vent</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Assist-Control/Volume Control</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">50</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">14</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">1.2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">400</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">2</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">30</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">35</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">7</span> |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-06 04:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Vent</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Pressure Support</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">50</span> |  |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  |  |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">5</span> |  |  |  |  |  |  |
| <span class="text-clif-burgundy font-mono font-semibold">5</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2024-05-06 05:37:26</span> |  | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">Nasal Cannula</span> |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">4</span> |  |  |  |  |  |  |  |  |  | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">20</span> |  |  |  |  |

## Medication\_admin\_continuous [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#medication_admin_continuous)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter |  |
| med\_order\_id | VARCHAR | Medication order id. Foreign key to link this table to other medication tables |  |
| admin\_dttm | DATETIME | Date and time when the medicine was administered | Datetime format should be %Y-%m-%d %H:%M:%S |
| med\_name | VARCHAR | Original med name string recorded in the raw data for a limited number of labs identified by the CLIF consortium | [Example mapping of med\_name to med\_category](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/ucmc_cide_mappings/clif_vocab_medication_admin_continuous_med_ucmc.csv) |
| med\_category | VARCHAR | Limited number of medication categories identified by the CLIF consortium | [List of continuous medication categories in CLIF](https://github.com/kaveriC/CLIF-1.0/blob/main/mCIDE/clif_vocab_medication_admin_continuous.csv) |
| med\_route | VARCHAR | eod of medicine delivery |  |
| med\_dose | VARCHAR | quantity taken in dose |  |
| med\_dose\_unit | VARCHAR | unit of dose |  |

**Example:**

| encounter\_id | med\_order\_id | admin\_dttm | med\_name | med\_category | med\_route | med\_dose | med\_dose\_unit |
|---|---|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | 43 | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">10/6/2022 11:10:00</span> | phenylephrine | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">vasoactives</span> | Intravenous | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.4</span> | mcg/kg/min |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | 76 | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">10/6/2022 11:13:00</span> | phenylephrine | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">vasoactives</span> | Intravenous | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.75</span> | mcg/kg/min |
| <span class="text-clif-burgundy font-mono font-semibold">2</span> | 89 | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">10/6/2022 11:32:00</span> | insulin | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">endocrine</span> | Intravenous | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">2</span> | Units/hr |
| <span class="text-clif-burgundy font-mono font-semibold">11</span> | 42 | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">1/22/2022 00:00:00</span> | propofol | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sedation</span> | Intravenous | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">40</span> | mcg/kg/min |
| <span class="text-clif-burgundy font-mono font-semibold">11</span> | 807 | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">1/22/2022 02:13:00</span> | propofol | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sedation</span> | Intravenous | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">30</span> | mcg/kg/min |
| <span class="text-clif-burgundy font-mono font-semibold">11</span> | 432 | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">1/22/2022 04:00:00</span> | fentanyl | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">sedation</span> | Intravenous | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">150</span> | mcg/hr |

Note: The `medication_admin_intermittent` table has exactly the same schema. The consortium decided to separate the medications that are administered intermittenly from the continuously administered medications.

## Dialysis [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#dialysis)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter |  |
| start\_dttm | DATETIME | Start date and time of dialysis session | Datetime format should be %Y-%m-%d %H:%M:%S |
| stop\_dttm | DATETIME | Stop date and time of dialysis session | Datetime format should be %Y-%m-%d %H:%M:%S |
| dialysis\_type | VARCHAR | Type of dialysis performed | `intermittent`, `peritoneal`, `crrt` |
| dialysate\_flow\_amount | DOUBLE | Amount of dialysate flow |  |
| ultrafiltration\_amount | DOUBLE | Amount of ultrafiltration |  |

**Example:**

| encounter\_id | start\_dttm | stop\_dttm | dialysis\_type | dialysate\_flow\_amount | ultrafiltration\_amount |
|---|---|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">18</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 09:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 10:00:00</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">crrt</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0.86</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">18</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 10:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 11:00:00</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">crrt</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">3.89</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">18</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 11:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 12:00:00</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">crrt</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">3.82</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">18</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 12:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 13:00:00</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">crrt</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">3.89</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">18</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 13:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 14:00:00</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">crrt</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">3.89</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |
| <span class="text-clif-burgundy font-mono font-semibold">18</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 14:00:00</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2021-03-24 15:00:00</span> | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">crrt</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">3.900</span> | <span class="bg-orange-50 text-orange-700 px-1 rounded font-semibold">0</span> |

## Position [Anchor](https://clif-consortium.github.io/website/data-dictionary/data-dictionary-1.0.0.html\#position)

| Column | Type | Description | Permissible Values |
|---|---|---|---|
| encounter\_id | VARCHAR | ID variable for each patient encounter. This table only includes those encounters that have proning documented ever. |  |
| recorded\_dttm | DATETIME | Date and time when the vital is recorded. | Datetime format should be %Y-%m-%d %H:%M:%S |
| position\_name | VARCHAR | This field is used to store the description of the position from the source data. This field is not used for analysis. | No restriction |
| position\_category | VARCHAR | Map position\_name to the to categories identified under CLIF. | `prone`, `not_prone` |

**Example:**

| encounter\_id | recorded\_dttm | position\_name | position\_category |
|---|---|---|---|
| <span class="text-clif-burgundy font-mono font-semibold">13</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2017-10-25 12:31:00</span> | Lying down | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not\_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">13</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2017-10-25 14:07:00</span> | Sitting | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not\_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">13</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2017-10-26 08:11:00</span> | Lying down | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not\_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">13</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2017-10-27 08:24:00</span> | Prone | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">13</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2017-11-19 17:05:00</span> | Lying down;HOB equal/greater than 30 degrees | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">not\_prone</span> |
| <span class="text-clif-burgundy font-mono font-semibold">13</span> | <span class="bg-blue-50 text-blue-700 px-1 rounded font-mono">2017-11-20 11:23:00</span> | Lying down;Prone | <span class="bg-purple-50 text-purple-700 px-1 rounded text-sm">prone</span> |