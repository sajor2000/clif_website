export const SOURCES = [
    {
      // src/content/v-2-0-0-ddl.sql  &  src/content/v-2-1-0-ddl.sql
      columnRegex:
        /(\"location_type\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_adt_location_type.csv',
      csvColumn: 'location_type',
    },
    {
      columnRegex:
        /(\"location_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_adt_location_categories.csv',
      csvColumn: 'location_category',
    },
    {
      columnRegex:
        /(\"admission_type_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_hospitalization_admission_type_categories.csv',
      csvColumn: 'admission_type_category',
    },
    {
      columnRegex:
        /(\"discharge_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_hospitalization_discharge_categories.csv',
      csvColumn: 'discharge_category',
    },
    {
      columnRegex:
        /(\"race_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_patient_race_categories.csv',
      csvColumn: 'race_category',
    },
    {
      columnRegex:
        /(\"ethnicity_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_patient_ethinicity_categories.csv',
      csvColumn: 'ethnicity_category',
    },
    {
      columnRegex:
        /(\"position_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_position_categories.csv',
      csvColumn: 'position_category',
    },
    {
      columnRegex:
        /(\"vital_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_vital_categories.csv',
      csvColumn: 'vital_category',
    },
    {
      columnRegex:
        /(\"micro_component_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_microbiology_nonculture_micro_component_category.csv',
      csvColumn: 'micro_component_category',
    },
    {
      columnRegex:
        /(\"micro_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://raw.githubusercontent.com/Common-Longitudinal-ICU-data-Format/CLIF/main/mCIDE/clif_microbiology_nonculture_micro_category.csv',
      csvColumn: 'micro_category',
    },
    {
      columnRegex:
        /(\"method_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_microbiology_culture_method_categories.csv',
      csvColumn: 'method_category',
    },
    {
      columnRegex:
        /(\"lab_order_category\"[^\n]+?\"permissible\"\s*:\s*\")[^\"]*(\")/i,
      csv: 'https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/mCIDE/clif_labs_order_categories.csv',
      csvColumn: 'lab_order_category',
    },
    // …add as many as you like
  ];