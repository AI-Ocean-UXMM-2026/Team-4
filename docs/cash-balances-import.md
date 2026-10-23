# Cash balance snapshots

CashBalances is an optional sheet. Older workbooks remain valid.
Columns: balance_id, as_of_date, cash_on_hand_mmk, bank_balance_mmk.
Use a stable balance_id such as CB-20261022. Imports are automatically assigned
to the authorized active business; no business_id column is needed.
Record cash counted and the total across bank accounts at the same date, in MMK.
Use zero for a confirmed zero; leave the sheet empty if balances are unknown.
Each amount must be non-negative, with at most two decimals. Use one row per date,
on or after opening_date. Retain the balance_id when correcting a snapshot.

These are independent observations for reconciliation, not cash movements.
Importing them never adds income or overrides calculated cash. Financial Health's
cash calculation continues to use opening cash and dated cash transactions.
Snapshots are retained in the typed cash_balances projection and the snapshot API.
