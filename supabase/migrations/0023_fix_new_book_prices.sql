-- 0023_fix_new_book_prices.sql
--
-- 0019_expand_book_catalog.sql inserted 17 books without a `price` value,
-- so they silently took the column's `default 0` (books.price is `not
-- null default 0` per 0008) instead of erroring — caught only when the
-- storefront showed them with no price. Backfilling real retail prices,
-- same one-off manual approach 0008 used for the original 6.

update books set price = 17.00 where isbn = '9780451524935'; -- 1984
update books set price = 20.00 where isbn = '9780553380163'; -- A Game of Thrones
update books set price = 19.99 where isbn = '9781524763138'; -- Becoming
update books set price = 16.00 where isbn = '9780060850524'; -- Brave New World
update books set price = 18.00 where isbn = '9780316556347'; -- Circe
update books set price = 18.00 where isbn = '9780399590504'; -- Educated
update books set price = 16.99 where isbn = '9781451673319'; -- Fahrenheit 451
update books set price = 17.99 where isbn = '9780307588371'; -- Gone Girl
update books set price = 12.00 where isbn = '9780141439518'; -- Pride and Prejudice
update books set price = 16.99 where isbn = '9780062315007'; -- The Alchemist
update books set price = 16.00 where isbn = '9780316769488'; -- The Catcher in the Rye
update books set price = 17.99 where isbn = '9781594634024'; -- The Girl on the Train
update books set price = 15.00 where isbn = '9780743273565'; -- The Great Gatsby
update books set price = 17.00 where isbn = '9780345391803'; -- The Hitchhiker's Guide to the Galaxy
update books set price = 16.99 where isbn = '9780439023528'; -- The Hunger Games
update books set price = 18.00 where isbn = '9781250080400'; -- The Nightingale
update books set price = 17.99 where isbn = '9781250301697'; -- The Silent Patient
