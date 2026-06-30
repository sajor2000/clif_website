-- Project Run Request tracker for the members portal (/portal/project-runs).
--
-- A member requesting that the consortium run a project files a request with a
-- title, code repo, and Box folder, and indicates whether they have already
-- shared preliminary results. Each consortium site then self-reports whether it
-- has run the project via a per-site checkbox (project_run_sites). A site's box
-- is toggled by that site's assigned site_editor (or an admin), mirroring the
-- authorization model used by /api/site-details/update.

CREATE TABLE IF NOT EXISTS project_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  repo_url TEXT,
  box_folder_url TEXT,
  prelim_shared INTEGER NOT NULL DEFAULT 0,
  prelim_link TEXT,
  description TEXT,
  instructions TEXT,
  purpose TEXT,
  purpose_detail TEXT,
  results_deadline TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_run_sites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES project_runs(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES site_details(id) ON DELETE CASCADE,
  has_run INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  updated_by TEXT REFERENCES users(id),
  UNIQUE(project_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_project_run_sites_project ON project_run_sites(project_id);
