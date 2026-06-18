-- Track per-user deadline reminders so each member is reminded at most once
-- per proposal (the cron job in /api/proposals/remind reads/writes this).
CREATE TABLE IF NOT EXISTS proposal_reminders (
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (proposal_id, user_id)
);
