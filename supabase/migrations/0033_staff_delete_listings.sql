-- 0033_staff_delete_listings.sql
--
-- "Remove stock" (0032) only ever decrements stock_quantity — right for
-- walking back a typo'd count, wrong for a genuinely bad listing (e.g. a
-- duplicate book entered twice with the wrong price). Zeroing the count
-- still leaves it visible on Product A as an "Ask a bookseller" card with
-- the wrong price, which is exactly the complaint that prompted this:
-- staff need to take a bad listing off the site entirely, not just mark
-- it out of stock. Adds a staff-scoped DELETE policy (same is_staff()
-- gate as every other staff-only policy) — deleting a book with real
-- order history still fails on the `orders.isbn references books`
-- foreign key (0001, no ON DELETE clause), which is the right outcome:
-- order history must never silently lose its book reference. Product A's
-- catalog page is `force-dynamic` (queries fresh on every load), so a
-- deleted row simply stops appearing there — no cache to invalidate.
--
-- Also closes a real gap found while wiring this up: `merchandise` was
-- never added to the supabase_realtime publication (0003 only added
-- `orders`/`books`), so Product B's merchandise-stock subscription has
-- been silently inert since 0009 — subscribing successfully but never
-- receiving a single event. A delete needs to broadcast live to any
-- other open staff session the same way an insert/update already does.

create policy "staff can delete books"
  on books for delete
  to authenticated
  using (is_staff());

create policy "staff can delete merchandise"
  on merchandise for delete
  to authenticated
  using (is_staff());

alter publication supabase_realtime add table merchandise;
alter table merchandise replica identity full;
