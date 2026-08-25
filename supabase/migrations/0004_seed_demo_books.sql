-- 0004_seed_demo_books.sql
--
-- Demo catalog data for exercising the Product A + B live-sync loop
-- end-to-end. Covers all four StockStatus values (lib/inventory.ts) so the
-- dashboard's severity sort and Product A's out-of-stock disable state are
-- both visible without hand-editing data first. Idempotent so re-running
-- migrations locally doesn't fail on a second apply.

insert into books (isbn, book_title, author_name, stock_quantity, reorder_threshold)
values
  ('9780143127550', 'The Song of Achilles', 'Madeline Miller', 12, 5),
  ('9780062316097', 'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 3, 5),
  ('9780525559474', 'The Midnight Library', 'Matt Haig', 0, 5),
  ('9780735211292', 'Atomic Habits', 'James Clear', null, 5),
  ('9780593135204', 'Klara and the Sun', 'Kazuo Ishiguro', 20, 5),
  ('9781984801258', 'The Vanishing Half', 'Brit Bennett', 5, 5)
on conflict (isbn) do nothing;

insert into customers (customer_id, signup_date, reward_points)
values ('cust_demo01', current_date, 0)
on conflict (customer_id) do nothing;
