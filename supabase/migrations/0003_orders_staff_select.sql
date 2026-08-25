-- 0003_orders_staff_select.sql
--
-- Product B (staff dashboard) needs to read the pending pre-order queue via
-- Supabase Realtime, not just the one-shot fetch_pending_preorders() RPC.
-- Realtime's postgres_changes stream is authorized through the same RLS
-- SELECT policy as a direct table read — a SECURITY DEFINER function does
-- NOT satisfy that, since Realtime never calls it. Without a real SELECT
-- policy on `orders`, no INSERT into orders can ever reach a subscribed
-- client, no matter what fetch_pending_preorders() returns on demand.
--
-- Scope: `authenticated` only, and only preorder rows. This is the seeded-
-- staff-user phase (see TODOS.md — a real staff role/claim is deferred).
-- `anon` stays fully blocked on `orders`, same as before this migration.

grant select on orders to authenticated;

create policy "authenticated can read pending preorders"
  on orders for select
  to authenticated
  using (order_status = 'preorder');

-- ---------------------------------------------------------------------
-- Realtime: add orders and books to the publication so postgres_changes
-- can stream INSERT (orders) and UPDATE (books.stock_quantity) events.
-- REPLICA IDENTITY FULL on books is required for UPDATE events to carry
-- the changed columns (stock_quantity) — default replica identity only
-- includes the primary key (isbn), which is useless for a stock-level UI.
-- orders doesn't need FULL: only INSERT is consumed on that table, and
-- INSERT payloads already carry every column regardless of replica identity.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table books;
alter table books replica identity full;
