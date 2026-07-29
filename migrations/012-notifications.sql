-- In-portal notifications for members (/portal/notifications + header bell).
--
-- Holds DISCRETE EVENTS delivered to a specific user (a new project run was
-- filed, a site was nudged to run a project, etc.). Standing obligations
-- ("your site hasn't run project X", "your profile is incomplete") are NOT
-- stored here — they are derived live from existing tables by src/lib/tasks.ts,
-- so they self-heal when the underlying state changes.
--
-- One row per (recipient, event). `title`/`link` are pre-rendered so the bell
-- and inbox render from a single indexed query with no joins. `entity_type` +
-- `entity_id` support deep-linking and de-duplication.
--
-- Apply once:  turso db shell clif-consortium < migrations/012-notifications.sql
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,          -- e.g. 'project_run.created', 'project_run.site_nudged'
  title        TEXT NOT NULL,          -- pre-rendered summary line
  body         TEXT,                   -- optional detail line
  link         TEXT,                   -- deep link, e.g. /portal/project-runs
  entity_type  TEXT,                   -- 'project_run' | 'los_request' | 'site' | ...
  entity_id    TEXT,                   -- for dedup + deep-linking
  actor_id     TEXT REFERENCES users(id),  -- who triggered it (nullable = system)
  read_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bell/inbox query path: newest-first per user, unread cheaply countable.
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, read_at, created_at);
