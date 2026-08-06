-- Add a "lead data scientist" column to the manuscript tracker. Holds the
-- consortium member serving as the manuscript's lead data scientist (distinct
-- from `lead_authors`). Free text so non-member values are preserved.
ALTER TABLE manuscripts ADD COLUMN lead_data_scientist TEXT;
