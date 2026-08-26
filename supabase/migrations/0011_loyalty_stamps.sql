-- 0011_loyalty_stamps.sql
--
-- Wires reward_points into create_preorder(). Pain-point review
-- (2026-08-26) finding: the column was never written anywhere in the
-- codebase — pain point #2 (loyalty) had zero working implementation
-- despite Product A's page literally being titled "Order & Loyalty".
--
-- One stamp per completed pre-order, not per quantity — matches the
-- brief's "earn a stamp toward a loyalty reward with each purchase"
-- framing of a purchase as a single visit/order, not a per-copy count.

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

  update customers set reward_points = reward_points + 1 where customer_id = p_customer_id;

  return v_order_id;
end;
$$;

revoke execute on function create_preorder(text, text, integer) from public;
