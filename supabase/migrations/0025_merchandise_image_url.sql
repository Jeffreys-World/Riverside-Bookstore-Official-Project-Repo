-- 0025_merchandise_image_url.sql
--
-- Merchandise cards are getting a standardized image header (matching
-- books/events), but merchandise never had an image column at all. Adds
-- it as a staff-entered optional field (same pattern as books.cover_url —
-- no auto-lookup source exists for generic retail merchandise the way
-- Google Books/Open Library exist for ISBNs).
--
-- Backfills the 20 existing rows with deterministic Picsum banners so the
-- catalog isn't half-illustrated while staff fill in real product photos
-- over time — same reasoning as 0017_events_images.sql's image seeding.

alter table merchandise
  add column image_url text;

update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-tote-bag/600/600' where item_name = 'Riverside Books Tote Bag';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-bookmark-pin/600/600' where item_name = 'Enamel Bookmark Pin';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-card-birthday/600/600' where item_name = 'Blank Greeting Card — Birthday';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-card-thankyou/600/600' where item_name = 'Blank Greeting Card — Thank You';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-candle/600/600' where item_name = 'Scented Soy Candle';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-notecards/600/600' where item_name = 'Author-Signed Notecard Set';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-card-congrats/600/600' where item_name = 'Blank Greeting Card — Congratulations';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-card-sympathy/600/600' where item_name = 'Blank Greeting Card — Sympathy';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-card-newbaby/600/600' where item_name = 'Blank Greeting Card — New Baby';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-card-getwell/600/600' where item_name = 'Blank Greeting Card — Get Well Soon';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-postcards/600/600' where item_name = 'Literary Quote Postcard Set (10-pack)';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-journal/600/600' where item_name = 'Reader''s Journal — Hardcover';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-mug/600/600' where item_name = 'Ceramic "Book Nook" Mug';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-bookmark-leather/600/600' where item_name = 'Leather Bookmark — Embossed';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-socks/600/600' where item_name = 'Cozy Reading Socks';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-candle-rainyday/600/600' where item_name = 'Scented Soy Candle — Rainy Day Pages';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-booksleeve/600/600' where item_name = 'Canvas Book Sleeve';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-bookplates/600/600' where item_name = 'Author-Signed Bookplate Set';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-puzzle/600/600' where item_name = 'Puzzle — Classic Book Covers (500pc)';
update merchandise set image_url = 'https://picsum.photos/seed/riverside-merch-pin-reading/600/600' where item_name = 'Enamel Pin — "I''d Rather Be Reading"';
