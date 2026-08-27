-- 0034_customer_auth.sql
--
-- Gives Product A real customer accounts (email + password via Supabase
-- Auth), reversing the deliberate 2026-08-26 decision to keep sign-up
-- cosmetic. Until now `customer_id` (cust_XXXXX) doubled as the access
-- token a visitor typed into every form and localStorage remembered it
-- (lib/customer-id-storage.ts). That path stays working — this migration
-- only ADDS an auth-linked identity alongside it, it does not tighten any
-- existing RLS or change any existing RPC. `get_loyalty_balance`,
-- `get_customer_orders`, `create_preorder` etc. keep their `p_customer_id
-- text` signatures untouched (the voice kiosk calls create_preorder
-- server-to-server with no session, so it must stay parameterised).
--
-- Trust model for the new function mirrors is_staff() (0018): it reads
-- auth.uid() / auth.jwt() INTERNALLY rather than taking a caller-supplied
-- id, so it is granted to `authenticated` and called with the normal
-- RLS-scoped server client — never the service-role client, which has no
-- auth.uid() and which lib/supabase-server.ts deliberately keeps off the
-- customer read paths.

-- ---------------------------------------------------------------------
-- Link columns. Both nullable: every existing row (incl. the seeded
-- cust_demo01) stays valid with no backfill. `on delete set null` so
-- deleting an auth user never cascade-deletes order history via the
-- customer_id foreign keys on orders/event_tickets. email is UNIQUE so a
-- delete-then-re-signup can't leave two customer rows claiming the same
-- address.
-- ---------------------------------------------------------------------
alter table customers
  add column auth_user_id uuid unique references auth.users (id) on delete set null,
  add column email        text unique;

-- ---------------------------------------------------------------------
-- get_or_create_my_customer — the one call the web auth flow makes to
-- turn a Supabase Auth session into a customer_id.
--
--   * already linked   -> returns the existing customer_id
--   * p_claim given, and that cust_ id exists and is UNCLAIMED
--                      -> adopts it (links it to this auth user), so a
--                         returning customer keeps their reward_points +
--                         order history instead of starting fresh.
--                         Claiming an unclaimed id is no weaker than the
--                         pre-auth model, where knowing the id WAS the
--                         only credential.
--   * otherwise        -> mints a fresh cust_ id (same shape as
--                         create_customer(), 0010) and links it.
--
-- SECURITY DEFINER + reads auth.uid()/auth.jwt() itself => cannot be
-- spoofed by passing someone else's id, the way a `p_user_id uuid` param
-- could. Staff sessions are refused a customer row outright (the shared
-- session cookie means a signed-in staff member browsing Product A would
-- otherwise auto-mint one under their staff email).
-- ---------------------------------------------------------------------
create or replace function get_or_create_my_customer(p_claim text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_id    text;
begin
  if v_uid is null then
    return null; -- no session
  end if;

  if exists (select 1 from staff_users where user_id = v_uid) then
    return null; -- staff: never mint a customer row for them
  end if;

  select customer_id into v_id from customers where auth_user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  if p_claim is not null and p_claim ~ '^cust_[a-zA-Z0-9]{5,}$' then
    update customers
       set auth_user_id = v_uid,
           email        = coalesce(email, v_email)
     where customer_id = p_claim
       and auth_user_id is null;
    if found then
      return p_claim;
    end if;
  end if;

  v_id := 'cust_' || substr(md5(gen_random_uuid()::text), 1, 8);
  insert into customers (customer_id, signup_date, reward_points, auth_user_id, email)
  values (v_id, current_date, 0, v_uid, v_email)
  on conflict (auth_user_id) do nothing;
  -- re-read: covers the race where a concurrent call for the same uid
  -- inserted first and our insert hit the ON CONFLICT no-op.
  select customer_id into v_id from customers where auth_user_id = v_uid;
  return v_id;
end;
$$;

-- This project's default privileges grant EXECUTE on new functions to
-- anon/authenticated (see 0012's note), so lock it down explicitly, then
-- re-grant only to authenticated — anon has no auth.uid() and no reason
-- to call this.
revoke execute on function get_or_create_my_customer(text) from public, anon;
grant  execute on function get_or_create_my_customer(text) to authenticated;
