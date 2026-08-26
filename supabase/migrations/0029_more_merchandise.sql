-- 0029_more_merchandise.sql
--
-- Two more curated cards/gifts per request, bringing Merchandise to 28 —
-- an even count that fills out the grid's last row cleanly. Same
-- hand-curated approach as 0009/0021/0028.

insert into merchandise (item_name, category, price, stock_quantity, image_url)
values
  ('Blank Greeting Card — Housewarming', 'card', 4.50, 20, 'https://picsum.photos/seed/riverside-merch-card-housewarming/600/600'),
  ('Linen Book Tote', 'gift', 17.00, 15, 'https://picsum.photos/seed/riverside-merch-linen-tote/600/600')
on conflict (item_name) do nothing;
