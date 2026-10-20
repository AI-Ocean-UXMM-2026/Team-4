-- Additive: legacy profiles, memberships, imported facts and sources are preserved.
ALTER TABLE users ADD COLUMN full_name VARCHAR(120);
ALTER TABLE users ADD COLUMN email VARCHAR(254);
ALTER TABLE businesses ADD COLUMN owner_id VARCHAR(80) REFERENCES users(id);
ALTER TABLE businesses ADD COLUMN industry VARCHAR(120);
ALTER TABLE businesses ADD COLUMN city VARCHAR(120);
ALTER TABLE businesses ADD COLUMN phone VARCHAR(40);
ALTER TABLE businesses ADD COLUMN address VARCHAR(500);
ALTER TABLE businesses ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'MMK';
CREATE UNIQUE INDEX uq_businesses_owner_id ON businesses(owner_id);
CREATE TABLE auth_request_limits (
    key VARCHAR(64) PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    count INTEGER NOT NULL
);
