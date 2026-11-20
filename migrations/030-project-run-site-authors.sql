-- Authors a site names when it marks a project run as run.
--
-- On the project run tracker, the person who ticks "Has run" for a site picks
-- which members from that site should be authors (themselves by default). A
-- run's author list is built from these rows: the run's creator first, then
-- each site's picks, then the CLIF Consortium group author. See
-- src/lib/project-run-authors.ts.
--
-- One row per (run, site, person). Unticking "Has run" or marking the site N/A
-- removes that site's rows. Rows go away with the run, the site or the user.
--
-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/030-project-run-site-authors.sql
CREATE TABLE IF NOT EXISTS project_run_site_authors (
  project_id TEXT NOT NULL REFERENCES project_runs(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES site_details(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by TEXT REFERENCES users(id),
  added_at TEXT NOT NULL,
  PRIMARY KEY (project_id, site_id, user_id)
);
