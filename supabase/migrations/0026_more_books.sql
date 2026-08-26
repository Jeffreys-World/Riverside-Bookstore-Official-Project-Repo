-- 0026_more_books.sql
--
-- Two more real, well-known titles per request, bringing the catalog to
-- 28. cover_url/description left null on purpose, same as 0019 — filled
-- by scripts/backfill-book-covers.mjs after `supabase db push`.

insert into books (isbn, book_title, author_name, stock_quantity, reorder_threshold, price)
values
  ('9781594631931', 'The Kite Runner', 'Khaled Hosseini', 14, 5, 16.99),
  ('9780735224315', 'Little Fires Everywhere', 'Celeste Ng', 11, 5, 17.00)
on conflict (isbn) do nothing;
