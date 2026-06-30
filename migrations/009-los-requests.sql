-- Letter of Support (LOS) request tracker for the members portal
-- (/portal/los-requests). A member requests consortium support for a grant,
-- providing the grant title, mechanism (e.g. R01, K99), a link to their Specific
-- Aims, and a link to the draft letter of support. Steering committee members
-- (or admins) approve or decline providing the letter; the approver and time are
-- recorded.
CREATE TABLE IF NOT EXISTS los_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  grant_title TEXT NOT NULL,
  grant_type TEXT,
  grant_deadline TEXT,
  aims_link TEXT,
  los_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
