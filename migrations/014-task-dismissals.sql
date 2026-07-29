-- Lets a member clear a derived "pending task" when there is genuinely nothing
-- to do (site details already complete, profile fine as-is). Only site-detail
-- and profile tasks are dismissible; run-a-project and steering-review tasks are
-- not (a project you owe is not something you can wave away).
--
-- This is NOT a blunt mute. Each row stores a `signature` describing exactly
-- what was dismissed (which fields were missing, whether the record was stale).
-- computePendingTasks suppresses a task only while its current signature still
-- matches the dismissed one -- so if the situation later changes (a new field
-- goes blank, or the record goes stale again) the signature differs and the
-- task comes back. You acknowledge a specific state, not the task forever.
--
-- One row per (member, task). Re-dismissing updates the signature in place.
--
-- Apply once:  turso db shell clif-consortium < migrations/014-task-dismissals.sql
CREATE TABLE IF NOT EXISTS task_dismissals (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key     TEXT NOT NULL,            -- matches PendingTask.key, e.g. 'stale_site:<id>' | 'incomplete_profile'
  signature    TEXT NOT NULL,            -- snapshot of the task's reason; task re-appears when this changes
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, task_key)
);
