-- 0007_authenticated_books_insert.sql
--
-- Staff "add book" flow (app/product-b/actions.ts's addBookAction) inserts
-- directly into `books` as the signed-in staff session, same as how
-- 0006 reads it — no SECURITY DEFINER function needed here, unlike
-- create_preorder, because a new ISBN has no concurrent-row race to guard
-- (the isbn primary key already makes a duplicate insert fail atomically).
--
-- Scope: `authenticated` only, matching the seeded-staff-user phase
-- (see TODOS.md — a real staff role/claim is still deferred). `anon`
-- gets no INSERT grant or policy here, same as every other mutation path.

grant insert on books to authenticated;

create policy "authenticated can add books"
  on books for insert
  to authenticated
  with check (true);
