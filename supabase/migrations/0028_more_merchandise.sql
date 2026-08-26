-- 0028_more_merchandise.sql
--
-- Six more curated cards/gifts per request, bringing Merchandise to 26.
-- Same hand-curated approach as 0009/0021 (see that migration's comment
-- on why no external API fits a browse-only, no-checkout catalog).

insert into merchandise (item_name, category, price, stock_quantity, image_url)
values
  ('Blank Greeting Card — Anniversary', 'card', 4.50, 25, 'https://picsum.photos/seed/riverside-merch-card-anniversary/600/600'),
  ('Blank Greeting Card — Wedding', 'card', 4.50, 20, 'https://picsum.photos/seed/riverside-merch-card-wedding/600/600'),
  ('Blank Greeting Card — Retirement', 'card', 4.50, 18, 'https://picsum.photos/seed/riverside-merch-card-retirement/600/600'),
  ('Wooden Bookend Set', 'gift', 22.00, 10, 'https://picsum.photos/seed/riverside-merch-bookends/600/600'),
  ('Tea Sampler — Reading Nook Blend', 'gift', 13.00, 15, 'https://picsum.photos/seed/riverside-merch-tea/600/600'),
  ('Canvas Zip Pouch — Book Lover', 'gift', 9.50, 18, 'https://picsum.photos/seed/riverside-merch-zippouch/600/600')
on conflict (item_name) do nothing;
