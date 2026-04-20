-- CLIF Consortium Turso Database Schema
-- Run via: turso db shell clif-consortium < schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  google_id TEXT UNIQUE,
  full_name TEXT,
  institution TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open',
  deadline TEXT,
  is_meeting_vote INTEGER NOT NULL DEFAULT 0,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  steering_only INTEGER NOT NULL DEFAULT 0,
  meeting_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  was_present INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS site_details (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  site_name TEXT NOT NULL,
  institution TEXT,
  hospital_type TEXT,
  num_hospitals INTEGER,
  icu_beds INTEGER,
  data_source TEXT,
  source_data_date_range TEXT,
  clifed_date_range TEXT,
  notes TEXT,
  has_er_data INTEGER NOT NULL DEFAULT 0,
  has_icu_data INTEGER NOT NULL DEFAULT 0,
  has_ward_data INTEGER NOT NULL DEFAULT 0,
  irb_name TEXT,
  irb_number TEXT,
  irb_approval_date TEXT,
  irb_approval_type TEXT,
  cohort_inclusion_criteria TEXT,
  pulled_notes TEXT,
  death_dttm_source TEXT,
  updated_at TEXT,
  updated_by TEXT REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_details_name ON site_details(site_name);

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

CREATE TABLE IF NOT EXISTS status_tracker (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  site_name TEXT NOT NULL,
  task_name TEXT,
  status TEXT,
  assigned_to TEXT,
  due_date TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT,
  event_type TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  location TEXT,
  meeting_link TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- ============================================================
-- Deterministic Additive Masking (Cryptography Tool)
-- ============================================================

CREATE TABLE IF NOT EXISTS crypto_projects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  strata_config TEXT NOT NULL,
  num_sites INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL REFERENCES users(id),
  key_assigner_id TEXT REFERENCES users(id),
  result_data TEXT,
  master_key_authorized TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Multiple independent dimension configs per project.
-- A project owns the site roster + master-key access; each key_set owns
-- its own strata_config, offset range, fragments, and lifecycle.
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

CREATE TABLE IF NOT EXISTS crypto_master_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES crypto_projects(id) ON DELETE CASCADE,
  key_set_id TEXT REFERENCES crypto_key_sets(id) ON DELETE CASCADE,
  key_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crypto_site_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES crypto_projects(id) ON DELETE CASCADE,
  key_set_id TEXT REFERENCES crypto_key_sets(id) ON DELETE CASCADE,
  key_index INTEGER NOT NULL,
  label TEXT,
  assigned_to TEXT REFERENCES users(id),
  assigned_at TEXT,
  key_data TEXT NOT NULL,
  downloaded_at TEXT,
  is_dropped INTEGER NOT NULL DEFAULT 0,
  site_name TEXT,
  authorized_users TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crypto_submissions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES crypto_projects(id) ON DELETE CASCADE,
  key_set_id TEXT REFERENCES crypto_key_sets(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL REFERENCES users(id),
  submission_data TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crypto_key_sets_project ON crypto_key_sets(project_id);
CREATE INDEX IF NOT EXISTS idx_crypto_site_keys_project ON crypto_site_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_crypto_site_keys_key_set ON crypto_site_keys(key_set_id);
CREATE INDEX IF NOT EXISTS idx_crypto_site_keys_assigned ON crypto_site_keys(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crypto_master_keys_key_set ON crypto_master_keys(key_set_id);
CREATE INDEX IF NOT EXISTS idx_crypto_submissions_project ON crypto_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_crypto_submissions_key_set ON crypto_submissions(key_set_id);
