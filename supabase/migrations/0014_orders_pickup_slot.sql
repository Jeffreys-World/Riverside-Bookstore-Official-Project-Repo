-- 0014_orders_pickup_slot.sql
--
-- Adds the checkout page's pickup date + time-window selection to `orders`
-- so staff (Product B) can see when to have an order ready, not just that
-- it exists. Per types/schema.ts's PICKUP_WINDOWS, the window is one of a
-- small fixed set of strings, not a free-form time — enforced with a CHECK
-- constraint kept in sync with that list by hand (there's no shared-enum
-- mechanism between Postgres and the TS constant, same situation as
-- order_status already had before this schema existed).
--
-- Both columns are nullable: existing rows (and any create_preorder caller
-- that doesn't pass them, e.g. the Live API voice kiosk in
-- app/api/live/execute-tool/route.ts) have no pickup slot, which is a
-- valid state, not an error.

alter table orders
  add column pickup_date date,
  add column pickup_window text
    check (pickup_window in ('10:00 AM – 1:00 PM', '1:00 PM – 4:00 PM', '4:00 PM – 6:30 PM'));

-- create_preorder gains two new optional trailing params. Dropped and
-- recreated rather than `create or replace` so the new 5-arg signature is
-- unambiguous — `create or replace` on a changed parameter list is
-- fragile to get right across Postgres versions, and this function's
-- EXECUTE grants (revoked from public/anon/authenticated in
-- 0012_harden_rpc_grants.sql) don't survive a drop, so they're reapplied
-- explicitly below.
drop function if exists create_preorder(text, text, integer);

create function create_preorder(
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

  insert into orders (order_id, customer_id, isbn, quantity, order_status, pickup_date, pickup_window)
  values (v_order_id, p_customer_id, p_isbn, p_quantity, 'preorder', p_pickup_date, p_pickup_window);

  update customers set reward_points = reward_points + 1 where customer_id = p_customer_id;

  return v_order_id;
end;
$$;

revoke execute on function create_preorder(text, text, integer, date, text) from public;
revoke execute on function create_preorder(text, text, integer, date, text) from anon;
revoke execute on function create_preorder(text, text, integer, date, text) from authenticated;
