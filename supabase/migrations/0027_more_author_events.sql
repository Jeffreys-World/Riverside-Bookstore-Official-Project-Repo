-- 0027_more_author_events.sql
--
-- Five more fictional events tied to authors already in the catalog with
-- no event yet, bringing Events to 15. Same pattern as 0015/0017/0020:
-- fictional event framing around a real author/book, deterministic Picsum
-- banner images (not real photos of the named authors), near-future dates.

insert into author_events (isbn, event_title, author_name, event_description, author_event_at, location, image_url)
values
  (
    '9780735211292',
    'Building Better Systems: An Atomic Habits Q&A',
    'James Clear',
    'A talk on habit design and the systems behind lasting change, followed by audience questions and a signing.',
    '2026-12-12T19:00:00-05:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-clear/800/450'
  ),
  (
    '9780062316097',
    'Sapiens: Looking Back to Look Forward',
    'Yuval Noah Harari',
    'A talk on how the history of our species informs the choices ahead, followed by a moderated Q&A.',
    '2026-12-19T19:00:00-05:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-harari/800/450'
  ),
  (
    '9780525559474',
    'An Evening with Matt Haig: Regret, Choice, and The Midnight Library',
    'Matt Haig',
    'A reading and discussion of the paths not taken, followed by audience questions and a signing.',
    '2027-01-09T19:00:00-05:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-haig/800/450'
  ),
  (
    '9780553380163',
    'World-Building with George R.R. Martin',
    'George R.R. Martin',
    'A craft talk on constructing a sprawling fantasy world, followed by a moderated Q&A and signing.',
    '2027-01-16T19:00:00-05:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-martin/800/450'
  ),
  (
    '9781594631931',
    'Khaled Hosseini: Memory and Redemption in The Kite Runner',
    'Khaled Hosseini',
    'A reading and discussion of friendship, guilt, and forgiveness, followed by audience questions and a signing.',
    '2027-01-23T19:00:00-05:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-hosseini/800/450'
  );
