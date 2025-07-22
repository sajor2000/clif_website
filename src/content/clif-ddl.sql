CREATE TABLE ADT (
  hospitalization_id VARCHAR COMMENT '{"description": "ID variable for each patient encounter", "permissible": "No restriction"}',
  hospital_id VARCHAR COMMENT '{"description": "Assign a unique ID to each hospital within a healthsystem", "permissible": "No restriction"}',
  hospital_type VARCHAR COMMENT '{"description": "Maps hospital_id to a standardized list of hospital types", "permissible": ["academic", "community", "LTACH"]}',
  in_dttm DATETIME COMMENT '{"description": "Start date and time at a particular location. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  out_dttm DATETIME COMMENT '{"description": "End date and time at a particular location. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  location_name VARCHAR COMMENT '{"description": "Location of the patient inside the hospital. This field is used to store the patient location from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  location_category VARCHAR COMMENT '{"description": "Maps location_name to a standardized list of ADT location categories", "permissible": ["ed", "ward", "stepdown", "icu", "procedural", "l&d", "hospice", "psych", "rehab", "radiology", "dialysis", "other"]}',
  location_type VARCHAR COMMENT '{"description": "Maps ICU type to a standardized list of ICU categories", "permissible": "See mCIDE/clif_adt_location_type.csv"}'
);

CREATE TABLE Code_Status (
  code_status_id VARCHAR COMMENT '{"description": "Unique code status record", "permissible": "No restriction"}',
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  recorded_dttm DATETIME COMMENT '{"description": "Date and time when the code status was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  code_status_name VARCHAR COMMENT '{"description": "Original code status string from the source data", "permissible": "No restriction"}',
  code_status_category VARCHAR COMMENT '{"description": "Maps code_status_name to a standardized list of code status categories", "permissible": ["Full Code", "DNR", "DNI", "Comfort Measures Only", "Other"]}'
);

CREATE TABLE CRRT_Therapy (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for hospitalization episode", "permissible": "No restriction"}',
  device_id VARCHAR COMMENT '{"description": "Unique identifier for dialysis machine", "permissible": "No restriction"}',
  recorded_dttm DATETIME COMMENT '{"description": "Timestamp when CRRT parameters were recorded", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  crrt_mode_name VARCHAR COMMENT '{"description": "Name of CRRT mode (e.g., CVVHDF)", "permissible": "No restriction"}',
  crrt_mode_category VARCHAR COMMENT '{"description": "CRRT mode category", "permissible": ["scuf", "cvvh", "cvvhd", "cvvhdf"]}',
  dialysis_machine_name VARCHAR COMMENT '{"description": "Unique identifier for the dialysis machine", "permissible": "No restriction"}',
  blood_flow_rate DOUBLE COMMENT '{"description": "Rate of blood flow through the CRRT circuit (mL/hr)", "permissible": "No restriction"}',
  pre_filter_replacement_fluid_rate DOUBLE COMMENT '{"description": "Rate of pre-filter replacement fluid infusion (mL/hr)", "permissible": "No restriction"}',
  post_filter_replacement_fluid_rate DOUBLE COMMENT '{"description": "Rate of post-filter replacement fluid infusion (mL/hr)", "permissible": "No restriction"}',
  dialysate_flow_rate DOUBLE COMMENT '{"description": "Flow rate of dialysate solution (mL/hr)", "permissible": "No restriction"}',
  ultrafiltration_out DOUBLE COMMENT '{"description": "Net ultrafiltration output (mL)", "permissible": "No restriction"}'
);

-- ECMO_MCS
CREATE TABLE ECMO_MCS (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  device_id VARCHAR COMMENT '{"description": "Unique identifier for ECMO/MCS device", "permissible": "No restriction"}',
  recorded_dttm DATETIME COMMENT '{"description": "Timestamp when ECMO/MCS parameters were recorded", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  ecmo_type VARCHAR COMMENT '{"description": "Type of ECMO (e.g., VA, VV)", "permissible": ["VA", "VV"]}',
  flow_rate DOUBLE COMMENT '{"description": "Flow rate (L/min)", "permissible": "No restriction"}',
  sweep_gas_flow DOUBLE COMMENT '{"description": "Sweep gas flow (L/min)", "permissible": "No restriction"}',
  fiO2 DOUBLE COMMENT '{"description": "Fraction of inspired oxygen", "permissible": "No restriction"}'
);

-- Hospitalization
CREATE TABLE Hospitalization (
  patient_id VARCHAR COMMENT '{"description": "Unique identifier for each patient, linking to the patient table", "permissible": "No restriction"}',
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization encounter. Each hospitalization_id represents a unique stay in the hospital", "permissible": "No restriction"}',
  hospitalization_joined_id VARCHAR COMMENT '{"description": "Unique identifier for each continuous inpatient stay in a health system which may span different hospitals (Optional)", "permissible": "No restriction"}',
  admission_dttm DATETIME COMMENT '{"description": "Date and time the patient is admitted to the hospital. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  discharge_dttm DATETIME COMMENT '{"description": "Date and time the patient is discharged from the hospital. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  age_at_admission INT COMMENT '{"description": "Age of the patient at the time of admission, in years", "permissible": "No restriction"}',
  admission_type_name VARCHAR COMMENT '{"description": "Type of inpatient admission. Original string from the source data", "permissible": "e.g. Direct admission, Transfer, Pre-op surgical"}',
  admission_type_category VARCHAR COMMENT '{"description": "Admission disposition mapped to mCIDE categories", "permissible": "Under-development"}',
  discharge_name VARCHAR COMMENT '{"description": "Original discharge disposition name string recorded in the raw data", "permissible": "No restriction, e.g. home"}',
  discharge_category VARCHAR COMMENT '{"description": "Maps discharge_name to a standardized list of discharge categories", "permissible": ["Home", "Skilled Nursing Facility (SNF)", "Expired", "Acute Inpatient Rehab Facility", "Hospice", "Long Term Care Hospital (LTACH)", "Acute Care Hospital", "Group Home", "Chemical Dependency", "Against Medical Advice (AMA)", "Assisted Living", "Still Admitted", "Missing", "Other", "Psychiatric Hospital", "Shelter", "Jail"]}'
);

-- Hospital Diagnosis
CREATE TABLE Hospital_Diagnosis (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  diagnosis_code VARCHAR COMMENT '{"description": "Diagnosis code (ICD-10, SNOMED, etc.)", "permissible": "No restriction"}',
  diagnosis_description VARCHAR COMMENT '{"description": "Description of the diagnosis", "permissible": "No restriction"}',
  diagnosis_type VARCHAR COMMENT '{"description": "Type of diagnosis (e.g., admitting, discharge)", "permissible": ["admitting", "discharge", "other"]}',
  diagnosis_priority INT COMMENT '{"description": "Priority of the diagnosis (1=primary, 2=secondary, etc.)", "permissible": "No restriction"}'
);

-- Labs
CREATE TABLE Labs (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  lab_result_dttm DATETIME COMMENT '{"description": "Date and time when the lab results are available. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  lab_order_name VARCHAR COMMENT '{"description": "Procedure name for the lab, e.g. Complete blood count w/ diff", "permissible": "No restriction"}',
  lab_order_category VARCHAR COMMENT '{"description": "Maps lab_order_name to standardized list of common lab order names, e.g. CBC", "permissible": "See mCIDE/clif_labs_order_categories.csv"}',
  lab_name VARCHAR COMMENT '{"description": "Original lab component as recorded in the raw data, e.g. AST (SGOT)", "permissible": "No restriction"}',
  lab_category VARCHAR COMMENT '{"description": "Maps lab_name to a minimum set of standardized labs identified by the CLIF consortium as minimum necessary labs for the study of critical illness.", "permissible": "See mCIDE/clif_lab_categories.csv"}',
  lab_value VARCHAR COMMENT '{"description": "Recorded value corresponding to a lab. Lab values are often strings that can contain non-numeric results (e.g. > upper limit of detection).", "permissible": "No restriction"}',
  lab_value_numeric DOUBLE COMMENT '{"description": "Parse out numeric part of the lab_value variable (optional).", "permissible": "Numeric"}',
  reference_unit VARCHAR COMMENT '{"description": "Unit of measurement for that lab.", "permissible": "See mCIDE/clif_lab_categories.csv"}',
  lab_specimen_name VARCHAR COMMENT '{"description": "Original fluid or tissue name the lab was collected from as given in the source data", "permissible": "No restriction"}',
  lab_specimen_category VARCHAR COMMENT '{"description": "Fluid or tissue the lab was collected from, analogous to the LOINC system component.", "permissible": ["blood/plasma/serum", "urine", "csf", "other"]}',
  lab_loinc_code VARCHAR COMMENT '{"description": "LOINC code for the lab", "permissible": "No restrictions"}'
);

-- Medication Admin Continuous
CREATE TABLE Medication_Admin_Continuous (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  admin_dttm DATETIME COMMENT '{"description": "Date and time when the medicine was administered. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  med_name VARCHAR COMMENT '{"description": "Original med name string recorded in the raw data which often contains concentration e.g. NOREPInephrine 8 mg/250 mL", "permissible": "No restriction"}',
  med_category VARCHAR COMMENT '{"description": "Maps med_name to a limited set of active ingredients for important ICU medications, e.g. norepinephrine", "permissible": "See mCIDE/clif_medication_admin_continuous_med_categories.csv"}',
  med_group VARCHAR COMMENT '{"description": "Limited number of ICU medication groups identified by the CLIF consortium, e.g. vasoactives", "permissible": "See mCIDE/clif_medication_admin_continuous_med_categories.csv"}',
  med_route_name VARCHAR COMMENT '{"description": "Medicine delivery route", "permissible": "e.g. IV, enteral"}',
  med_route_category VARCHAR COMMENT '{"description": "Maps med_route_name to a standardized list of medication delivery routes", "permissible": "Under-development"}',
  med_dose DOUBLE COMMENT '{"description": "Quantity taken in dose", "permissible": "No restriction"}',
  med_dose_unit VARCHAR COMMENT '{"description": "Unit of dose. It must be a rate, e.g. mcg/min. Boluses should be mapped to med_admin_intermittent", "permissible": "No restriction"}',
  mar_action_name VARCHAR COMMENT '{"description": "MAR (medication administration record) action, e.g. stopped", "permissible": "No restriction"}',
  mar_action_category VARCHAR COMMENT '{"description": "Maps mar_action_name to a standardized list of MAR actions", "permissible": "Under-development"}'
);

-- Microbiology Culture
CREATE TABLE Microbiology_Culture (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  order_dttm DATETIME COMMENT '{"description": "Date and time when the test was ordered.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  collect_dttm DATETIME COMMENT '{"description": "Date and time when the sample was collected.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  result_dttm DATETIME COMMENT '{"description": "Date and time when the result was available.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  fluid_name VARCHAR COMMENT '{"description": "Cleaned fluid name string from the raw data. This field is not used for analysis.", "permissible": "No restriction"}',
  fluid_category VARCHAR COMMENT '{"description": "Fluid categories defined according to the NIH common data elements.", "permissible": "See mCIDE/clif_microbiology_culture_fluid_categories.csv"}',
  method_name VARCHAR COMMENT '{"description": "Original method names from the source data.", "permissible": "No restriction"}',
  method_category VARCHAR COMMENT '{"description": "Maps method_name to a standardized list of method categories", "permissible": ["culture", "gram stain", "smear"]}',
  organism_category VARCHAR COMMENT '{"description": "Cleaned organism name string from the raw data. This field is not used for analysis.", "permissible": "No restriction"}',
  organism_group VARCHAR COMMENT '{"description": "Maps organism_name to the standardized list of organisms in the NIH CDE", "permissible": "See mCIDE/clif_microbiology_culture_organism_groups.csv"}'
);

-- Microbiology Non-culture
CREATE TABLE Microbiology_Non_culture (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  result_dttm DATETIME COMMENT '{"description": "Date and time when the result was available.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  collect_dttm DATETIME COMMENT '{"description": "Date and time when the sample was collected.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  order_dttm DATETIME COMMENT '{"description": "Date and time when the test was ordered.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  fluid_name VARCHAR COMMENT '{"description": "Name of the fluid sample.", "permissible": "No restriction"}',
  component_category VARCHAR COMMENT '{"description": "Category of the component tested.", "permissible": "No restriction"}',
  result_unit_category VARCHAR COMMENT '{"description": "Unit category of the test result.", "permissible": "No restriction"}',
  result_category VARCHAR COMMENT '{"description": "Category of the test result.", "permissible": "No restriction"}'
);

-- Patient
CREATE TABLE Patient (
  patient_id VARCHAR COMMENT '{"description": "Unique identifier for each patient. This is presumed to be a distinct individual.", "permissible": "No restriction"}',
  race_name VARCHAR COMMENT '{"description": "Patient race string from source data", "permissible": "No restriction"}',
  race_category VARCHAR COMMENT '{"description": "A standardized CDE description of patient’s race per the US Census permissible values. The source data may contain different strings for race.", "permissible": ["Black or African American", "White", "American Indian or Alaska Native", "Asian", "Native Hawaiian or Other Pacific Islander", "Unknown", "Other"]}',
  ethnicity_name VARCHAR COMMENT '{"description": "Patient ethnicity string from source data", "permissible": "No restriction"}',
  ethnicity_category VARCHAR COMMENT '{"description": "Description of patient’s ethnicity per the US census definition. The source data may contain different strings for ethnicity.", "permissible": ["Hispanic", "Non-Hispanic", "Unknown"]}',
  sex_name VARCHAR COMMENT '{"description": "Patient’s biological sex as given in the source data.", "permissible": "No restriction"}',
  sex_category VARCHAR COMMENT '{"description": "Patient’s biological sex.", "permissible": ["Male", "Female", "Unknown"]}',
  birth_date DATETIME COMMENT '{"description": "Patient’s date of birth.", "permissible": "Date format should be YYYY-MM-DD"}',
  death_dttm DATETIME COMMENT '{"description": "Patient’s death date, including time if available.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  language_name VARCHAR COMMENT '{"description": "Patient’s preferred language.", "permissible": "No restriction"}',
  language_category VARCHAR COMMENT '{"description": "Maps language_name to a standardized list of spoken languages", "permissible": "Under-development"}'
);

-- Position
CREATE TABLE Position (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  position_dttm DATETIME COMMENT '{"description": "Date and time when the patient’s position was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  position_name VARCHAR COMMENT '{"description": "Name of the patient’s position. This field is used to store the patient position from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  position_category VARCHAR COMMENT '{"description": "Maps position_name to a standardized list of ADT location categories", "permissible": ["ed", "ward", "stepdown", "icu", "procedural", "l&d", "hospice", "psych", "rehab", "radiology", "dialysis", "other"]}'
);

-- Respiratory Support
CREATE TABLE Respiratory_Support (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  device_id VARCHAR COMMENT '{"description": "Unique identifier for respiratory device", "permissible": "No restriction"}',
  recorded_dttm DATETIME COMMENT '{"description": "Timestamp when respiratory parameters were recorded", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  respiratory_mode_name VARCHAR COMMENT '{"description": "Name of respiratory mode (e.g., NIV, BiPAP)", "permissible": "No restriction"}',
  respiratory_mode_category VARCHAR COMMENT '{"description": "Maps respiratory_mode_name to a standardized list of respiratory modes", "permissible": "Under-development"}',
  flow_rate DOUBLE COMMENT '{"description": "Flow rate (L/min)", "permissible": "No restriction"}',
  fiO2 DOUBLE COMMENT '{"description": "Fraction of inspired oxygen", "permissible": "No restriction"}'
);

-- Vitals
CREATE TABLE Vitals (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  vital_dttm DATETIME COMMENT '{"description": "Date and time when the vital sign was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  vital_name VARCHAR COMMENT '{"description": "Name of the vital sign. This field is used to store the vital sign from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  vital_category VARCHAR COMMENT '{"description": "Maps vital_name to a standardized list of vital signs", "permissible": "Under-development"}',
  vital_value DOUBLE COMMENT '{"description": "Recorded value corresponding to a vital sign.", "permissible": "No restriction"}',
  vital_unit VARCHAR COMMENT '{"description": "Unit of measurement for that vital sign.", "permissible": "Under-development"}'
);

-- Intake_Output
CREATE TABLE Intake_Output (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  io_dttm DATETIME COMMENT '{"description": "Date and time when the intake/output was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  io_name VARCHAR COMMENT '{"description": "Name of the intake/output. This field is used to store the intake/output from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  io_category VARCHAR COMMENT '{"description": "Maps io_name to a standardized list of intake/output categories", "permissible": "Under-development"}',
  io_value DOUBLE COMMENT '{"description": "Recorded value corresponding to an intake/output.", "permissible": "No restriction"}',
  io_unit VARCHAR COMMENT '{"description": "Unit of measurement for that intake/output.", "permissible": "Under-development"}'
);

-- Invasive Hemodynamics
CREATE TABLE Invasive_Hemodynamics (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  device_id VARCHAR COMMENT '{"description": "Unique identifier for invasive device", "permissible": "No restriction"}',
  recorded_dttm DATETIME COMMENT '{"description": "Timestamp when hemodynamic parameters were recorded", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  hemodynamic_mode_name VARCHAR COMMENT '{"description": "Name of hemodynamic mode (e.g., IABP, CVP)", "permissible": "No restriction"}',
  hemodynamic_mode_category VARCHAR COMMENT '{"description": "Maps hemodynamic_mode_name to a standardized list of hemodynamic modes", "permissible": "Under-development"}',
  blood_pressure DOUBLE COMMENT '{"description": "Blood pressure (mmHg)", "permissible": "No restriction"}',
  heart_rate INT COMMENT '{"description": "Heart rate (beats/min)", "permissible": "No restriction"}',
  respiratory_rate INT COMMENT '{"description": "Respiratory rate (breaths/min)", "permissible": "No restriction"}'
);

-- Key ICU orders
CREATE TABLE Key_ICU_Orders (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  order_dttm DATETIME COMMENT '{"description": "Date and time when the order was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  order_name VARCHAR COMMENT '{"description": "Name of the order. This field is used to store the order from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  order_category VARCHAR COMMENT '{"description": "Maps order_name to a standardized list of ICU orders", "permissible": "Under-development"}',
  order_status VARCHAR COMMENT '{"description": "Status of the order (e.g., Active, Completed, Cancelled)", "permissible": "No restriction"}',
  order_priority VARCHAR COMMENT '{"description": "Priority of the order (e.g., High, Medium, Low)", "permissible": "No restriction"}'
);

-- Medication Admin Intermittent
CREATE TABLE Medication_Admin_Intermittent (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  admin_dttm DATETIME COMMENT '{"description": "Date and time when the medicine was administered. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  med_name VARCHAR COMMENT '{"description": "Original med name string recorded in the raw data which often contains concentration e.g. NOREPInephrine 8 mg/250 mL", "permissible": "No restriction"}',
  med_category VARCHAR COMMENT '{"description": "Maps med_name to a limited set of active ingredients for important ICU medications, e.g. norepinephrine", "permissible": "See mCIDE/clif_medication_admin_continuous_med_categories.csv"}',
  med_group VARCHAR COMMENT '{"description": "Limited number of ICU medication groups identified by the CLIF consortium, e.g. vasoactives", "permissible": "See mCIDE/clif_medication_admin_continuous_med_categories.csv"}',
  med_route_name VARCHAR COMMENT '{"description": "Medicine delivery route", "permissible": "e.g. IV, enteral"}',
  med_route_category VARCHAR COMMENT '{"description": "Maps med_route_name to a standardized list of medication delivery routes", "permissible": "Under-development"}',
  med_dose DOUBLE COMMENT '{"description": "Quantity taken in dose", "permissible": "No restriction"}',
  med_dose_unit VARCHAR COMMENT '{"description": "Unit of dose. It must be a rate, e.g. mcg/min. Boluses should be mapped to med_admin_intermittent", "permissible": "No restriction"}',
  mar_action_name VARCHAR COMMENT '{"description": "MAR (medication administration record) action, e.g. stopped", "permissible": "No restriction"}',
  mar_action_category VARCHAR COMMENT '{"description": "Maps mar_action_name to a standardized list of MAR actions", "permissible": "Under-development"}'
);

-- Medication Orders
CREATE TABLE Medication_Orders (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  order_dttm DATETIME COMMENT '{"description": "Date and time when the order was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  med_name VARCHAR COMMENT '{"description": "Name of the medication order. This field is used to store the order from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  med_category VARCHAR COMMENT '{"description": "Maps med_name to a standardized list of medication orders", "permissible": "Under-development"}',
  order_status VARCHAR COMMENT '{"description": "Status of the order (e.g., Active, Completed, Cancelled)", "permissible": "No restriction"}',
  order_priority VARCHAR COMMENT '{"description": "Priority of the order (e.g., High, Medium, Low)", "permissible": "No restriction"}'
);

-- Procedures
CREATE TABLE Procedures (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  procedure_dttm DATETIME COMMENT '{"description": "Date and time when the procedure was performed. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  procedure_name VARCHAR COMMENT '{"description": "Name of the procedure. This field is used to store the procedure from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  procedure_category VARCHAR COMMENT '{"description": "Maps procedure_name to a standardized list of procedures", "permissible": "Under-development"}',
  procedure_type VARCHAR COMMENT '{"description": "Type of procedure (e.g., Surgical, Diagnostic, Therapeutic)", "permissible": "No restriction"}',
  procedure_priority VARCHAR COMMENT '{"description": "Priority of the procedure (e.g., High, Medium, Low)", "permissible": "No restriction"}'
);

-- Provider
CREATE TABLE Provider (
  provider_id VARCHAR COMMENT '{"description": "Unique identifier for each provider. This is presumed to be a distinct individual.", "permissible": "No restriction"}',
  provider_name VARCHAR COMMENT '{"description": "Name of the provider. This field is used to store the provider from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  provider_category VARCHAR COMMENT '{"description": "Maps provider_name to a standardized list of providers", "permissible": "Under-development"}'
);

-- Sensitivity
CREATE TABLE Sensitivity (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  sensitivity_dttm DATETIME COMMENT '{"description": "Date and time when the sensitivity test was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  sensitivity_name VARCHAR COMMENT '{"description": "Name of the sensitivity test. This field is used to store the sensitivity test from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  sensitivity_category VARCHAR COMMENT '{"description": "Maps sensitivity_name to a standardized list of sensitivities", "permissible": "Under-development"}',
  organism_name VARCHAR COMMENT '{"description": "Name of the organism tested.", "permissible": "No restriction"}',
  organism_group VARCHAR COMMENT '{"description": "Maps organism_name to the standardized list of organisms in the NIH CDE", "permissible": "See mCIDE/clif_microbiology_culture_organism_groups.csv"}'
);

-- Therapy Details
CREATE TABLE Therapy_Details (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  therapy_dttm DATETIME COMMENT '{"description": "Date and time when the therapy detail was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  therapy_name VARCHAR COMMENT '{"description": "Name of the therapy detail. This field is used to store the therapy detail from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  therapy_category VARCHAR COMMENT '{"description": "Maps therapy_name to a standardized list of therapy details", "permissible": "Under-development"}',
  therapy_type VARCHAR COMMENT '{"description": "Type of therapy (e.g., Medication, Procedure, Device)", "permissible": "No restriction"}',
  therapy_priority VARCHAR COMMENT '{"description": "Priority of the therapy (e.g., High, Medium, Low)", "permissible": "No restriction"}'
);

-- Transfusion
CREATE TABLE Transfusion (
  hospitalization_id VARCHAR COMMENT '{"description": "Unique identifier for each hospitalization", "permissible": "No restriction"}',
  transfusion_dttm DATETIME COMMENT '{"description": "Date and time when the transfusion was recorded. All datetime variables must be timezone-aware and set to UTC.", "permissible": "Datetime format should be YYYY-MM-DD HH:MM:SS+00:00 (UTC)"}',
  transfusion_name VARCHAR COMMENT '{"description": "Name of the transfusion. This field is used to store the transfusion from the source data. It is not used for analysis.", "permissible": "No restriction"}',
  transfusion_category VARCHAR COMMENT '{"description": "Maps transfusion_name to a standardized list of transfusions", "permissible": "Under-development"}',
  blood_type VARCHAR COMMENT '{"description": "Type of blood transfused (e.g., A+, A-, B+, B-, O+, O-, AB+, AB-)", "permissible": "No restriction"}',
  volume DOUBLE COMMENT '{"description": "Volume of blood transfused (mL)", "permissible": "No restriction"}'
);



