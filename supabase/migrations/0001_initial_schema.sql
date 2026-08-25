-- 0001_initial_schema.sql
--
-- Initial shared schema for the Riverside Bookstore suite, matching
-- types/schema.ts. Applied per the migrations process in the Solo Build
-- Plan (Section 2.1) — do not hand-edit the shared project's schema
-- outside of a migration file like this one, even solo; it's the only
-- record of what changed and when.

create extension if not exists pgcrypto;

-- order_status: canonical, lowercase. [FIXED: original docs mixed
-- 'Completed'/'Shipped' with 'pending'/'preorder' across five+ documents.]
create type order_status as enum ('pending', 'preorder', 'shipped', 'completed');

create table customers (
  customer_id  text primary key check (customer_id ~ '^cust_[a-zA-Z0-9]{5,}$'),
  signup_date  date not null default current_date,
  reward_points integer not null default 0 check (reward_points >= 0)
);

create table books (
  isbn              text primary key check (isbn ~ '^97[89]-?\d[\d-]{8,15}\d$'),
  book_title        text not null,
  author_name       text not null,
  -- Nullable: null means "not yet inventoried" and must NEVER be treated
  -- as 0 by any application code. [FIXED: original Product A CLAUDE.md
  -- didn't account for this even though the master schema always allowed it.]
  stock_quantity    integer check (stock_quantity >= 0),
  reorder_threshold integer not null default 5 check (reorder_threshold >= 0)
);

create table author_events (
  id                 uuid primary key default gen_random_uuid(),
  isbn               text references books (isbn) on delete set null,
  event_title        text not null,
  event_description  text not null default '',
  -- TIMESTAMPTZ, ISO 8601 storage. [FIXED: original schema table's own
  -- "format" and "example value" columns contradicted each other and
  -- disagreed with the TIMESTAMPTZ type declared elsewhere. Display
  -- formatting happens in the UI layer via formatEventTimestamp(), never
  -- stored as a formatted string.]
  author_event_at    timestamptz not null
);

create table event_tickets (
  ticket_id    text primary key check (ticket_id ~ '^tkt_[a-zA-Z0-9]{5,}$'),
  -- [FIXED: standardized on tkt_XXXXX; original docs disagreed between
  -- tkt_XXXXX (Product A's CLAUDE.md) and a date-based example
  -- (master schema table).]
  customer_id  text not null references customers (customer_id) on delete cascade,
  event_id     uuid not null references author_events (id) on delete cascade
);

create table orders (
  order_id      text primary key check (order_id ~ '^ord_[a-zA-Z0-9]{5,}$'),
  customer_id   text not null references customers (customer_id) on delete cascade,
  isbn          text not null references books (isbn),
  quantity      integer not null check (quantity > 0),
  order_status  order_status not null default 'pending',
  created_at    timestamptz not null default now()
);

create index orders_status_idx on orders (order_status);
create index orders_customer_idx on orders (customer_id);
create index books_stock_idx on books (stock_quantity);
