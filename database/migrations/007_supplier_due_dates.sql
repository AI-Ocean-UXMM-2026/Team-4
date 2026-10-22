-- Optional recorded supplier due dates. Existing rows remain undated.
ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS due_date DATE;
