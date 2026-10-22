ALTER TABLE recorded_loan_balances ADD COLUMN annual_rate_pct NUMERIC(7,3) CHECK (annual_rate_pct >= 0 AND annual_rate_pct <= 1000);
ALTER TABLE recorded_loan_balances ADD COLUMN remaining_term_months INTEGER CHECK (remaining_term_months >= 1 AND remaining_term_months <= 1200);
