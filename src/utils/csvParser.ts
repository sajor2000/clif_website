// CSV Parser Utility for Consortium Data
// Transforms CSV data into a structured format for the dashboard

export interface SiteYearData {
  site: string;
  year: string;
  characteristics: Map<string, string>;
}

export interface CharacteristicData {
  variable: string;
  sites: Map<string, Map<string, string>>; // site -> year -> value
}

export interface ParsedConsortiumData {
  allSites: string[];
  allYears: string[];
  characteristics: CharacteristicData[];
  siteYearData: SiteYearData[];
}

/**
 * Parse consortium CSV data
 * CSV format: Variable,upenn_Overall,upenn_2017,...
 */
export function parseConsortiumCSV(csvContent: string): ParsedConsortiumData {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');

  // Extract unique sites and years from headers
  const siteYearMap = new Map<string, Set<string>>();
  const allSitesSet = new Set<string>();
  const allYearsSet = new Set<string>();

  // Parse headers (skip first column which is "Variable")
  for (let i = 1; i < headers.length; i++) {
    const header = headers[i].trim();
    const parts = header.split('_');

    if (parts.length >= 2) {
      const site = parts[0].toUpperCase();
      const year = parts[1];

      allSitesSet.add(site);

      if (year !== 'Overall') {
        allYearsSet.add(year);
      }

      if (!siteYearMap.has(site)) {
        siteYearMap.set(site, new Set());
      }
      siteYearMap.get(site)!.add(year);
    }
  }

  const allSites = Array.from(allSitesSet).sort();
  const allYears = Array.from(allYearsSet).sort();

  // Parse data rows
  const characteristics: CharacteristicData[] = [];
  const siteYearData: SiteYearData[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Split by comma but preserve commas within quotes
    const values = parseCSVLine(lines[i]);
    const variable = values[0];

    if (!variable) continue;

    const charData: CharacteristicData = {
      variable,
      sites: new Map(),
    };

    // Parse each column
    for (let j = 1; j < headers.length && j < values.length; j++) {
      const header = headers[j].trim();
      const parts = header.split('_');

      if (parts.length >= 2) {
        const site = parts[0].toUpperCase();
        const year = parts[1];
        const value = values[j].trim();

        if (!charData.sites.has(site)) {
          charData.sites.set(site, new Map());
        }
        charData.sites.get(site)!.set(year, value);
      }
    }

    characteristics.push(charData);
  }

  // Build siteYearData array
  for (const [site, years] of siteYearMap) {
    for (const year of years) {
      const charMap = new Map<string, string>();

      for (const char of characteristics) {
        const siteData = char.sites.get(site);
        if (siteData && siteData.has(year)) {
          charMap.set(char.variable, siteData.get(year)!);
        }
      }

      siteYearData.push({
        site,
        year,
        characteristics: charMap,
      });
    }
  }

  return {
    allSites,
    allYears,
    characteristics,
    siteYearData,
  };
}

/**
 * Parse a CSV line handling quoted values with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Get data for a specific site and year
 */
export function getSiteYearData(
  data: ParsedConsortiumData,
  site: string,
  year: string
): Map<string, string> | null {
  const found = data.siteYearData.find(
    (d) => d.site === site && d.year === year
  );
  return found ? found.characteristics : null;
}

/**
 * Get all data for a specific characteristic across sites and years
 */
export function getCharacteristicData(
  data: ParsedConsortiumData,
  variable: string
): CharacteristicData | null {
  return data.characteristics.find((c) => c.variable === variable) || null;
}

/**
 * Filter data by sites and years
 */
export function filterData(
  data: ParsedConsortiumData,
  sites?: string[],
  years?: string[]
): SiteYearData[] {
  return data.siteYearData.filter((d) => {
    const siteMatch = !sites || sites.length === 0 || sites.includes(d.site);
    const yearMatch = !years || years.length === 0 || years.includes(d.year);
    return siteMatch && yearMatch;
  });
}

