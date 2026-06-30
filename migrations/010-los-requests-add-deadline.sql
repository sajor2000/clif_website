-- Adds the grant_deadline column to los_requests for databases where the
-- original 009 migration was already applied (009 uses CREATE TABLE IF NOT
-- EXISTS, so re-running it won't add the column to an existing table).
ALTER TABLE los_requests ADD COLUMN grant_deadline TEXT;
