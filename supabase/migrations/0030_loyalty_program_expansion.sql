-- 0030_loyalty_program_expansion.sql
--
-- Expands the loyalty program past a flat +1 point per pre-order (which
-- didn't scale with what was actually spent) into three pieces:
--
-- 1. Dollar-based earning: create_preorder now awards floor(price *
--    quantity) points instead of a flat 1, so a $28 hardcover earns more
--    than a $9 paperback. Reward tiers themselves (100/250/500/1000
--    points) are informational only — types/schema.ts's REWARD_TIERS,
--    shown on the account page — redemption happens in-store/manually,
--    matching this app's pay-in-person-at-pickup model; there's no
--    voucher/discount-code system to build against.
--
-- 2. redeem_blind_date(): spends 250 points (the same tier that would
--    otherwise unlock a free ARC + tote — a mystery book is a comparable
--    value) on a random in-stock title, minted as a real preorder so it
--    shows up in Product B's pending queue like any other order.
--
-- 3. donate_points(): symbolic-only "donate points to a literacy program"
--    gesture — no real charity is on the other end of this (same
--    fictional-flavor status as STORE_HOURS/STORE_CONTACT), but it's
--    logged in a real table rather than just silently zeroing the
--    balance, so the UI can show a genuine confirmation/history.

create or replace function create_preorder(
  p_customer_id text,
  p_isbn text,
  p_quantity integer,
  p_pickup_date date default null,
  p_pickup_window text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_price numeric(10,2);
  v_order_id text;
  v_points_earned integer;
begin
  select stock_quantity, price into v_stock, v_price
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

  insert into orders (order_id, customer_id, isbn, quantity, order_status, pickup_date, pickup_window)
  values (v_order_id, p_customer_id, p_isbn, p_quantity, 'preorder', p_pickup_date, p_pickup_window);

  -- $1 spent = 1 point, rounded down — a partial dollar shouldn't round up
  -- in the customer's favor.
  v_points_earned := floor(coalesce(v_price, 0) * p_quantity)::integer;
  update customers set reward_points = reward_points + v_points_earned where customer_id = p_customer_id;

  return v_order_id;
end;
$$;

revoke execute on function create_preorder(text, text, integer, date, text) from public;
revoke execute on function create_preorder(text, text, integer, date, text) from anon;
revoke execute on function create_preorder(text, text, integer, date, text) from authenticated;

-- ---------------------------------------------------------------------
-- redeem_blind_date — mints a real preorder for a random in-stock title,
-- same SECURITY DEFINER + row-locking shape as create_preorder. Not
-- callable by anon/authenticated (same reasoning as create_preorder: the
-- browser never talks to Supabase directly for a points-spending
-- mutation), so it's called from a Server Action via the service-role
-- client.
-- ---------------------------------------------------------------------
create or replace function redeem_blind_date(p_customer_id text)
returns table(order_id text, isbn text, book_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_isbn text;
  v_title text;
  v_order_id text;
begin
  select reward_points into v_points from customers where customer_id = p_customer_id for update;

  if v_points is null then
    raise exception 'CUSTOMER_NOT_FOUND: %', p_customer_id;
  end if;

  if v_points < 250 then
    raise exception 'INSUFFICIENT_POINTS: need 250, have %', v_points;
  end if;

  select b.isbn, b.book_title into v_isbn, v_title
  from books b
  where b.stock_quantity > 0
  order by random()
  limit 1
  for update;

  if v_isbn is null then
    raise exception 'NO_BOOKS_AVAILABLE';
  end if;

  update books set stock_quantity = stock_quantity - 1 where isbn = v_isbn;

  v_order_id := 'ord_' || substr(md5(gen_random_uuid()::text), 1, 10);
  insert into orders (order_id, customer_id, isbn, quantity, order_status)
  values (v_order_id, p_customer_id, v_isbn, 1, 'preorder');

  update customers set reward_points = reward_points - 250 where customer_id = p_customer_id;

  return query select v_order_id, v_isbn, v_title;
end;
$$;

revoke execute on function redeem_blind_date(text) from public;
revoke execute on function redeem_blind_date(text) from anon;
revoke execute on function redeem_blind_date(text) from authenticated;

-- ---------------------------------------------------------------------
-- Point donations — a real log table (not just a silent balance reset)
-- so the account page can show a genuine confirmation. No RLS SELECT
-- policy: same reasoning as customers/orders (0002) — a table-level
-- grant can't distinguish "I know this customer_id" from "scan
-- everyone's donations" — reads go through a SECURITY DEFINER function
-- if ever needed, same as get_customer_orders.
-- ---------------------------------------------------------------------
create table point_donations (
  id             uuid primary key default gen_random_uuid(),
  customer_id    text not null references customers (customer_id) on delete cascade,
  points_donated integer not null check (points_donated > 0),
  donated_at     timestamptz not null default now()
);

alter table point_donations enable row level security;
-- No anon/authenticated grants at all — service_role (used by
-- donate_points below) bypasses RLS, matching customers/orders.

-- ---------------------------------------------------------------------
-- donate_points — donates the customer's *entire current balance* (no
-- partial-amount input) to keep the UI a single confirm button rather
-- than an amount field. Returns the amount actually donated so the
-- confirmation message can say a real number.
-- ---------------------------------------------------------------------
create or replace function donate_points(p_customer_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
begin
  select reward_points into v_points from customers where customer_id = p_customer_id for update;

  if v_points is null then
    raise exception 'CUSTOMER_NOT_FOUND: %', p_customer_id;
  end if;

  if v_points <= 0 then
    raise exception 'NO_POINTS_TO_DONATE';
  end if;

  update customers set reward_points = 0 where customer_id = p_customer_id;
  insert into point_donations (customer_id, points_donated) values (p_customer_id, v_points);

  return v_points;
end;
$$;

revoke execute on function donate_points(text) from public;
revoke execute on function donate_points(text) from anon;
revoke execute on function donate_points(text) from authenticated;
