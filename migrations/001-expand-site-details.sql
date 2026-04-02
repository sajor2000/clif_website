-- Migration 001: Expand site_details table and add site_editors
-- Run via: turso db shell clif-consortium < migrations/001-expand-site-details.sql

-- New columns on site_details
ALTER TABLE site_details ADD COLUMN source_data_date_range TEXT;
ALTER TABLE site_details ADD COLUMN irb_name TEXT;
ALTER TABLE site_details ADD COLUMN irb_number TEXT;
ALTER TABLE site_details ADD COLUMN irb_approval_date TEXT;
ALTER TABLE site_details ADD COLUMN irb_approval_type TEXT;
ALTER TABLE site_details ADD COLUMN cohort_inclusion_criteria TEXT;
ALTER TABLE site_details ADD COLUMN pulled_notes TEXT;
ALTER TABLE site_details ADD COLUMN death_dttm_source TEXT;
ALTER TABLE site_details ADD COLUMN institution TEXT;
ALTER TABLE site_details ADD COLUMN updated_at TEXT;
ALTER TABLE site_details ADD COLUMN updated_by TEXT REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_details_name ON site_details(site_name);

-- Site editor assignments (many-to-many)
CREATE TABLE IF NOT EXISTS site_editors (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  site_id TEXT NOT NULL REFERENCES site_details(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT,
  UNIQUE(site_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_site_editors_site ON site_editors(site_id);
CREATE INDEX IF NOT EXISTS idx_site_editors_user ON site_editors(user_id);
