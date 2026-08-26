-- 0024_brave_new_world_description.sql
--
-- Google Books has no `description` for this ISBN edition of Brave New
-- World (confirmed after several retries across two sessions — a real,
-- persistent gap in that edition's metadata, not a transient error). The
-- Open Library cover fallback (lib/google-books.ts) filled cover_url for
-- it, but there's no equivalent fallback for description text, so this is
-- set by hand rather than left blank.

update books
set description = 'Aldous Huxley''s dystopian vision of a future World State whose citizens are engineered and conditioned from birth into a rigid caste system, kept content through pleasure, distraction, and the drug soma. When a visitor from outside the World State arrives, the cost of that engineered happiness comes into focus.'
where isbn = '9780060850524';
