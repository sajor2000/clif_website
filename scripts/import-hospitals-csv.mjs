// One-shot (re-runnable) import of
//   "CLIF Consortium Internal Tracker - Hospital Details.csv"
// into the Turso `hospitals` table that backs the Hospitals view on
// /portal/site-details.
//
// Run from repo root with the Turso env vars loaded:
//   node --env-file=.env scripts/import-hospitals-csv.mjs [path/to/csv]
//
// Behavior:
//   - Creates the `hospitals` table if missing (matches migrations/017).
//   - Links each hospital to its site_details row via SITE_NAME_MAP
//     (CSV "Site" short name -> site_details.site_name). Warns when no site
//     row exists (e.g. MIMIC) and leaves site_id NULL.
//   - Cleans spreadsheet artifacts: #REF! -> NULL, leading backticks on CCNs,
//     thousands separators, lost leading zeros in zipcodes/CCNs.
//   - Upserts each row by (site_key, hospital_id_name) — idempotent.

import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { createClient } from '@libsql/client';

const CSV_PATH =
  process.argv[2] ||
  '/Users/dema/Downloads/CLIF Consortium Internal Tracker - Hospital Details.csv';

// CSV "Site" column (health-system name from each site's config.json)
// -> site_details.site_name. "MIMIC IV 3.1" is a public dataset with no
// site_details row, so it is intentionally absent.
const SITE_NAME_MAP = {
  Emory: 'Emory University',
  JHU: 'Johns Hopkins University',
  Michigan: 'University of Michigan',
  NU: 'Northwestern University',
  OHSU: 'Oregon Health & Science University',
  Penn: 'University of Pennsylvania',
  RUMC: 'Rush University',
  UCMC: 'University of Chicago',
  UCSF: 'University of California San Francisco',
  UMN: 'University of Minnesota',
  MGB: 'Harvard University',
};

// Obvious typos in the source sheet, fixed at import time.
const TYPO_FIXES = {
  'NU - Vally West': 'NU - Valley West',
  'Northwestern Medicine Valley West Hospitala':
    'Northwestern Medicine Valley West Hospital',
  "Martha's Vinyard Hospital": "Martha's Vineyard Hospital",
};

function clean(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).replace(/\s*\n\s*/g, ' ').trim();
  if (!trimmed) return null;
  if (trimmed === '#REF!') return null;
  return TYPO_FIXES[trimmed] || trimmed;
}

