-- 0002_rls_and_functions.sql
--
-- RLS baseline (Solo Build Plan, Section 2.2) and the SECURITY
-- DEFINER functions every product's read/write access goes through.
-- [FIXED: RLS was mentioned four times across the original planning docs
-- and never once defined. This is a starting point for team review, not
-- a final answer — see the TODO on fetch_pending_preorders below for the
-- one open decision this migration deliberately does not resolve.]

alter table customers enable row level security;
alter table books enable row level security;
alter table author_events enable row level security;
alter table event_tickets enable row level security;
alter table orders enable row level security;

-- ---------------------------------------------------------------------
-- Catalog data (books, events) is public/non-sensitive: anon may SELECT
-- directly. This is what Product C's check_inventory and get_upcoming_events,
-- and Product B's evaluate_stock_status, read against client-side.
--
-- NOTE: a CREATE POLICY alone does nothing without the matching base
-- GRANT — RLS policies only filter rows for a role that already has
-- table-level SELECT privilege; they don't grant that privilege
-- themselves. This was caught by actually running this migration
-- (`permission denied for table books` with the policy alone and no
-- grant) rather than assumed from reading the SQL.
-- ---------------------------------------------------------------------
grant select on books to anon;
grant select on author_events to anon;

create policy "anon can read books"
  on books for select
  to anon
  using (true);

create policy "anon can read author_events"
  on author_events for select
  to anon
  using (true);

-- ---------------------------------------------------------------------
-- customers, event_tickets, and orders are NOT given a broad anon SELECT
-- policy. A table-level SELECT grant can't distinguish "I already know
-- this specific order_id" from "let me scan every order" — so those
-- reads go through SECURITY DEFINER functions that require the exact ID
-- as a parameter instead. No policies are created for anon on these
-- three tables; the functions below are the only access path.
-- ---------------------------------------------------------------------

-- No direct INSERT/UPDATE/DELETE grants to anon on any table. All
-- mutations go through SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------
-- create_preorder — the one mutating Live API tool (Products A voice
-- kiosk and web checkout both call this). Atomic: uses SELECT FOR UPDATE
-- so concurrent orders can't oversell stock_quantity below zero.
-- Called from app/api/live/execute-tool/route.ts (server-side only —
-- never grant EXECUTE to anon on this one; only the service role calls it).
-- ---------------------------------------------------------------------
create or replace function create_preorder(
  p_customer_id text,
  p_isbn text,
  p_quantity integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_order_id text;
begin
  select stock_quantity into v_stock
  from books
  where isbn = p_isbn
  for update; -- lock the row for the duration of this transaction

  if v_stock is null then
    raise exception 'INSUFFICIENT_STOCK: % has not been inventoried yet (stock_quantity is null)', p_isbn;
  end if;

  if v_stock < p_quantity then
    raise exception 'INSUFFICIENT_STOCK: only % of % in stock', v_stock, p_isbn;
  end if;

  update books set stock_quantity = stock_quantity - p_quantity where isbn = p_isbn;

  v_order_id := 'ord_' || substr(md5(gen_random_uuid()::text), 1, 10);

  insert into orders (order_id, customer_id, isbn, quantity, order_status)
  values (v_order_id, p_customer_id, p_isbn, p_quantity, 'preorder');

  return v_order_id;
end;
$$;

-- Only the server (service role) may call this — deliberately NOT
-- granted to anon, so the client can never bypass execute-tool/route.ts.
revoke execute on function create_preorder(text, text, integer) from public;

-- ---------------------------------------------------------------------
-- get_loyalty_balance — read-only, but customers is not anon-selectable,
-- so this function is the access path. Safe for anon: only returns the
-- single balance for a customer_id the caller already has to supply.
-- ---------------------------------------------------------------------
create or replace function get_loyalty_balance(p_customer_id text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select reward_points from customers where customer_id = p_customer_id;
$$;
grant execute on function get_loyalty_balance(text) to anon;

-- ---------------------------------------------------------------------
-- check_order_status — same reasoning as get_loyalty_balance: requires
-- the exact order_id, so it's safe to expose without a broad orders SELECT.
-- ---------------------------------------------------------------------
create or replace function check_order_status(p_order_id text)
returns order_status
language sql
security definer
set search_path = public
stable
as $$
  select order_status from orders where order_id = p_order_id;
$$;
grant execute on function check_order_status(text) to anon;

-- ---------------------------------------------------------------------
-- fetch_pending_preorders — Product B (staff dashboard) reads this.
--
-- TODO / OPEN DECISION, deliberately not resolved by this migration:
-- the original planning docs never defined a staff-vs-customer auth
-- role, so this function is currently granted to `anon` like the others,
-- which means ANY visitor with the public anon key could technically
-- call it and see the pending pre-order queue. That's fine for a class
-- project demo but is a real gap before this becomes a real store's
-- staff dashboard. Fix: add Supabase Auth with a `staff` role/claim, and
-- change the grant below from `anon` to that role once it exists. Flag
-- this to the team rather than silently shipping it as anon-readable.
-- ---------------------------------------------------------------------
create or replace function fetch_pending_preorders()
returns setof orders
language sql
security definer
set search_path = public
stable
as $$
  select * from orders where order_status = 'preorder';
$$;
grant execute on function fetch_pending_preorders() to anon; -- see TODO above
