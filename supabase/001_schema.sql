-- Ọjà Pantry schema. Run once in Supabase -> SQL Editor.
-- All money columns are integer kobo.

create sequence order_number_seq start 100001;

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  sort_order int not null,
  active boolean not null default true
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  label text not null,
  price_kobo integer not null check (price_kobo > 0),
  stock integer not null default 25 check (stock >= 0),
  sort_order int not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('OJA-' || nextval('order_number_seq')),
  user_id uuid not null references auth.users (id),
  status text not null default 'placed' check (status = 'placed'),
  customer_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  city text not null,
  state text not null,
  note text,
  subtotal_kobo integer not null check (subtotal_kobo >= 0),
  delivery_kobo integer not null check (delivery_kobo >= 0),
  total_kobo integer not null check (total_kobo >= 0),
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  variant_id uuid not null references product_variants (id),
  product_name text not null,
  option_label text not null,
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total_kobo integer not null check (line_total_kobo >= 0)
);

create index product_variants_product_id_idx on product_variants (product_id);
create index orders_user_id_idx on orders (user_id);
create index order_items_order_id_idx on order_items (order_id);

-- Row Level Security on every table.
alter table products enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Belt and braces: the browser roles get read access only, never writes.
revoke all on products, product_variants, orders, order_items from anon, authenticated;
grant select on products, product_variants to anon, authenticated;
grant select on orders, order_items to authenticated;

create policy "Anyone can read products"
  on products for select to anon, authenticated using (true);

create policy "Anyone can read variants"
  on product_variants for select to anon, authenticated using (true);

create policy "Users read their own orders"
  on orders for select to authenticated using (user_id = auth.uid());

create policy "Users read their own order items"
  on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

-- The only way an order is created. Prices and totals come from the database,
-- never from the browser. Error messages are short codes the client maps to text.
create function public.place_order(p_items jsonb, p_delivery jsonb)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_count int;
  v_ids uuid[];
  v_valid boolean;
  v_found int;
  v_short text;
  v_name text := btrim(coalesce(p_delivery ->> 'customer_name', ''));
  v_phone text := btrim(coalesce(p_delivery ->> 'phone', ''));
  v_address text := btrim(coalesce(p_delivery ->> 'address', ''));
  v_city text := btrim(coalesce(p_delivery ->> 'city', ''));
  v_state text := btrim(coalesce(p_delivery ->> 'state', ''));
  v_note text := nullif(btrim(coalesce(p_delivery ->> 'note', '')), '');
  v_subtotal integer;
  v_delivery integer;
  v_order_id uuid;
  v_order_number text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'no_email';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'invalid_items';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 20 then
    raise exception 'invalid_items';
  end if;

  begin
    select array_agg((e ->> 'variant_id')::uuid),
           coalesce(bool_and(
             (e ->> 'variant_id') is not null
             and coalesce((e ->> 'quantity')::int between 1 and 10, false)
           ), false)
      into v_ids, v_valid
      from jsonb_array_elements(p_items) e;
  exception when others then
    raise exception 'invalid_items';
  end;
  if not v_valid then
    raise exception 'invalid_items';
  end if;
  if (select count(distinct x) from unnest(v_ids) x) <> v_count then
    raise exception 'duplicate_items';
  end if;

  if v_name = '' or v_phone = '' or v_address = '' or v_city = '' or v_state = ''
     or length(v_name) > 100 or length(v_phone) > 30 or length(v_address) > 300
     or length(v_city) > 100 or length(v_state) > 50 or length(v_note) > 500 then
    raise exception 'invalid_delivery';
  end if;

  -- Lock the rows (in a fixed order, to avoid deadlocks) so stock can't be oversold.
  perform 1
    from product_variants v
    join products p on p.id = v.product_id
   where v.id = any (v_ids)
   order by v.id
     for update of v;

  select count(*) into v_found
    from product_variants v
    join products p on p.id = v.product_id
   where v.id = any (v_ids) and p.active;
  if v_found <> v_count then
    raise exception 'unavailable_item';
  end if;

  select p.name || ' ' || v.label into v_short
    from jsonb_array_elements(p_items) e
    join product_variants v on v.id = (e ->> 'variant_id')::uuid
    join products p on p.id = v.product_id
   where v.stock < (e ->> 'quantity')::int
   limit 1;
  if found then
    raise exception 'out_of_stock:%', v_short;
  end if;

  select sum(v.price_kobo * (e ->> 'quantity')::int)::integer into v_subtotal
    from jsonb_array_elements(p_items) e
    join product_variants v on v.id = (e ->> 'variant_id')::uuid;
  v_delivery := case when v_subtotal >= 3000000 then 0 else 250000 end;

  insert into orders (
    user_id, customer_name, email, phone, address, city, state, note,
    subtotal_kobo, delivery_kobo, total_kobo
  ) values (
    v_uid, v_name, v_email, v_phone, v_address, v_city, v_state, v_note,
    v_subtotal, v_delivery, v_subtotal + v_delivery
  )
  returning orders.id, orders.order_number into v_order_id, v_order_number;

  insert into order_items (
    order_id, variant_id, product_name, option_label,
    unit_price_kobo, quantity, line_total_kobo
  )
  select v_order_id, v.id, p.name, v.label, v.price_kobo, i.q, v.price_kobo * i.q
    from (
      select (e ->> 'variant_id')::uuid as vid, (e ->> 'quantity')::int as q
        from jsonb_array_elements(p_items) e
    ) i
    join product_variants v on v.id = i.vid
    join products p on p.id = v.product_id;

  update product_variants v
     set stock = v.stock - i.q
    from (
      select (e ->> 'variant_id')::uuid as vid, (e ->> 'quantity')::int as q
        from jsonb_array_elements(p_items) e
    ) i
   where v.id = i.vid;

  return query select v_order_id, v_order_number;
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
