-- 0005_add_book_metadata.sql
--
-- Adds cover image and description columns to books, populated from the
-- Google Books API (see lib/google-books.ts + scripts/backfill-book-covers.mjs).
-- Both nullable: a title with no match in Google Books (or not yet
-- backfilled) must render with a placeholder, never a broken image or
-- empty crash — same "null is a valid state" pattern as stock_quantity.

alter table books
  add column cover_url   text,
  add column description text;
