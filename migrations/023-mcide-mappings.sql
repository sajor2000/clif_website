-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/023-mcide-mappings.sql
--
-- mCIDE Surveyor (/portal/mcide-surveyor): what each site maps its raw
-- EHR `*_name` strings to, per mCIDE `*_category` field.
--
-- Loaded by scripts/build-mcide-mappings.mjs from the TableOne Box export; the
-- repo is public, so this data lives only here. Every run replaces both tables.
--
-- mcide_mapping_docs: one row per field. `doc` is the gzipped JSON the field
-- view renders client-side (MappingDoc in src/utils/mcideMappings.ts);
-- `summary` is the small per-site scorecard the landing page renders.
CREATE TABLE IF NOT EXISTS mcide_mapping_docs (
  field_key TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  run_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  doc BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- mcide_mapping_names: one row per (field, raw name, category) for the global
-- "what did others map this string to" lookup, searched server-side.
CREATE TABLE IF NOT EXISTS mcide_mapping_names (
  id INTEGER PRIMARY KEY,
  field_key TEXT NOT NULL,
  name TEXT NOT NULL,
  norm TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  sites TEXT NOT NULL,
  n_all INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcide_names_norm ON mcide_mapping_names(norm);
CREATE INDEX IF NOT EXISTS idx_mcide_names_field_cat ON mcide_mapping_names(field_key, category);

-- Substring search on raw names. The build script rebuilds it after each load;
-- lookup falls back to LIKE on norm if the trigram tokenizer is unavailable.
CREATE VIRTUAL TABLE IF NOT EXISTS mcide_mapping_names_fts
  USING fts5(name, content='mcide_mapping_names', content_rowid='id', tokenize='trigram');
