-- 0017_events_images.sql
--
-- Adds image_url to author_events (list/detail pages had no visual until
-- now) and two more seeded events, so Events reads as a fuller calendar
-- rather than the original 3-row seed. Images are deterministic Picsum
-- URLs keyed by event id — a real, stable, hotlinkable asset (same
-- external-hosted-image pattern books.cover_url already uses via Google
-- Books), not a placeholder tag. Picsum photos aren't portraits of the
-- named authors — using a real photo of a real person without their
-- consent for a fictional coursework event isn't something to do even as
-- a demo, so this stays generic event-banner imagery.

alter table author_events
  add column image_url text;

update author_events
  set image_url = 'https://picsum.photos/seed/riverside-ishiguro/800/450'
  where event_title = 'An Evening with Kazuo Ishiguro';

update author_events
  set image_url = 'https://picsum.photos/seed/riverside-zevin/800/450'
  where event_title = 'Gabrielle Zevin: Tomorrow, and Tomorrow, and Tomorrow — One Year Later';

update author_events
  set image_url = 'https://picsum.photos/seed/riverside-debut-panel/800/450'
  where event_title = 'NYC Debut Novelists Panel';

insert into author_events (isbn, event_title, author_name, event_description, author_event_at, location, image_url)
values
  (
    '9780143127550',
    'Madeline Miller: Myth, War, and Rewriting the Classics',
    'Madeline Miller',
    'A talk on retelling ancient epics for modern readers, from The Song of Achilles onward, with time for audience questions. Books available for signing.',
    '2026-09-27T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-miller/800/450'
  ),
  (
    '9781984801258',
    'Brit Bennett in Conversation',
    'Brit Bennett',
    'A craft talk on family, identity, and structure in The Vanishing Half, followed by a moderated Q&A and signing.',
    '2026-10-10T18:30:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-bennett/800/450'
  );
