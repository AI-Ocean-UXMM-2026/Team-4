-- Apply after 017_import_batch_filename.sql; requires 007_supplier_due_dates.sql.
-- Does not alter existing purchase amounts.
CREATE TABLE IF NOT EXISTS purchase_due_date_overrides (
    id VARCHAR(80) PRIMARY KEY,
    business_id VARCHAR(80) NOT NULL REFERENCES businesses(id),
    source_id VARCHAR(80) NOT NULL REFERENCES workbook_sources(id),
    purchase_id VARCHAR(80) NOT NULL,
    workbook_due_date DATE,
    manual_due_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    events JSON NOT NULL DEFAULT '[]',
    CONSTRAINT uq_purchase_due_date_overrides_business_id UNIQUE (business_id, source_id, purchase_id)
);
CREATE INDEX IF NOT EXISTS ix_purchase_due_date_overrides_business_id
    ON purchase_due_date_overrides (business_id);
-- Audit events include actor IDs and are available only through the authorized API.
ALTER TABLE purchase_due_date_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON purchase_due_date_overrides FROM anon, authenticated;
