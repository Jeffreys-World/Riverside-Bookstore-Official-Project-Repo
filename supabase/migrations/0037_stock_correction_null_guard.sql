-- 0037_stock_correction_null_guard.sql
--
-- remove_book_stock / remove_merchandise_stock (0032) did
--   set stock_quantity = greatest(coalesce(stock_quantity, 0) - p_amount, 0)
-- which, for a row whose stock_quantity IS NULL ("not yet inventoried"),
-- writes 0 — silently converting an uninventoried title into "out of
-- stock" everywhere it renders (Product A catalog, the Product C
-- availability wording). That coercion is exactly what CLAUDE.md and
-- 0001/0009 forbid.
--
-- The dashboard disables the Remove control for null-stock rows, so this
-- isn't reachable from the current UI — but Server Actions are POST
-- endpoints, so this is a real hole against a direct call or any future
-- UI change. Only decrement rows that already have a real count; a
-- null-stock row returns no row, and the action surfaces
-- "Couldn't adjust that — it may not be inventoried yet."

begin;

create or replace function remove_book_stock(p_isbn text, p_amount integer)
returns integer
language sql
as $$
  update books
    set stock_quantity = greatest(stock_quantity - p_amount, 0)
    where isbn = p_isbn
      and p_amount > 0
      and stock_quantity is not null
    returning stock_quantity;
$$;

create or replace function remove_merchandise_stock(p_id uuid, p_amount integer)
returns integer
language sql
as $$
  update merchandise
    set stock_quantity = greatest(stock_quantity - p_amount, 0)
    where id = p_id
      and p_amount > 0
      and stock_quantity is not null
    returning stock_quantity;
$$;

commit;
