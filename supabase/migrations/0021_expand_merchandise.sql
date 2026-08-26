-- 0021_expand_merchandise.sql
--
-- Merchandise was still sitting at 0009's original 6 rows. Note on scope:
-- "gift cards" here means the brief's card/gift retail merchandise
-- (`merchandise.category` = 'card' | 'gift' — greeting cards and small
-- gifts), NOT stored-value payment gift cards. A real gift-card processor
-- (Square, Stripe Issuing, Tremendous) would need a merchant account and
-- pulls this into real payment processing, which CLAUDE.md's data
-- contract explicitly rules out for this project (price is display-only;
-- pre-orders stay pay-in-person). So this is hand-curated catalog data,
-- same as 0009 — no external API fits a browse-only, no-checkout catalog.

insert into merchandise (item_name, category, price, stock_quantity)
values
  ('Blank Greeting Card — Congratulations', 'card', 4.50, 30),
  ('Blank Greeting Card — Sympathy', 'card', 4.50, 20),
  ('Blank Greeting Card — New Baby', 'card', 4.50, 25),
  ('Blank Greeting Card — Get Well Soon', 'card', 4.50, 25),
  ('Literary Quote Postcard Set (10-pack)', 'card', 9.00, 18),
  ('Author-Signed Bookplate Set', 'card', 7.50, 12),
  ('Reader''s Journal — Hardcover', 'gift', 18.00, 15),
  ('Ceramic "Book Nook" Mug', 'gift', 12.50, 22),
  ('Leather Bookmark — Embossed', 'gift', 10.00, 30),
  ('Cozy Reading Socks', 'gift', 11.00, 20),
  ('Scented Soy Candle — Rainy Day Pages', 'gift', 16.00, 10),
  ('Canvas Book Sleeve', 'gift', 15.00, 18),
  ('Puzzle — Classic Book Covers (500pc)', 'gift', 19.00, 8),
  ('Enamel Pin — "I''d Rather Be Reading"', 'gift', 9.00, 0)
on conflict (item_name) do nothing;
