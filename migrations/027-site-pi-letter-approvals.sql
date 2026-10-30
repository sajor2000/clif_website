-- Site PI approvals for letters of collaboration.
--
-- Admins flag the site PIs on the admin page (users.is_site_pi). When a letter
-- of collaboration request is filed, one los_approvals row is created per
-- flagged PI with a random single-purpose token, and each PI is emailed
-- Approve / Decline links carrying their token. Clicking a link records the
-- decision without logging in; the tracker shows "N of M approved".
--
-- user_id is nullable so removing a member keeps the history row (the shared
-- delete-user cleanup nulls it) instead of blocking the delete.
--
-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/027-site-pi-letter-approvals.sql
ALTER TABLE users ADD COLUMN is_site_pi INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS los_approvals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id TEXT NOT NULL REFERENCES los_requests(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  decision TEXT CHECK (decision IN ('approved', 'declined')),
  decided_at TEXT,
  decided_via TEXT,  -- 'email' (one-click link) or 'portal' (tracker button)
  emailed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_los_approvals_request ON los_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_los_approvals_user ON los_approvals(user_id);
