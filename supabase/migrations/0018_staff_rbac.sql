-- 0018_staff_rbac.sql
--
-- Closes the gap tracked since 0002/0003/0007/0012 and called out
-- explicitly in TODOS.md ("Build a real staff Supabase Auth role/claim
-- system"): every staff-only RLS policy so far has scoped to the
-- Postgres `authenticated` role, not to staff specifically — any
-- customer account (once real customer auth exists) would inherit
-- staff-only INSERT/SELECT access just by being signed in. This adds an
-- actual role/claim and re-scopes those policies to it.
--
-- Not reinventing password hashing or session tokens — Supabase Auth
-- (GoTrue) already hashes credentials and issues JWT-based sessions via
-- supabase.auth.signInWithPassword, which is what signInAction already
-- uses. What's newly enforced here is *authorization*: which
-- authenticated principals are staff.

-- ---------------------------------------------------------------------
-- staff_users — the staff roster. Deliberately locked to service_role
-- only: no anon/authenticated SELECT or INSERT policy at all, so a
-- signed-in customer session can't read who's on staff or (worse) add
-- themselves to it. Roster changes are an operator action (see the
-- backfill note below), not a self-service flow.
-- ---------------------------------------------------------------------
create table staff_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table staff_users enable row level security;
-- No grants to anon/authenticated at all — service_role bypasses RLS
-- entirely already, and no policy means no other role can touch this
-- table under any circumstance.

-- ---------------------------------------------------------------------
-- is_staff() — the one check every staff-scoped policy below calls.
-- SECURITY DEFINER so it can read staff_users despite that table having
-- no policy granting the caller's own role access; auth.uid() is
-- supplied by Supabase's JWT verification, not caller input, so this
-- can't be spoofed the way a plain "pass your own id" RPC could be.
-- ---------------------------------------------------------------------
create or replace function is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from staff_users where user_id = auth.uid());
$$;

revoke execute on function is_staff() from public;
grant execute on function is_staff() to authenticated;

-- ---------------------------------------------------------------------
-- Re-scope the staff-only policies from 0003/0007/0009/0012's
-- companion (merchandise insert) from "authenticated" to "is_staff()".
-- Same USING/WITH CHECK shape as before, just gated tighter.
-- ---------------------------------------------------------------------
drop policy "authenticated can read pending preorders" on orders;
create policy "staff can read pending preorders"
  on orders for select
  to authenticated
  using (is_staff() and order_status = 'preorder');

drop policy "authenticated can add books" on books;
create policy "staff can add books"
  on books for insert
  to authenticated
  with check (is_staff());

drop policy "authenticated can add merchandise" on merchandise;
create policy "staff can add merchandise"
  on merchandise for insert
  to authenticated
  with check (is_staff());

-- fetch_pending_preorders() (0002, tightened in 0012) is already
-- authenticated-only at the GRANT level; add the same is_staff() check
-- inside the function body so a non-staff authenticated session can't
-- call it directly and bypass the orders policy above.
create or replace function fetch_pending_preorders()
returns setof orders
language sql
security definer
set search_path = public
stable
as $$
  select * from orders where order_status = 'preorder' and is_staff();
$$;

-- ---------------------------------------------------------------------
-- Roster backfill: this migration cannot know the existing staff
-- account's auth.users.id (it's data, not schema). Run
-- scripts/backfill-staff-roster.mjs once, right after this migration is
-- pushed, to add the already-existing staff account to staff_users —
-- without that step, the current staff login can authenticate but every
-- staff-only action above starts rejecting it.
-- ---------------------------------------------------------------------
