-- 0038_clear_placeholder_stock_photos.sql
--
-- ISSUE-005. author_events.image_url and merchandise.image_url were
-- seeded (0017 / 0020 / 0025 / 0027 / 0028 / 0029) with deterministic but
-- content-unrelated https://picsum.photos/seed/... stock photos — a
-- greeting-card thumbnail is a pineapple, the Kazuo Ishiguro event hero
-- is a van in a desert. They render across Product A (cards, drawer,
-- event detail hero) and Product B's Merchandise Stock tab.
--
-- Null the picsum rows so the branded typographic placeholder shows
-- instead (components/card-image.tsx; the event detail hero now routes
-- through CardImage too). Real staff-entered URLs — anything not on
-- picsum.photos — are left untouched. When real per-item art exists, a
-- later migration can set it.

begin;

update author_events
   set image_url = null
 where image_url like 'https://picsum.photos/%';

update merchandise
   set image_url = null
 where image_url like 'https://picsum.photos/%';

commit;
