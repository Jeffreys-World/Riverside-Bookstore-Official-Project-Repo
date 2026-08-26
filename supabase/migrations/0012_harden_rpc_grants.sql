-- 0012_harden_rpc_grants.sql
--
-- Two RPC-privilege gaps found in the 2026-08-26 pain-point review:
--
-- 1. fetch_pending_preorders() was `grant execute ... to anon` (0002's own
--    inline comment flagged this as a deliberately-deferred gap) — anyone
--    holding the public anon key could call this RPC directly and read
--    the full pending-order queue (customer_id, isbn, quantity),
--    completely bypassing Product B's sign-in gate. Product B's dashboard
--    never actually calls this function — it reads `orders` directly
--    under authenticated-only RLS (see 0003_orders_staff_select.sql) — so
--    this grant was pure attack surface with no legitimate anon caller.
--
-- 2. create_preorder() and create_customer() each rely on a bare
--    `revoke ... from public`. The review flagged that this may not be
--    sufficient on its own: a Supabase project's default
--    `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon,
--    authenticated` (applied at project setup, outside these migration
--    files) grants EXECUTE directly to those roles — a plain
--    REVOKE FROM PUBLIC does not undo a separate grant made to a named
--    role. Revoking explicitly from anon and authenticated closes that
--    gap regardless of what the live project's default turns out to be.

revoke execute on function fetch_pending_preorders() from public, anon;
grant execute on function fetch_pending_preorders() to authenticated;

revoke execute on function create_preorder(text, text, integer) from public, anon, authenticated;
revoke execute on function create_customer() from public, anon, authenticated;
