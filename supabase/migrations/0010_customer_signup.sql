-- 0010_customer_signup.sql
--
-- Pain-point review (2026-08-26) finding: there was no way for a real
-- customer to ever get a customer_id — only the one seeded demo row
-- (cust_demo01) existed, so nobody else could place a pre-order at all.
-- create_customer() mints a new cust_XXXXX id and inserts the row,
-- mirroring create_preorder()'s generated-id + SECURITY DEFINER pattern.
--
-- Same access model as create_preorder: NOT granted to anon. Called only
-- from the server (app/product-a/actions.ts's signUpCustomerAction, via
-- getServiceRoleClient()), never directly from the browser with the anon
-- key — keeps every `customers` mutation server-validated, same as every
-- other write path in this schema.

create or replace function create_customer()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id text;
begin
  v_customer_id := 'cust_' || substr(md5(gen_random_uuid()::text), 1, 8);
  insert into customers (customer_id, signup_date, reward_points)
  values (v_customer_id, current_date, 0);
  return v_customer_id;
end;
$$;

revoke execute on function create_customer() from public;
