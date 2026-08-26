-- 0008_add_book_price.sql
--
-- Adds `price` to `books`. The shared schema never had a pricing field at
-- all — flagged 2026-08-26 while auditing catalog completeness against the
-- brief's business description ("sells new books... paid at the point of
-- sale, either online for a pre-order or in person at checkout").
--
-- Display-only for now: there is no checkout/payment flow (pre-orders are
-- pay-in-person-at-pickup per the brief), so this doesn't touch
-- create_preorder() or orders. Not part of CLAUDE.md's strict data
-- contract's original field list, but that file's own header says new
-- fields belong here as their own commit — added to the contract doc too.

alter table books
  add column price numeric(10,2) not null default 0 check (price >= 0);

update books set price = 18.00 where isbn = '9780143127550'; -- The Song of Achilles
update books set price = 22.00 where isbn = '9780062316097'; -- Sapiens
update books set price = 16.99 where isbn = '9780525559474'; -- The Midnight Library
update books set price = 17.00 where isbn = '9780735211292'; -- Atomic Habits
update books set price = 28.00 where isbn = '9780593135204'; -- Klara and the Sun
update books set price = 17.99 where isbn = '9781984801258'; -- The Vanishing Half
