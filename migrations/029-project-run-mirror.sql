-- One-time mirror of a closed project run's code into the CLIF GitHub org.
--
-- A weekly GitHub Action in Common-Longitudinal-ICU-data-Format/.github reads
-- /api/project-runs/mirror-queue (closed runs with a repo link and no
-- mirror_url yet), copies each repo into the org once so its code shows up in
-- org-wide code search, and reports back to /api/project-runs/mirror-results.
--
--   mirror_url   the org repo that holds the code: the snapshot copy, or the
--                original repo when it already lives in the org. Once set, the
--                run is never queued again (the copy is never re-synced).
--   mirrored_at  when mirror_url was recorded.
--   mirror_note  why the last attempt was skipped (private repo, name already
--                taken, ...). Skipped runs stay queued and are retried weekly.
--                The note is how the skip report avoids emailing the same
--                reason every week.
--
-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/029-project-run-mirror.sql
ALTER TABLE project_runs ADD COLUMN mirror_url TEXT;
ALTER TABLE project_runs ADD COLUMN mirrored_at TEXT;
ALTER TABLE project_runs ADD COLUMN mirror_note TEXT;