/**
 * Extract numeric value from formatted string (e.g., "68,359 (57.6%)" -> 68359)
 */
export function extractNumericValue(value: string): number | null {
  // Remove quotes if present
  value = value.replace(/^"|"$/g, '');

  // Try to extract first number (handles formats like "152,603" or "65 [53, 76]")
  const match = value.match(/^[\d,]+/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return null;
}

/**
 * Extract percentage from formatted string (e.g., "68,359 (57.6%)" -> 57.6)
 */
export function extractPercentage(value: string): number | null {
  const match = value.match(/\((\d+\.?\d*)%\)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Check if a variable is a demographic characteristic
 */
export function isDemographic(variable: string): boolean {
  const demographicKeywords = [
    'Age',
    'Race',
    'Ethnicity',
    'Sex',
    'Gender',
  ];

  return demographicKeywords.some((keyword) =>
    variable.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Group characteristics by category
 */
export function groupCharacteristics(data: ParsedConsortiumData): Map<string, CharacteristicData[]> {
  const groups = new Map<string, CharacteristicData[]>();

  for (const char of data.characteristics) {
    const variable = char.variable.trim();
    let category = 'Other';

    // Demographics
    if (variable.includes('Age at admission') ||
        variable.includes('Race:') ||
        variable.includes('Ethnicity:') ||
        variable.includes('Sex:')) {
      category = 'Demographics';
    }
    // Encounter Information
    else if (variable.includes('Encounter Types') ||
             variable.includes('ICU encounters') ||
             variable.includes('Advanced respiratory support') ||
             variable.includes('Vasoactive support') ||
             variable.includes('Other critically ill') ||
             variable.includes('admission location:') ||
             variable.includes('Admission type:')) {
      category = 'Encounter Information';
    }
    // Clinical Outcomes
    else if (variable.includes('Hospital mortality') ||
             variable.includes('Discharged to hospice') ||
             variable.includes('Expired') ||
             variable.includes('length of stay')) {
      category = 'Clinical Outcomes';
    }
    // Comorbidities
    else if (variable.includes('Charlson') ||
             variable.includes('Comorbidities') ||
             variable.includes('Heart Failure') ||
             variable.includes('Renal Disease') ||
             variable.includes('Pulmonary Disease') ||
             variable.includes('Cerebrovascular') ||
             variable.includes('Cancer') ||
             variable.includes('Metastatic') ||
             variable.includes('Vascular Disease') ||
             variable.includes('Myocardial') ||
             variable.includes('Dementia') ||
             variable.includes('Liver Disease') ||
             variable.includes('Hemiplegia') ||
             variable.includes('Connective Tissue') ||
             variable.includes('Peptic Ulcer') ||
             variable.includes('Aids')) {
      category = 'Comorbidities';
    }
    // Severity Scores
    else if (variable.includes('SOFA') ||
             variable.includes('P/F ratio')) {
      category = 'Severity Scores';
    }
    // Respiratory Support
    else if (variable.includes('mechanical ventilation') ||
             variable.includes('IMV') ||
             variable.includes('ventilator mode') ||
             variable.includes('FiO2') ||
             variable.includes('PEEP') ||
             variable.includes('Respiratory rate') ||
             variable.includes('Tidal volume')) {
      category = 'Respiratory Support';
    }
    // Cardiovascular Support
    else if (variable.includes('Vasopressor') ||
             variable.includes('Norepinephrine') ||
             variable.includes('Epinephrine') ||
             variable.includes('Phenylephrine') ||
             variable.includes('Vasopressin') ||
             variable.includes('Dopamine') ||
             variable.includes('Dobutamine')) {
      category = 'Cardiovascular Support';
    }
    // Renal Support
    else if (variable.includes('CRRT')) {
      category = 'Renal Support';
    }
    // Basic Counts
    else if (variable.startsWith('N:')) {
      category = 'Counts';
    }

    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(char);
  }

  return groups;
}
