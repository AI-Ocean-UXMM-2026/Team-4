CREATE TABLE cash_balances (
    source_id VARCHAR(80) NOT NULL REFERENCES workbook_sources(id),
    balance_id VARCHAR(500) NOT NULL,
    business_id VARCHAR(500) NOT NULL REFERENCES businesses(id),
    as_of_date DATE NOT NULL,
    cash_on_hand_mmk NUMERIC(18,2) NOT NULL CHECK (cash_on_hand_mmk >= 0),
    bank_balance_mmk NUMERIC(18,2) NOT NULL CHECK (bank_balance_mmk >= 0),
    batch_id VARCHAR(80) NOT NULL REFERENCES import_batches(id),
    PRIMARY KEY (source_id, balance_id)
);
CREATE INDEX ix_cash_balances_business_id ON cash_balances(business_id);
ALTER TABLE cash_balances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cash_balances FROM anon, authenticated;
