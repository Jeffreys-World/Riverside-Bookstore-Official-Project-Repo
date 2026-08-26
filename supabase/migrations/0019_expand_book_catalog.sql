-- 0019_expand_book_catalog.sql
--
-- The demo catalog only ever had 0004's original 6 titles (plus 2 added
-- by hand through Product B). That's too thin to demo Product A's search
-- or Product B's inventory dashboard as more than a toy list. Adds 19 more
-- real, well-known titles across genres.
--
-- cover_url/description are left null here on purpose, same as 0004 —
-- they're populated by scripts/backfill-book-covers.mjs (Google Books,
-- with an Open Library fallback as of this same change) rather than
-- guessed at in a migration. Run that script after `supabase db push`.

insert into books (isbn, book_title, author_name, stock_quantity, reorder_threshold)
values
  ('9780061120084', 'To Kill a Mockingbird', 'Harper Lee', 15, 5),
  ('9780451524935', '1984', 'George Orwell', 22, 5),
  ('9780141439518', 'Pride and Prejudice', 'Jane Austen', 9, 5),
  ('9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald', 14, 5),
  ('9780316769488', 'The Catcher in the Rye', 'J.D. Salinger', 7, 5),
  ('9780439023528', 'The Hunger Games', 'Suzanne Collins', 18, 5),
  ('9780345391803', 'The Hitchhiker''s Guide to the Galaxy', 'Douglas Adams', 6, 5),
  ('9780553380163', 'A Game of Thrones', 'George R.R. Martin', 11, 5),
  ('9781451673319', 'Fahrenheit 451', 'Ray Bradbury', 0, 5),
  ('9780060850524', 'Brave New World', 'Aldous Huxley', 13, 5),
  ('9780062315007', 'The Alchemist', 'Paulo Coelho', 20, 5),
  ('9780735219090', 'Where the Crawdads Sing', 'Delia Owens', 4, 5),
  ('9780399590504', 'Educated', 'Tara Westover', 10, 5),
  ('9781524763138', 'Becoming', 'Michelle Obama', 16, 5),
  ('9781250301697', 'The Silent Patient', 'Alex Michaelides', 8, 5),
  ('9780307588371', 'Gone Girl', 'Gillian Flynn', null, 5),
  ('9781594634024', 'The Girl on the Train', 'Paula Hawkins', 5, 5),
  ('9781250080400', 'The Nightingale', 'Kristin Hannah', 12, 5),
  ('9780316556347', 'Circe', 'Madeline Miller', 17, 5)
on conflict (isbn) do nothing;
