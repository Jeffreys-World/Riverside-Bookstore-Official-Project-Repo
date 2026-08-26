-- 0015_events_details_and_rsvp.sql
--
-- The Events feature needed two things author_events didn't have: a
-- distinct author_name (event_title alone doesn't cleanly separate "An
-- Evening With..." framing from the actual name), and a location (every
-- event today is implicitly in-store, but the field should exist rather
-- than being hardcoded in the UI — a future off-site event is a realistic
-- case this schema should already support).
--
-- Also wires up event_tickets — it's existed since 0001_initial_schema.sql
-- (CLAUDE.md's data contract lists the tkt_XXXXX format) but nothing ever
-- read or wrote it. RSVP mints a real ticket through it now, same
-- SECURITY DEFINER pattern as create_preorder/create_customer.

alter table author_events
  add column author_name text,
  add column location text not null default '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101';

-- One RSVP per customer per event — without this, a double-click or a
-- retried request mints a second ticket for the same seat.
alter table event_tickets
  add constraint event_tickets_customer_event_unique unique (customer_id, event_id);

-- ---------------------------------------------------------------------
-- create_event_ticket — idempotent RSVP: if this customer already has a
-- ticket for this event, return the existing ticket_id instead of
-- raising a unique-violation, since "RSVP again" isn't a meaningful
-- error to a customer clicking the button twice.
-- ---------------------------------------------------------------------
create or replace function create_event_ticket(
  p_customer_id text,
  p_event_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id text;
begin
  select ticket_id into v_ticket_id
  from event_tickets
  where customer_id = p_customer_id and event_id = p_event_id;

  if v_ticket_id is not null then
    return v_ticket_id;
  end if;

  v_ticket_id := 'tkt_' || substr(md5(gen_random_uuid()::text), 1, 10);

  insert into event_tickets (ticket_id, customer_id, event_id)
  values (v_ticket_id, p_customer_id, p_event_id);

  return v_ticket_id;
end;
$$;

revoke execute on function create_event_ticket(text, uuid) from public;
revoke execute on function create_event_ticket(text, uuid) from anon;
revoke execute on function create_event_ticket(text, uuid) from authenticated;

-- ---------------------------------------------------------------------
-- get_event_ticket — read-only, anon-safe by the same reasoning as
-- get_loyalty_balance: the caller must already supply the exact
-- customer_id AND event_id, so this can't be used to enumerate anyone
-- else's RSVPs.
-- ---------------------------------------------------------------------
create or replace function get_event_ticket(p_customer_id text, p_event_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select ticket_id from event_tickets where customer_id = p_customer_id and event_id = p_event_id;
$$;

grant execute on function get_event_ticket(text, uuid) to anon;

-- ---------------------------------------------------------------------
-- Seed a few fictional NYC author events so the feature demos with real
-- content instead of an empty state. Dates are relative to this
-- migration's write date (2026-08-26) — all in the near future.
-- ---------------------------------------------------------------------
insert into author_events (isbn, event_title, author_name, event_description, author_event_at, location)
values
  (
    '9780593135204',
    'An Evening with Kazuo Ishiguro',
    'Kazuo Ishiguro',
    'Join us for a reading and Q&A with the Nobel laureate on the ideas behind Klara and the Sun — memory, love, and what it means to be human. Books available for signing.',
    '2026-09-12T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101'
  ),
  (
    '9780593321447',
    'Gabrielle Zevin: Tomorrow, and Tomorrow, and Tomorrow — One Year Later',
    'Gabrielle Zevin',
    'A conversation on friendship, games, and grief, followed by audience questions. Doors open 30 minutes before start.',
    '2026-09-20T18:30:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101'
  ),
  (
    null,
    'NYC Debut Novelists Panel',
    'Various Authors',
    'Four debut novelists from the New York area read short excerpts and discuss breaking into publishing. Co-hosted with the Queens Borough Public Library.',
    '2026-10-03T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101'
  );
