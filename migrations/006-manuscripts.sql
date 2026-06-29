-- Manuscript tracker for the members portal (/portal/status). Mirrors the
-- "CLIF Consortium Internal Tracker - Manuscripts" sheet. Replaces the old,
-- never-populated `status_tracker` table as the data source for that page;
-- `status_tracker` is left in place but is now unused.
--
-- `status` holds comma-separated canonical tag slugs (see src/lib/manuscript-status.ts).
-- Rows are seeded/refreshed via scripts/import-manuscripts-csv.mjs and edited
-- in-portal by admins via /api/manuscripts/{create,update,delete}.
CREATE TABLE IF NOT EXISTS manuscripts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  clif_version TEXT,
  ats TEXT,
  status TEXT,
  github_repo TEXT,
  manuscript_link TEXT,
  lead_authors TEXT,
  journal TEXT,
  cite TEXT,
  contributing_sites TEXT,
  validation_buddy TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  updated_by TEXT REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manuscripts_title ON manuscripts(title);
