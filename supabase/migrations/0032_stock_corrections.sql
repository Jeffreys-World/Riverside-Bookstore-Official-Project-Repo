-- 0032_stock_corrections.sql
--
-- Staff need to walk back a stock_quantity that got typo'd too high on
-- the Add a Book / Add Merchandise forms (e.g. "50" instead of "5") —
-- until now the only thing that ever moved stock_quantity down was a
-- SECURITY DEFINER RPC on the customer side (create_preorder,
-- redeem_blind_date), neither of which staff can call for a manual
-- correction. Adds a staff-scoped UPDATE policy on both books and
-- merchandise (same is_staff() gate as the existing "staff can add..."
-- INSERT policies from 0018) and two invoker-rights functions that
-- decrement atomically and clamp at 0 in the same statement — no
-- read-then-write race against a concurrent pre-order or another staff
-- session's own correction, and stock_quantity can never go negative
-- regardless of how large an amount staff enters.

create policy "staff can update books"
  on books for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create policy "staff can update merchandise"
  on merchandise for update
  to authenticated
  using (is_staff())
  with check (is_staff());

-- No `security definer` — runs as the calling (staff) session, so the
-- policies above are what actually authorizes this, same as the plain
-- `.insert()` addBookAction/addMerchandiseAction already rely on.
create or replace function remove_book_stock(p_isbn text, p_amount integer)
returns integer
language sql
as $$
  update books
    set stock_quantity = greatest(coalesce(stock_quantity, 0) - p_amount, 0)
    where isbn = p_isbn and p_amount > 0
    returning stock_quantity;
$$;

revoke execute on function remove_book_stock(text, integer) from public;
grant execute on function remove_book_stock(text, integer) to authenticated;

create or replace function remove_merchandise_stock(p_id uuid, p_amount integer)
returns integer
language sql
as $$
  update merchandise
    set stock_quantity = greatest(coalesce(stock_quantity, 0) - p_amount, 0)
    where id = p_id and p_amount > 0
    returning stock_quantity;
$$;

revoke execute on function remove_merchandise_stock(uuid, integer) from public;
grant execute on function remove_merchandise_stock(uuid, integer) to authenticated;
