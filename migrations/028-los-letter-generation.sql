-- Generate the signed letter of collaboration from the tracker.
--
-- The letter body is the consortium's fixed template paragraph with four
-- blanks, so the request stores those blanks instead of a pasted letter:
-- the applicant PI and institution, the funding agency, and an optional
-- extra paragraph of project-specific language. Site PIs approve exactly
-- that text on the tracker; the generated .docx / .pdf is built from it,
-- signed by every PI whose decision is 'approved'.
--
-- Each PI's signature image lives in its own table (not on users, which the
-- session query selects wholesale). Stored as PNG or JPEG bytes with the
-- pixel size recorded at upload so the renderers can scale without decoding.
--
-- Apply once:  node --env-file=.env scripts/apply-migration.mjs migrations/028-los-letter-generation.sql
ALTER TABLE los_requests ADD COLUMN applicant_pi TEXT;
ALTER TABLE los_requests ADD COLUMN applicant_institution TEXT;
ALTER TABLE los_requests ADD COLUMN funding_agency TEXT;
ALTER TABLE los_requests ADD COLUMN extra_paragraph TEXT;

CREATE TABLE IF NOT EXISTS pi_signatures (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
