-- 004_cart_sync.sql
-- One saved cart per signed-in user, synced across web and mobile.

create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint carts_items_is_array check (jsonb_typeof(items) = 'array'),
  constraint carts_items_max_20 check (jsonb_array_length(items) <= 20)
);

alter table public.carts enable row level security;

drop policy if exists "carts_select_own" on public.carts;
drop policy if exists "carts_insert_own" on public.carts;
drop policy if exists "carts_update_own" on public.carts;
drop policy if exists "carts_delete_own" on public.carts;

create policy "carts_select_own" on public.carts
  for select to authenticated using (auth.uid() = user_id);

create policy "carts_insert_own" on public.carts
  for insert to authenticated with check (auth.uid() = user_id);

create policy "carts_update_own" on public.carts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "carts_delete_own" on public.carts
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.carts to authenticated;
grant all on public.carts to service_role;

-- Turn on live updates (Realtime) for this table, only if not already on
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'carts'
  ) then
    alter publication supabase_realtime add table public.carts;
  end if;
end $$;
