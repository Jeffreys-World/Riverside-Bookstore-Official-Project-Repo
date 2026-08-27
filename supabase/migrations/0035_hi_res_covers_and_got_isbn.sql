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
--    key with no ON UPDATE CASCADE, and `author_events.isbn` has one row
--    pointing at it (0027's "World-Building with George R.R. Martin"), so
--    that FK is dropped and remade around the update. No orders reference
--    it.
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
-- Drop whatever FK sits on author_events.isbn by name (inline FKs are
-- auto-named author_events_isbn_fkey, but look it up so this can't drift).
do $$
declare
  v_con text;
begin
  select con.conname into v_con
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
   where rel.relname = 'author_events'
     and con.contype = 'f'
     and con.conkey = array[
       (select attnum from pg_attribute
         where attrelid = 'author_events'::regclass and attname = 'isbn')
     ];
  if v_con is not null then
    execute format('alter table author_events drop constraint %I', v_con);
  end if;
end $$;

update books
   set isbn = '9780553386790',
       cover_url = 'https://books.google.com/books/content?id=hXNvadj27ekC&printsec=frontcover&img=1&zoom=1&w=800&source=gbs_api'
 where isbn = '9780553380163';

update author_events
   set isbn = '9780553386790'
 where isbn = '9780553380163';

alter table author_events
  add constraint author_events_isbn_fkey
  foreign key (isbn) references books (isbn) on delete set null;

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
