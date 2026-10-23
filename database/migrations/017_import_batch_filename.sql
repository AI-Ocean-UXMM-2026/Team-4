-- Track the uploaded filename for historical batch activation and download.
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS filename VARCHAR(255);
