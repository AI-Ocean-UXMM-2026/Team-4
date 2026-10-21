-- Supabase only: requires auth.uid(), anon and authenticated roles.
-- Browser access is SELECT-only. Ingestion writes run through the authorized API.
create or replace function public.bizflow_is_member(target_business text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists(select 1 from public.business_memberships
                     where business_id = target_business and user_id = auth.uid()::text) $$;
revoke all on function public.bizflow_is_member(text) from public;
grant execute on function public.bizflow_is_member(text) to authenticated;

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
create policy user_self_read on public.users for select to authenticated using (id = auth.uid()::text);
alter table public.businesses enable row level security;
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to authenticated;
create policy business_member_read on public.businesses for select to authenticated using (public.bizflow_is_member(id));
alter table public.business_memberships enable row level security;
revoke all on public.business_memberships from anon, authenticated;
grant select on public.business_memberships to authenticated;
create policy membership_self_read on public.business_memberships for select to authenticated using (user_id = auth.uid()::text);

-- No browser policies on sources or OAuth state: encrypted tokens remain server-only.
alter table public.workbook_sources enable row level security;
alter table public.oauth_states enable row level security;
revoke all on public.workbook_sources, public.oauth_states from anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['business_settings','products','sales','customer_receipts',
    'purchases','supplier_payments','expenses','loans','loan_payments','cash_adjustments',
    'import_batches','imported_rows','row_revisions']
  loop
    execute format('alter table public.%%I enable row level security', table_name);
    execute format('revoke all on public.%%I from anon, authenticated', table_name);
    execute format('grant select on public.%%I to authenticated', table_name);
    execute format('create policy business_member_read on public.%%I for select to authenticated using (public.bizflow_is_member(business_id))', table_name);
  end loop;
end $$;