function cleanInt(value) {
  const v = clean(value);
  if (v === null) return null;
  const n = parseInt(v.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function cleanFloat(value) {
  const v = clean(value);
  if (v === null) return null;
  const n = parseFloat(v.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

// Zero-pad codes that lost leading zeros in the spreadsheet
// (zipcodes are 5 digits, CMS CCNs are 6).
function padCode(value, width) {
  const v = clean(value);
  if (v === null) return null;
  const stripped = v.replace(/^`/, ''); // UCSF CCNs carry a leading backtick
  return /^\d+$/.test(stripped) && stripped.length < width
    ? stripped.padStart(width, '0')
    : stripped;
}

async function ensureTable(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS hospitals (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    site_id TEXT REFERENCES site_details(id) ON DELETE SET NULL,
    site_key TEXT NOT NULL,
    hospital_id_name TEXT NOT NULL,
    hospital_full_name TEXT,
    hospital_id TEXT,
    hospital_number INTEGER,
    ccn TEXT,
    zipcode TEXT,
    hospital_type TEXT,
    rt_vent_protocol TEXT,
    num_icus INTEGER,
    icu_beds TEXT,
    region TEXT,
    lttv_proportion REAL,
    vent_patient_hours INTEGER,
    vent_patients INTEGER,
    vent_encounters INTEGER,
    updated_at TEXT,
    updated_by TEXT REFERENCES users(id)
  )`);
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_site_name ON hospitals(site_key, hospital_id_name)'
  );
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_hospitals_site_id ON hospitals(site_id)'
  );
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error(
      'TURSO_DATABASE_URL is not set. Run with: node --env-file=.env scripts/import-hospitals-csv.mjs'
    );
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  console.log('Ensuring hospitals table…');
  await ensureTable(db);

  // Resolve site_details ids once up front.
  const siteIds = {};
  const siteRows = await db.execute('SELECT id, site_name FROM site_details');
  for (const row of siteRows.rows) siteIds[row.site_name] = row.id;

  console.log(`Reading ${CSV_PATH}`);
  const raw = await readFile(CSV_PATH, 'utf8');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });

  let inserted = 0;
  let updated = 0;
  const skipped = [];
  const unmatchedSites = new Set();

  for (const row of rows) {
    const siteKey = clean(row['Site (Health System Name from your config.json)']);
    const idName = clean(row['Hospital_ID_Name']);
    if (!siteKey || !idName) {
      skipped.push(`(row missing site/hospital name: ${JSON.stringify(row)})`);
      continue;
    }

    const siteName = SITE_NAME_MAP[siteKey];
    const siteId = siteName ? siteIds[siteName] || null : null;
    if (!siteId) unmatchedSites.add(siteKey);

    const fields = {
      site_id: siteId,
      hospital_full_name: clean(row['Hospital Full Name']),
      hospital_id: clean(row['hospital_id (from ADT table)']),
      hospital_number: cleanInt(row['hospital_number']),
      ccn: padCode(row['Hospital CCN ID'], 6),
      zipcode: padCode(row['Hospital Zipcode'], 5),
      hospital_type: clean(row['Hospital_Type']),
      rt_vent_protocol: clean(row['Respiratory_Therapy_Driven_Ventilator_Protocol']),
      num_icus: cleanInt(row['Number of ICU']),
      icu_beds: clean(row['Number_of_ICU_Beds']),
      region: clean(row['Region']),
      lttv_proportion: cleanFloat(row['Proportion_of_Patients_Receiving_LTTV']),
      vent_patient_hours: cleanInt(row['Total_Patient_Hours_of_Ventilation']),
      vent_patients: cleanInt(row['Total_Number_of_Patients_on_Ventilator']),
      vent_encounters: cleanInt(row['Total_Number_of_Encounter_with_Ventilator']),
    };
    const orderedValues = [
      fields.site_id,
      fields.hospital_full_name,
      fields.hospital_id,
      fields.hospital_number,
      fields.ccn,
      fields.zipcode,
      fields.hospital_type,
      fields.rt_vent_protocol,
      fields.num_icus,
      fields.icu_beds,
      fields.region,
      fields.lttv_proportion,
      fields.vent_patient_hours,
      fields.vent_patients,
      fields.vent_encounters,
    ];

    const existing = await db.execute({
      sql: 'SELECT id FROM hospitals WHERE site_key = ? AND hospital_id_name = ?',
      args: [siteKey, idName],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE hospitals SET
                site_id = ?, hospital_full_name = ?, hospital_id = ?,
                hospital_number = ?, ccn = ?, zipcode = ?, hospital_type = ?,
                rt_vent_protocol = ?, num_icus = ?, icu_beds = ?, region = ?,
                lttv_proportion = ?, vent_patient_hours = ?, vent_patients = ?,
                vent_encounters = ?, updated_at = datetime('now')
              WHERE id = ?`,
        args: [...orderedValues, existing.rows[0].id],
      });
      updated++;
      console.log(`  ~ updated ${siteKey} / ${idName}`);
    } else {
      await db.execute({
        sql: `INSERT INTO hospitals
                (site_key, hospital_id_name, site_id, hospital_full_name,
                 hospital_id, hospital_number, ccn, zipcode, hospital_type,
                 rt_vent_protocol, num_icus, icu_beds, region, lttv_proportion,
                 vent_patient_hours, vent_patients, vent_encounters, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [siteKey, idName, ...orderedValues],
      });
      inserted++;
      console.log(`  + inserted ${siteKey} / ${idName}`);
    }
  }

  console.log('\nDone.');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  if (unmatchedSites.size) {
    console.log(
      `  No site_details row (site_id left NULL): ${[...unmatchedSites].join(', ')}`
    );
  }
  if (skipped.length) {
    console.log(`  Skipped: ${skipped.length}`);
    for (const s of skipped) console.log(`    - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
