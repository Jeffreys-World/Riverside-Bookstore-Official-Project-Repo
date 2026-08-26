-- 0016_book_author_bio.sql
--
-- Adds a distinct author_bio field, separate from books.description (the
-- book's own summary). Staff-entered only — Google Books' volumeInfo has
-- no per-author bio field, so unlike cover_url/description this can't be
-- auto-backfilled by fetchBookMetadata(). Nullable: existing rows and any
-- book added without one render with no author bio section, same pattern
-- as description/cover_url being null before 0005 backfilled them.

alter table books
  add column author_bio text;
