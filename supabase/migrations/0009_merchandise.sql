-- 0009_merchandise.sql
--
-- Cards and small gifts — the brief's business description says the store
-- sells these alongside books, but the schema had only ever modeled
-- `books`. Kept as a separate table (not folded into `books`) because
-- these items have no ISBN, so books' isbn-keyed primary key and the
-- foreign keys that depend on it (orders, author_events) don't apply here.
--
-- RLS mirrors books' shape exactly (0002 + 0006 + 0007 combined into one
-- migration since this table is new): anon and authenticated can SELECT
-- (public catalog data), only authenticated can INSERT (staff-added), no
-- anon/authenticated UPDATE or DELETE.
--
-- Not wired into `orders`/create_preorder() — pre-orders stay book-only,
-- matching the brief ("place a pre-order for pickup" is stated as a books
-- feature for Product A). Cards/gifts are browsed here, not reserved.

create table merchandise (
  id             uuid primary key default gen_random_uuid(),
  item_name      text not null unique check (item_name <> ''),
  category       text not null check (category in ('card', 'gift')),
  price          numeric(10,2) not null check (price >= 0),
  -- Nullable, same "not yet inventoried" meaning as books.stock_quantity —
  -- must never be treated as 0 by application code.
  stock_quantity integer check (stock_quantity >= 0)
);

create index merchandise_stock_idx on merchandise (stock_quantity);

alter table merchandise enable row level security;

grant select on merchandise to anon;
create policy "anon can read merchandise"
  on merchandise for select
  to anon
  using (true);

grant select on merchandise to authenticated;
create policy "authenticated can read merchandise"
  on merchandise for select
  to authenticated
  using (true);

grant insert on merchandise to authenticated;
create policy "authenticated can add merchandise"
  on merchandise for insert
  to authenticated
  with check (true);

insert into merchandise (item_name, category, price, stock_quantity)
values
  ('Riverside Books Tote Bag', 'gift', 14.00, 25),
  ('Enamel Bookmark Pin', 'gift', 8.00, 40),
  ('Blank Greeting Card — Birthday', 'card', 4.50, 30),
  ('Blank Greeting Card — Thank You', 'card', 4.50, 30),
  ('Scented Soy Candle', 'gift', 16.00, 12),
  ('Author-Signed Notecard Set', 'card', 12.00, 0)
on conflict (item_name) do nothing;
