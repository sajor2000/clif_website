-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/021-project-runs-required-tables.sql
--
-- The CLIF tables a site must have to run a project, chosen by the requester
-- from the run's CLIF version (see runnableTables in src/data/clif-tables.ts).
-- Stored as a JSON array of table names, e.g. ["adt","labs","vitals"].
-- NULL for runs that predate this column. Editing such a run asks the
-- requester to pick its tables.
ALTER TABLE project_runs ADD COLUMN required_tables TEXT;
