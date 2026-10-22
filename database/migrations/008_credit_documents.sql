CREATE TABLE IF NOT EXISTS credit_documents (
    id VARCHAR(80) PRIMARY KEY,
    business_id VARCHAR(80) NOT NULL REFERENCES businesses(id),
    bank_id VARCHAR(40) NOT NULL,
    product_id VARCHAR(80) NOT NULL,
    requirement_key VARCHAR(80) NOT NULL,
    filename VARCHAR(200) NOT NULL,
    media_type VARCHAR(80) NOT NULL,
    content BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_credit_documents_business_id ON credit_documents(business_id);
ALTER TABLE credit_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_documents FROM anon, authenticated;
