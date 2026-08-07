-- Migration 017: Hospital-level details (from the internal tracker "Hospital Details" tab)
-- Backs the Hospitals view on /portal/site-details.
-- Run via: turso db shell clif-consortium < migrations/017-hospitals.sql
-- (or let scripts/import-hospitals-csv.mjs create the table on first run)

CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  site_id TEXT REFERENCES site_details(id) ON DELETE SET NULL,
  site_key TEXT NOT NULL,              -- health-system name from the site's config.json (e.g. "NU", "Penn")
  hospital_id_name TEXT NOT NULL,      -- e.g. "Emory University - EUH"
  hospital_full_name TEXT,
  hospital_id TEXT,                    -- hospital_id from the ADT table
  hospital_number INTEGER,
  ccn TEXT,                            -- CMS Certification Number
  zipcode TEXT,                        -- TEXT to keep leading zeros
  hospital_type TEXT,                  -- Academic | Community
  rt_vent_protocol TEXT,               -- respiratory-therapy-driven ventilator protocol (free text)
  num_icus INTEGER,
  icu_beds TEXT,                       -- TEXT: source has values like "84 adult, 155 total"
  region TEXT,
  lttv_proportion REAL,                -- proportion of patients receiving LTTV
  vent_patient_hours INTEGER,
  vent_patients INTEGER,
  vent_encounters INTEGER,
  updated_at TEXT,
  updated_by TEXT REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_site_name ON hospitals(site_key, hospital_id_name);
CREATE INDEX IF NOT EXISTS idx_hospitals_site_id ON hospitals(site_id);
