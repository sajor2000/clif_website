-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/020-project-runs-clif-version.sql
--
-- Record which CLIF version a project run is built on (2.0 | 2.1 | 3.0; the
-- allowed list lives in CLIF_VERSIONS in src/pages/api/project-runs/create.ts).
-- Required on new requests. Every run that predates this column was built on
-- CLIF 2.1, so backfill those. The UPDATE only touches NULLs, so re-running
-- this migration never overwrites a version someone chose.
ALTER TABLE project_runs ADD COLUMN clif_version TEXT;
UPDATE project_runs SET clif_version = '2.1' WHERE clif_version IS NULL;
