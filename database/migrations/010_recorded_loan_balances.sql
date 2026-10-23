CREATE TABLE recorded_loan_balances (
    id VARCHAR(80) PRIMARY KEY,
    business_id VARCHAR(80) NOT NULL REFERENCES businesses(id),
    lender_kind VARCHAR(20) NOT NULL CHECK (lender_kind IN ('bank','individual')),
    lender_name VARCHAR(200) NOT NULL,
    outstanding_principal_mmk NUMERIC(18,2) NOT NULL CHECK (outstanding_principal_mmk > 0),
    as_of_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_recorded_loan_balances_business_id ON recorded_loan_balances(business_id);
ALTER TABLE recorded_loan_balances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON recorded_loan_balances FROM anon, authenticated;
