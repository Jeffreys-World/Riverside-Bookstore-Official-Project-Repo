-- 0031_fix_redeem_blind_date_ambiguous_column.sql
--
-- redeem_blind_date's `returns table(order_id text, isbn text, book_title
-- text)` implicitly declares `isbn` as a PL/pgSQL variable in scope for
-- the whole function body — the bare `where isbn = v_isbn` in the stock
-- update collided with that OUT-parameter variable, not the intended
-- `books.isbn` column ("column reference \"isbn\" is ambiguous"), caught
-- by actually calling the function rather than assumed from reading the
-- SQL. Table-qualifying the column reference resolves it.

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

  update books set stock_quantity = stock_quantity - 1 where books.isbn = v_isbn;

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
