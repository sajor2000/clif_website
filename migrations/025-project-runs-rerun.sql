-- Project reruns: the same project, run again.
--
-- A project is identified by project_number; each run of it is one row in
-- project_runs. run_number is 1 for the original run and counts up from there
-- (2 for the first rerun). A rerun is a new row -- new id, so its per-site
-- checklist in project_run_sites starts empty -- that shares the previous
-- run's project_number. The earlier run keeps its own site history.
--
-- The unique index that used to pin one row per project_number now pins one
-- row per (project_number, run_number). create.ts assigns run_number as
-- MAX(run_number) + 1 for that project inside the INSERT, so two concurrent
-- reruns can't both take the same number; this index is the backstop.
--
-- Like 008 and 013, the ALTER is not idempotent -- re-running it errors with
-- "duplicate column name: run_number", which is safe to ignore.
--
-- Apply once:  turso db shell clif-consortium < migrations/025-project-runs-rerun.sql
ALTER TABLE project_runs ADD COLUMN run_number INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS idx_project_runs_number;
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_runs_number
  ON project_runs(project_number, run_number);
