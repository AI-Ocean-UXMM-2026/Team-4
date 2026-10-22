-- Optional historical sale costs and expense settlements from workbook v1 extensions.
-- Nullable columns preserve compatibility with previously imported workbooks.
alter table public.sales
  add column if not exists unit_cost_at_sale_mmk numeric(18, 2),
  add column if not exists cogs_mmk numeric(18, 2);

alter table public.expenses
  add column if not exists payment_status varchar(500),
  add column if not exists paid_date date,
  add column if not exists amount_paid_mmk numeric(18, 2);
