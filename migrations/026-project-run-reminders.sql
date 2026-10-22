-- Deadline reminders for project runs.
--
-- /api/project-runs/deadline-reminder (daily Vercel Cron) posts to Slack when
-- an open run's Box upload deadline is a week away and again when it is a day
-- away, listing the sites that still have to run it. One row here per
-- (run, deadline, reminder window) records that the post went out, so the job
-- never repeats itself -- but if the requester moves the deadline, the new
-- date gets its own reminders.
--
-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/026-project-run-reminders.sql
CREATE TABLE IF NOT EXISTS project_run_reminders (
  project_id TEXT NOT NULL REFERENCES project_runs(id) ON DELETE CASCADE,
  deadline TEXT NOT NULL,
  days_before INTEGER NOT NULL,  -- the reminder window this row satisfies: 7 or 1
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, deadline, days_before)
);
