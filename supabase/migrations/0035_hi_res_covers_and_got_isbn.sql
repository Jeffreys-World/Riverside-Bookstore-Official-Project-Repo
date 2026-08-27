-- 0035_hi_res_covers_and_got_isbn.sql
--
-- Two catalog data fixes from a 2026-08-27 cover audit, plus a blanket
-- image-resolution bump.
--
-- 1. "A Game of Thrones" (seeded in 0019) carried ISBN 9780553380163,
--    which actually belongs to "A Brief History of Time" (Bantam) — so
--    every cover source (Google Books, Open Library) resolved it to a
--    Stephen Hawking cover. Corrected to 9780553386790 (the HBO tie-in
--    edition, matching the new cover art). `books.isbn` is the primary
--    key with no ON UPDATE CASCADE, and both `author_events.isbn` (0027's
--    "World-Building with George R.R. Martin") and `orders.isbn` (a real
--    pre-order) reference it, so both FKs are dropped, all three tables
--    updated, and both FKs remade.
--
-- 2. "Sapiens" had Google Books' "cover to be revealed" placeholder image
--    (volume id ibALnwEACAAJ). Repointed to a real edition (zfuOEAAAQBAJ).
--
-- 3. Every Google Books cover_url was a 128px-wide thumbnail (&zoom=1).
--    Google's content endpoint honours &w=; &w=800 serves the same cover
--    at up to ~800px (editions with a full preview) or ~300px (catalog-
--    only editions) — 2-6x sharper on the redesigned cards, same image.
--    The decorative &edge=curl page-curl is dropped at the same time.

begin;

-- 1. Game of Thrones ISBN correction -------------------------------------
-- Drop every FK that targets books.isbn (author_events.isbn + orders.isbn),
-- looked up by target so the names can't drift, then remake both.
do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
      from pg_constraint
     where contype = 'f' and confrelid = 'books'::regclass
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

update books
   set isbn = '9780553386790',
       cover_url = 'https://books.google.com/books/content?id=hXNvadj27ekC&printsec=frontcover&img=1&zoom=1&w=800&source=gbs_api'
 where isbn = '9780553380163';

update author_events set isbn = '9780553386790' where isbn = '9780553380163';
update orders        set isbn = '9780553386790' where isbn = '9780553380163';

alter table author_events
  add constraint author_events_isbn_fkey
  foreign key (isbn) references books (isbn) on delete set null;

alter table orders
  add constraint orders_isbn_fkey
  foreign key (isbn) references books (isbn);

-- 2. Sapiens real cover -------------------------------------------------
update books
   set cover_url = 'https://books.google.com/books/content?id=zfuOEAAAQBAJ&printsec=frontcover&img=1&zoom=1&w=800&source=gbs_api'
 where isbn = '9780062316097';

-- 3. Hi-res upgrade for every remaining Google Books thumbnail ---------
update books
   set cover_url = replace(replace(cover_url, '&edge=curl', ''), 'zoom=1', 'zoom=1&w=800')
 where cover_url like 'https://books.google.com/books/content%'
   and cover_url not like '%&w=800%';

commit;
