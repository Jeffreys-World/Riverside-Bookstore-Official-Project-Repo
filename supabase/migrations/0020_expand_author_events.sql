-- 0020_expand_author_events.sql
--
-- Events was still sitting at 0017's 5-row seed. Adds 5 more fictional
-- events tied to authors newly added in 0019, so Events reads as an
-- ongoing calendar rather than a handful of one-off rows. Same pattern as
-- 0015/0017: fictional event framing around a real author/book, deterministic
-- Picsum banner images (not real photos of the named authors — see 0017's
-- reasoning), dates in the near future relative to this migration.

insert into author_events (isbn, event_title, author_name, event_description, author_event_at, location, image_url)
values
  (
    '9781250080400',
    'Kristin Hannah: War, Sisters, and Survival',
    'Kristin Hannah',
    'A talk on researching and writing The Nightingale, followed by audience questions and a signing.',
    '2026-10-24T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-hannah/800/450'
  ),
  (
    '9781594634024',
    'A Thriller Night with Paula Hawkins',
    'Paula Hawkins',
    'An evening on plotting psychological suspense and unreliable narrators, with a reading from The Girl on the Train.',
    '2026-11-07T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-hawkins/800/450'
  ),
  (
    '9780307588371',
    'Gillian Flynn on Writing Unreliable Narrators',
    'Gillian Flynn',
    'A craft conversation on Gone Girl''s dual narration, followed by a moderated Q&A and signing.',
    '2026-11-14T18:30:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-flynn/800/450'
  ),
  (
    '9780735219090',
    'Delia Owens: Nature, Mystery, and the Marsh',
    'Delia Owens',
    'A reading and discussion of Where the Crawdads Sing''s North Carolina coastal setting, with time for audience questions.',
    '2026-11-21T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-owens/800/450'
  ),
  (
    '9781250301697',
    'Alex Michaelides: The Making of a Psychological Thriller',
    'Alex Michaelides',
    'A behind-the-scenes look at plotting The Silent Patient''s twist, followed by audience questions and a signing.',
    '2026-12-05T19:00:00-04:00',
    '47-10 Austell Place, 2nd Floor, Long Island City, NY 11101',
    'https://picsum.photos/seed/riverside-michaelides/800/450'
  );
