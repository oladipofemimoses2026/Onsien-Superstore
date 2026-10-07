-- Paystack support: allow a 'paid' status and store payment details.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('placed', 'paid'));

alter table orders add column if not exists paystack_reference text unique;
alter table orders add column if not exists paid_at timestamptz;
