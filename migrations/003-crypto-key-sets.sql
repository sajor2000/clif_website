-- Migration 003: Introduce crypto_key_sets to support multiple independent
-- dimension configs per project.
--
-- Run via: turso db shell clif-consortium < migrations/003-crypto-key-sets.sql
--
-- Each existing crypto_projects row gets a single "Default" key_set that
-- inherits the project's current strata_config. Existing crypto_site_keys,
-- crypto_master_keys, and crypto_submissions rows are re-pointed to that
-- key_set so the new API paths (which filter by key_set_id) keep working
-- against pre-existing data.

BEGIN TRANSACTION;

-- 1. New key_sets table
CREATE TABLE IF NOT EXISTS crypto_key_sets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES crypto_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strata_config TEXT NOT NULL,
  min_offset INTEGER NOT NULL DEFAULT 0,
  max_offset INTEGER NOT NULL DEFAULT 40,
  status TEXT NOT NULL DEFAULT 'keys_assigned',
  result_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crypto_key_sets_project ON crypto_key_sets(project_id);

-- 2. Backfill: one default key_set per existing project.
-- SQLite's randomblob() inside INSERT...SELECT generates one value per row.
INSERT INTO crypto_key_sets (id, project_id, name, strata_config, min_offset, max_offset, status, result_data, created_at)
SELECT
  lower(hex(randomblob(16))),
  p.id,
  'Default',
  p.strata_config,
  0,
  40,
  CASE WHEN p.status IN ('keys_assigned', 'collecting', 'complete', 'cancelled') THEN p.status ELSE 'keys_assigned' END,
  p.result_data,
  p.created_at
FROM crypto_projects p
WHERE NOT EXISTS (SELECT 1 FROM crypto_key_sets ks WHERE ks.project_id = p.id);

-- 3. Add key_set_id column to crypto_site_keys (nullable for compatibility).
ALTER TABLE crypto_site_keys ADD COLUMN key_set_id TEXT REFERENCES crypto_key_sets(id) ON DELETE CASCADE;

UPDATE crypto_site_keys
SET key_set_id = (SELECT id FROM crypto_key_sets ks WHERE ks.project_id = crypto_site_keys.project_id LIMIT 1)
WHERE key_set_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_crypto_site_keys_key_set ON crypto_site_keys(key_set_id);

-- 4. Rebuild crypto_master_keys without the UNIQUE(project_id) constraint
--    (now unique per key_set, not per project).
CREATE TABLE crypto_master_keys_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES crypto_projects(id) ON DELETE CASCADE,
  key_set_id TEXT REFERENCES crypto_key_sets(id) ON DELETE CASCADE,
  key_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO crypto_master_keys_new (id, project_id, key_set_id, key_data, created_at)
SELECT
  mk.id,
  mk.project_id,
  (SELECT id FROM crypto_key_sets ks WHERE ks.project_id = mk.project_id LIMIT 1),
  mk.key_data,
  mk.created_at
FROM crypto_master_keys mk;

DROP TABLE crypto_master_keys;
ALTER TABLE crypto_master_keys_new RENAME TO crypto_master_keys;
CREATE INDEX IF NOT EXISTS idx_crypto_master_keys_key_set ON crypto_master_keys(key_set_id);

-- 5. Rebuild crypto_submissions similarly.
CREATE TABLE crypto_submissions_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES crypto_projects(id) ON DELETE CASCADE,
  key_set_id TEXT REFERENCES crypto_key_sets(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL REFERENCES users(id),
  submission_data TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO crypto_submissions_new (id, project_id, key_set_id, submitted_by, submission_data, submitted_at)
SELECT
  s.id,
  s.project_id,
  (SELECT id FROM crypto_key_sets ks WHERE ks.project_id = s.project_id LIMIT 1),
  s.submitted_by,
  s.submission_data,
  s.submitted_at
FROM crypto_submissions s;

DROP TABLE crypto_submissions;
ALTER TABLE crypto_submissions_new RENAME TO crypto_submissions;
CREATE INDEX IF NOT EXISTS idx_crypto_submissions_project ON crypto_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_crypto_submissions_key_set ON crypto_submissions(key_set_id);

COMMIT;
