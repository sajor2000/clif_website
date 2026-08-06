-- Add a single "lead author" column to the manuscript tracker (distinct from
-- `lead_authors`, the full comma-separated author list displayed as "Authors").
-- Free text so non-member values are preserved.
ALTER TABLE manuscripts ADD COLUMN lead_author TEXT;
