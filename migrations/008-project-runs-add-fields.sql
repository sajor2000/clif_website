-- Adds columns to project_runs that were introduced after the initial 007
-- migration was already applied to the live database. 007 uses
-- CREATE TABLE IF NOT EXISTS, so re-running it does not add these columns to an
-- existing table — hence these ALTERs. All are nullable TEXT; safe and additive.
--
-- If a column already exists, the corresponding ALTER errors with
-- "duplicate column name" and can be skipped.
ALTER TABLE project_runs ADD COLUMN instructions TEXT;
ALTER TABLE project_runs ADD COLUMN purpose TEXT;
ALTER TABLE project_runs ADD COLUMN purpose_detail TEXT;
ALTER TABLE project_runs ADD COLUMN results_deadline TEXT;
