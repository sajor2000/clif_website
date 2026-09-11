-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/019-project-run-sites-na.sql
--
-- Let a site be marked "N/A" for a project run — the project does not apply to
-- it (no relevant data, not covered by its IRB, etc.). An N/A site is not
-- owed: it drops out of the run's "N / M sites" denominator, gets no pending
-- "run this" task or overdue flag, and is not offered a Remind button.
--
-- N/A is a recorded answer, not a mute: it shows on the run card with an
-- optional reason so the requester can see why. It is mutually exclusive with
-- has_run (setting one clears the other). May be set by that site's editors,
-- the run's requester, or an admin.
ALTER TABLE project_run_sites ADD COLUMN not_applicable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_run_sites ADD COLUMN na_reason TEXT;
