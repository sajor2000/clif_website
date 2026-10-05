-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/024-project-runs-ats-2027.sql
--
-- Rename the project-run conference tag 'ATS 2026' to 'ATS 2027'.
--
-- The tag shipped in September 2026 (migration 022), after ATS 2026 had already
-- met, so every run carrying it is headed for ATS 2027. CURRENT_ATS in
-- src/lib/project-run-status.ts moves with this, and the ATS tab only lists
-- runs whose tag matches it.
--
-- Ticking the ATS box also autofills purpose_detail with the tag, so rename
-- that where it is still the untouched autofill. It runs first because it keys
-- off the old conference value.
UPDATE project_runs SET purpose_detail = 'ATS 2027'
 WHERE conference = 'ATS 2026' AND TRIM(purpose_detail) = 'ATS 2026';

UPDATE project_runs SET conference = 'ATS 2027' WHERE conference = 'ATS 2026';
