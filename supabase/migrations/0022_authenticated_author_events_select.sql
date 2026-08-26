-- 0022_authenticated_author_events_select.sql
--
-- Same gap 0006 fixed for `books`: 0002 only granted SELECT + a policy on
-- author_events to `anon`. Any signed-in session (customer or staff — the
-- Postgres role becomes `authenticated`, not `anon`) had no grant and no
-- matching policy, so every read of author_events silently returned zero
-- rows (RLS filters rows for a role with no applicable policy; it doesn't
-- error), and the Events page showed "No upcoming events" even with a
-- full calendar.
--
-- author_events is public/non-sensitive catalog data (0002's own
-- reasoning), so this mirrors the anon policy exactly.

grant select on author_events to authenticated;

create policy "authenticated can read author_events"
  on author_events for select
  to authenticated
  using (true);
