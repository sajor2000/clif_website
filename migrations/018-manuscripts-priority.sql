-- Apply once:  turso db shell clif-consortium < migrations/018-manuscripts-priority.sql
--
-- Add a "priority" column to the manuscript tracker. Holds a single canonical
-- slug from src/lib/manuscript-priority.js (critical | high | medium | low),
-- or NULL for
-- a manuscript nobody has triaged yet — deliberately not defaulted, so the
-- column never asserts a priority no one chose.
ALTER TABLE manuscripts ADD COLUMN priority TEXT;
