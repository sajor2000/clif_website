-- Stable, human-facing sequence number for project runs ("#3" on each card).
--
-- Assigned once at creation and never reused: deleting #2 leaves #1 and #3
-- untouched, so a number cited in an email or a meeting keeps pointing at the
-- same project. A number derived at render from creation order would instead
-- renumber every later project the moment one is deleted.
--
-- Backfill ranks existing rows by created_at, with id as a deterministic
-- tiebreak so two rows sharing a timestamp cannot collide on the unique index.
--
-- Like 008, the ALTER is not idempotent -- re-running it errors with
-- "duplicate column name: project_number", which is safe to ignore.
--
-- Apply once:  turso db shell clif-consortium < migrations/013-project-number.sql
ALTER TABLE project_runs ADD COLUMN project_number INTEGER;

UPDATE project_runs
SET project_number = (
  SELECT COUNT(*)
  FROM project_runs p2
  WHERE p2.created_at < project_runs.created_at
     OR (p2.created_at = project_runs.created_at AND p2.id <= project_runs.id)
);

-- Numbers are handed out by create.ts as MAX(project_number) + 1. The unique
-- index is the backstop: if two runs are ever created in the same instant, the
-- second insert fails loudly instead of silently duplicating a number.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_runs_number
  ON project_runs(project_number);
