-- Add a "lead site" column to the manuscript tracker. Holds the single
-- consortium site leading the manuscript (distinct from `contributing_sites`,
-- which is the comma-separated list of all participating sites). Free text so
-- pre-existing / non-consortium values are preserved.
ALTER TABLE manuscripts ADD COLUMN lead_site TEXT;
