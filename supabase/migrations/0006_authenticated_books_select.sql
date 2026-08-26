-- 0006_authenticated_books_select.sql
--
-- Product B's "Stock levels" panel reads `books` while signed in, which
-- runs as the `authenticated` Postgres role, not `anon`. 0002 only
-- granted SELECT + a policy to `anon` — an authenticated session had no
-- grant and no matching policy, so every read of `books` silently
-- returned zero rows (the query error itself is swallowed in
-- app/product-b/page.tsx, not surfaced), and the dashboard showed
-- "No titles in the catalog yet." even with a full catalog.
--
-- books is public/non-sensitive catalog data (see 0002's own comment),
-- so this mirrors the anon policy exactly rather than scoping it down.

grant select on books to authenticated;

create policy "authenticated can read books"
  on books for select
  to authenticated
  using (true);
