ALTER TABLE recorded_loan_balances ADD COLUMN next_payment_date DATE;
ALTER TABLE recorded_loan_balances ADD COLUMN next_payment_mmk NUMERIC(18,2) CHECK (next_payment_mmk > 0);
ALTER TABLE recorded_loan_balances ADD COLUMN payment_frequency VARCHAR(20);
