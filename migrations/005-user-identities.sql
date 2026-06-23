-- Linked login identities: let one member authenticate with several Google
-- accounts (e.g. an institutional email AND a personal Gmail) while keeping a
-- single member record.
--
-- Before this, a member was one `users` row hardcoded to one email + one
-- google_id, so signing in with a second Google account created a duplicate
-- row. Login resolution now goes through user_identities; `users.email` /
-- `users.google_id` remain the member's primary identity for display + back
-- compat.
--
-- Apply once:  turso db shell clif-consortium < migrations/005-user-identities.sql

CREATE TABLE IF NOT EXISTS user_identities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_id TEXT UNIQUE,
  email TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_google ON user_identities(google_id);
CREATE INDEX IF NOT EXISTS idx_user_identities_email ON user_identities(lower(email));

-- Backfill: one primary identity per existing user from their current login.
-- Idempotent — skips any user that already has an identity row.
INSERT INTO user_identities (user_id, google_id, email, is_primary)
SELECT id, google_id, email, 1
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM user_identities ui WHERE ui.user_id = users.id
);
