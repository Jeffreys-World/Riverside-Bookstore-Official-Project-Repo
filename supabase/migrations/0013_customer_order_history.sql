-- 0013_customer_order_history.sql
--
-- Product A's new "My Account" page needs a customer's own order history,
-- not just the pending-preorder queue Product B reads. `orders` has no
-- anon SELECT policy (see 0002's own reasoning: a table-level grant can't
-- distinguish "I already know this specific customer_id" from "let me
-- scan every order"), so this follows the same SECURITY DEFINER pattern
-- as get_loyalty_balance/check_order_status: safe to expose because the
-- caller must already supply the exact customer_id, same as a receipt or
-- loyalty-card number.

create or replace function get_customer_orders(p_customer_id text)
returns setof orders
language sql
security definer
set search_path = public
stable
as $$
  select * from orders where customer_id = p_customer_id order by created_at desc;
$$;

grant execute on function get_customer_orders(text) to anon;
