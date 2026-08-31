# Foxed & Bound — Bookstore Web App
### Technical & Design Specification (design.md)
**Author role:** Principal Full-Stack Engineer & UX Architect · **Build window:** 30 hours · **Target:** Production-deployed, high-polish MVP, zero scope creep

> "Foxed & Bound" is the example store name used throughout this doc to keep every section grounded in real content instead of placeholder text — swap it for the real brand name and the rest of the spec holds.

---

## 1. 30-Hour Feasibility & Scope Boundary

The single biggest risk to a 30-hour deadline isn't unfamiliarity with the stack — it's an MVP that quietly grows a sixth persona-feature at hour 20. This section exists to make scope arguments unnecessary: if it's not in the Must-Have table, it doesn't get built, no matter how quick it looks.

### 1.1 Critical MVP Feature Matrix

**Customer Portal**

| Feature | Status | Notes |
|---|---|---|
| Account sign up / login | **Must-have** | Email + password via Supabase Auth. No social login. |
| Catalog browse + search (title/author) + genre filter | **Must-have** | Simple `ILIKE` search. No typo-tolerance/relevance ranking. |
| Book detail page | **Must-have** | Cover, price, stock status, description. |
| Cart (add / update qty / remove) | **Must-have** | Requires login — see 1.3 for why guest cart is deferred. |
| Checkout (shipping info + order creation) | **Must-have** | Default: "Pay at pickup" (no live payment gateway). Stripe Checkout is a **conditional must-have** — see 1.3. |
| Order confirmation | **Must-have** | On-screen only for MVP. |
| Order history + status tracking | **Must-have** | Read-only list of the customer's own orders with status badge. |
| Guest checkout | Deferred | Cart-merge-on-login logic is a classic multi-hour sink for near-zero MVP value. |
| Reviews / ratings | Deferred | Not core to either persona's critical path. |
| Wishlist | Deferred | Nice-to-have, not load-bearing. |
| Recommendations ("customers also bought") | Deferred | Needs data volume the MVP won't have anyway. |
| Discount codes / coupons | Deferred | Pricing logic risk not worth taking on a fixed clock. |
| Real-time stock sync while browsing | Deferred | Stock is read at page load; good enough for MVP traffic. |

**Owner Portal**

| Feature | Status | Notes |
|---|---|---|
| Owner login (role-gated) | **Must-have** | One seeded owner account. No self-serve owner signup. |
| Inventory list (search / sort / filter) | **Must-have** | |
| Add / edit book | **Must-have** | Cover image via **URL paste**, not file upload (see 1.3). |
| Stock quantity adjustment + low-stock flag | **Must-have** | Reuses the same status-badge component as order status (Section 3.4). |
| Orders queue + status update (pending → fulfilled) | **Must-have** | |
| Sales analytics: revenue, order counts, top sellers, low-stock count | **Must-have** | Four pre-aggregated SQL metrics. No custom date-range picker. |
| Multi-owner / staff accounts | Deferred | One owner is sufficient to prove the persona. |
| CSV bulk import/export | Deferred | High effort, low demo value. |
| Multi-image gallery per book | Deferred | One cover image is enough. |
| Custom analytics date ranges / export | Deferred | Fixed "last 30 days" window only. |
| Email notifications (order confirmation, low stock) | **Stretch** | Only attempt after Sprint 3 if ahead of schedule (Section 5). |

### 1.2 Tech Stack Integration Strategy Using gstack

**Important distinction up front:** gstack (Garry Tan's open-source Claude Code skill pack) is a *build workflow* — a set of role-based slash commands (`/office-hours`, `/autoplan`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/review`, `/qa`, `/ship`, `/retro`) that structure how Claude Code plans, builds, and ships — it is language- and framework-agnostic and does not itself dictate a runtime stack. This spec still needs to name a real application stack; gstack is the process layer on top of it.

**Application stack (optimized for 30-hour single-repo velocity):**

| Layer | Choice | Why this, under a clock |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | One app, two route groups (`(shop)` and `/admin`) instead of two separate apps — half the setup, one deploy target. |
| Language | TypeScript throughout | Catches cross-persona schema mismatches at compile time instead of in QA. |
| Database + Auth + Storage | **Supabase** (Postgres + Auth + RLS + Storage) | One vendor, one dashboard, no separate auth service to wire up. RLS enforces the owner/customer boundary at the data layer, not just in UI conditionals. |
| Styling | **Tailwind CSS + shadcn/ui** | Accessible, unstyled primitives (Dialog, Table, Toast, DropdownMenu) you theme once via Section 3's tokens — the fastest path to "polished" that isn't a generic template look. |
| Data mutations | Next.js Server Actions | No separate REST/GraphQL API layer to design and secure — one less architectural decision to make under time pressure. |
| Charts (analytics) | **Recharts**, fed by pre-aggregated SQL | A bar/line chart over 4 metrics, not a reporting engine. |
| Payments | Stripe **Checkout** (hosted redirect) if ahead of schedule; otherwise mock "Pay at pickup" | See 1.3 — this is the single highest-variance scope decision in the whole build. |
| Hosting | **Vercel** (app) + **Supabase Cloud** (data) | Zero-config deploy; both have generous free tiers and sub-5-minute setup. |

**Mapping the 30-hour build onto gstack's Think → Plan → Build → Review → Test → Ship loop:**

- **Think (Hour 0):** Run `/office-hours` against this exact brief. Its forcing questions exist specifically to catch "you said bookstore app, but what you're describing is an inventory system with a storefront bolted on" — let it reshape scope *before* Sprint 0 starts, not after.
- **Plan (Hours 0–2):** Run `/autoplan` (chains CEO + design + eng review in one pass) against Section 1's feature matrix. Explicitly invoke the CEO review's **reduction mode** — with a fixed 30-hour budget, the correct output of planning is a shorter feature list, not a validated long one. Anything the plan review wants to add back in goes in the Deferred column, not the Must-Have one.
- **Build (Hours 2–26):** Standard Claude Code sessions per sprint (Section 5). No gstack command needed mid-build beyond normal iteration.
- **Review (end of each sprint):** Run `/review` before moving to the next sprint. It catches drive-by scope additions and lint/type issues while the context is still fresh — cheaper than finding them in Sprint 5.
- **Test (Sprint 5, and opportunistically after Sprints 2–3):** Run `/qa` — it drives a real headless browser through the critical paths (browse → cart → checkout → owner sees order → fulfill → customer sees updated status). This is exactly the manual-clicking work that's easiest to skip under deadline pressure; automating it is the highest-leverage use of gstack in this entire plan.
- **Ship (Hour 29):** Run `/ship` to bootstrap/verify the test setup, run a final coverage check, and cut the deploy.
- **Reflect:** `/retro` is explicitly **out of scope for the 30-hour window** — do it after, if at all. This isn't a soft suggestion: see Section 5, where the buffer hour is reserved strictly for whatever the final QA pass surfaces.

*Note: gstack's exact command set has grown quickly since launch (6 commands at release, 23+ within weeks) — confirm current command names against the installed version's `docs/skills.md` before Sprint 0, since this spec reflects the framework's well-established core loop rather than a pinned version.*

### 1.3 The Two Decisions That Actually Determine Whether This Ships On Time

1. **Payments.** Default path: checkout creates an `orders` row with `status = 'pending'` and no money moves — "Pay at pickup / on delivery." This is not a cop-out; it's the correct call for a 30-hour clock, because Stripe's webhook handling, error states, and test-mode edge cases are exactly the kind of "looks like 1 hour, costs 4" work that blows up a schedule. **Upgrade path, time-permitting:** Stripe's *hosted* Checkout (not Elements — no custom payment form) is a genuine 1.5–2 hour add if Sprint 2 finishes early. Decide which path you're on at the Sprint 2 checkpoint (Section 5) and don't revisit it.
2. **Cart ownership model.** Carts belong to authenticated users only — no anonymous/guest cart, no merge-on-login logic. This cuts real engineering complexity (session-to-user cart migration is a well-known multi-hour trap) for a feature (browse-without-account) that isn't on either persona's critical path anyway.

---

## 2. Architecture & Data Schema

### 2.1 Core Data Models

```sql
-- profiles: extends Supabase auth.users with app-specific role/identity
profiles
  id            uuid PK, references auth.users(id)
  role          text CHECK (role IN ('owner', 'customer')) NOT NULL DEFAULT 'customer'
  full_name     text
  created_at    timestamptz NOT NULL DEFAULT now()

-- books: the entire catalog. Single table — no separate categories join table.
books
  id              uuid PK DEFAULT gen_random_uuid()
  title           text NOT NULL
  author          text NOT NULL
  isbn            text
  description     text
  genre           text CHECK (genre IN ('Fiction','Mystery','Sci-Fi','History','Biography','Children''s','Nonfiction'))
                                            -- fixed list, NOT free text — see note below
  price_cents     integer NOT NULL CHECK (price_cents >= 0)
  cover_url       text                      -- pasted URL for MVP, not uploaded file
  stock_quantity  integer CHECK (stock_quantity >= 0)   -- NULL = not yet counted; see note below
  reorder_threshold integer NOT NULL DEFAULT 5
  created_at      timestamptz NOT NULL DEFAULT now()

-- cart_items: one row per (user, book). No anonymous carts (see 1.3).
cart_items
  id          uuid PK DEFAULT gen_random_uuid()
  user_id     uuid NOT NULL references profiles(id) ON DELETE CASCADE
  book_id     uuid NOT NULL references books(id)
  quantity    integer NOT NULL CHECK (quantity > 0)
  created_at  timestamptz NOT NULL DEFAULT now()
  UNIQUE (user_id, book_id)

-- orders: one per checkout. order_status drives the signature status badge (Section 3.4).
orders
  id            uuid PK DEFAULT gen_random_uuid()
  user_id       uuid NOT NULL references profiles(id)
  order_status  text CHECK (order_status IN ('pending','paid','fulfilled','cancelled')) NOT NULL DEFAULT 'pending'
  total_cents   integer NOT NULL
  shipping_name text NOT NULL
  shipping_address text NOT NULL
  created_at    timestamptz NOT NULL DEFAULT now()
  fulfilled_at  timestamptz

-- order_items: price snapshot at time of purchase — NEVER join live to books.price_cents for historical totals.
order_items
  id                uuid PK DEFAULT gen_random_uuid()
  order_id          uuid NOT NULL references orders(id) ON DELETE CASCADE
  book_id           uuid NOT NULL references books(id)
  quantity          integer NOT NULL CHECK (quantity > 0)
  unit_price_cents  integer NOT NULL   -- copied from books.price_cents at checkout time
```

**Rules worth stating explicitly, all found the expensive way on similar builds — a re-read of this exact spec caught the second and third:**
- `stock_quantity` is nullable and **null is not zero** — null means "never counted," not "out of stock." Every read path (catalog card, product detail, admin flag) must branch on null explicitly rather than treating a falsy value as zero.
- **Stock status derivation (the actual rule behind every "Low Stock" label, badge, and dashboard count in this doc):** `out_of_stock` if `stock_quantity = 0`; `low_stock` if `0 < stock_quantity <= reorder_threshold`; `needs_attention` if `stock_quantity IS NULL`; `in_stock` otherwise. Implement this once as a shared function (`lib/stock.ts`) — both the catalog's `StampBadge` and the admin dashboard's "Low Stock" count must call the same function, not two independently-written versions of this rule.
- `order_items.unit_price_cents` is a snapshot, not a live join. If `books.price_cents` changes next week, last month's order totals must not silently change with it.
- **`order_status` values in play for the MVP's default (mock-payment) path are only `pending` and `fulfilled`** — checkout creates `pending`, the owner marks `fulfilled` at pickup. `paid` is only ever written if the Stripe upgrade path (1.3) is taken, set on webhook confirmation. `cancelled` has no UI trigger in the MVP (no cancel-order feature is in Section 1.1's Must-Have matrix) — it exists in the CHECK constraint for manual/DB-level correction only, not as a button anyone clicks.
- **Deleting a book is out of scope for the MVP** (it's not in Section 1.1's Must-Have matrix — only add/edit/adjust-stock are). This isn't an oversight: `order_items.book_id` has no `ON DELETE` behavior, so a hard delete of a book with order history would fail on the foreign key. If a "remove from sale" action is wanted later, model it as a boolean flag on `books` (e.g. `is_active`), not a row delete.

**Row-Level Security baseline (do not skip — this is the actual owner/customer boundary, not a UI convention):**
- `anon`/`authenticated`: `SELECT` on `books` (public catalog) — remember the **base `GRANT SELECT`** in addition to the policy; a policy alone does nothing without the matching table-level grant.
- `authenticated`: full CRUD on their own `cart_items` and `SELECT` on their own `orders` where `orders.user_id = auth.uid()`.
- `authenticated`: `SELECT` on `order_items` — **note this table has no `user_id` column**, so the policy predicate cannot be `user_id = auth.uid()` directly. It must check ownership through the parent order: `order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())`.
- `books` writes, all `orders`/`order_items` reads/writes, and stock adjustments: **owner role only**, checked via a `profiles.role = 'owner'` policy predicate. This is a second, additive policy on the same tables — RLS policies union, so a customer gets their own rows via the customer policy and the owner separately gets everything via this one.

### 2.2 Component Hierarchy

Single Next.js app, two route groups sharing one component library and one Tailwind theme.

```
app/
├── (shop)/                          # Customer Portal
│   ├── layout.tsx                   # Header (logo, search, cart icon w/ count), Footer
│   ├── page.tsx                     # Catalog / Home
│   │   └── BookGrid → BookCard[]
│   ├── books/[id]/page.tsx          # Product Detail
│   │   └── AddToCartButton, StockStatusBadge
│   ├── cart/page.tsx
│   │   └── CartItemRow[], CartSummary
│   ├── checkout/page.tsx
│   │   └── ShippingForm, OrderSummary, PlaceOrderButton
│   ├── orders/page.tsx              # Order history
│   │   └── OrderRow[] (uses StampBadge — Section 3.4)
│   └── account/page.tsx
│
├── admin/                           # Owner Portal (role-gated at layout level)
│   ├── layout.tsx                   # Sidebar nav, owner-only guard (redirect if role !== 'owner')
│   ├── page.tsx                     # Dashboard
│   │   └── StatCard[] (revenue, orders, top sellers, low-stock count), RevenueChart
│   ├── inventory/page.tsx
│   │   └── DataTable, StockStatusBadge
│   ├── inventory/new/page.tsx & [id]/edit/page.tsx
│   │   └── BookForm
│   └── orders/page.tsx
│       └── DataTable, StampBadge, StatusUpdateAction
│
├── auth/{login,signup}/page.tsx
└── api/                             # Only if Stripe Checkout path is taken (1.3)
    └── stripe/webhook/route.ts

components/
├── ui/                              # shadcn/ui primitives, themed once via Section 3 tokens
│   └── button, input, dialog, table, toast, skeleton, dropdown-menu, tabs
├── BookCard.tsx / BookGrid.tsx
├── StampBadge.tsx                   # the one signature component — used by BOTH portals
├── EmptyState.tsx / ErrorState.tsx
└── DataTable.tsx                    # shared by inventory + orders admin views

lib/
├── supabase.ts                      # browser + server client factories
├── schema.ts                        # shared TS types, mirrors 2.1 exactly
└── orders.ts                        # server-only mutation logic (place order, update status)
```

---

## 3. UI Layout & Visual Design Spec

### 3.1 Design Thesis

The subject is a bookstore, not a generic e-commerce template — the design should look like it was built for one. Two personas, one system: the **customer side leans warm and literary** (serif titles, paper tones); the **owner side leans precise and operational** (monospace numerals, denser tables) — same token system, different balance, so the app reads as one coherent brand rather than two skinned templates bolted together.

*(Deliberately avoiding the three patterns that currently read as "AI-generated defaults": warm-cream-plus-terracotta, near-black-plus-acid-accent, and zero-radius broadsheet/newspaper layouts. This palette below is a distinct choice, not a variation on the first pattern.)*

### 3.2 Color System

| Token | Hex | Use |
|---|---|---|
| `ink-900` | `#1B2E28` | Primary text, nav bar, primary button background |
| `paper-50` | `#F6F1E4` | App background — aged paper, not clean-SaaS cream |
| `shelf-green-600` | `#3F6C51` | Primary interactive color — links, active states, primary CTAs |
| `foil-gold-500` | `#B08D3F` | Sparse accent only — the StampBadge signature element, price emphasis |
| `claret-600` | `#7A2E2E` | Errors, out-of-stock, destructive actions |
| `parchment-200` | `#EFE7D3` | Card/table surface — one step lighter than the page background for elevation |

Usage discipline: `foil-gold-500` appears in at most one place per screen at a time. If it's on the price *and* the badge *and* a button, it's overused — spend it on the signature element and let everything else stay quiet.

### 3.3 Typography

| Role | Typeface | Where |
|---|---|---|
| Display | **Fraunces** (variable, soft optical size) | H1/H2, book titles on cards and detail pages, store wordmark |
| Body / UI | **Inter** | All form fields, buttons, nav, body copy — both portals |
| Data / utility | **IBM Plex Mono** | Prices, order IDs, SKUs, and every number in the owner dashboard tables |

The mono face on the admin side is doing real design work, not decoration: it's what makes the owner portal *feel* operational next to the customer portal's warmer serif titles, using the same base system.

### 3.4 The Signature Element: Stamped Status

Every status value in the app — order status, stock-level flag — renders through one shared `<StampBadge>` component styled like a library due-date ink stamp: a rounded pill with a dashed inner ring, a slight -2°to 2° rotation, small-caps Plex Mono label. Color derives from status tone (`shelf-green-600` = fulfilled/in-stock, `foil-gold-500` = pending/low-stock, `claret-600` = cancelled/out-of-stock). It appears identically in the customer's order-tracking view and the owner's orders/inventory tables — the one place `foil-gold-500` is allowed to repeat across screens, since it's the intentional signature, not overuse.

This is deliberately cheap to build (one component: border, box-shadow dashed ring, CSS `transform: rotate()`) for a real payoff: it's the one visual idea this app will be remembered by, and it doubles as functionally required UI you'd have to build anyway.

### 3.5 Key Screen Wireframes

**Catalog (Home) — `/`**
```
┌─────────────────────────────────────────────────────┐
│ Foxed & Bound        [ Search books...  ]     🛒 3   │  ← ink-900 bar, paper-50 text
├─────────────────────────────────────────────────────┤
│ Genre: [All] [Fiction] [Mystery] [History] ...       │  ← shelf-green-600 active pill
│                                                       │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐         │
│  │  cover    │  │  cover    │  │  cover    │          │  ← BookCard: parchment-200 surface,
│  │  Title    │  │  Title    │  │  Title    │          │    Fraunces title, Plex Mono price,
│  │  $14.00   │  │  $9.50    │  │  $22.00   │          │    StampBadge if low/out of stock
│  │ [Add Cart]│  │ [Add Cart]│  │ [Sold Out]│          │
│  └───────────┘  └───────────┘  └───────────┘         │
└─────────────────────────────────────────────────────┘
```

**Product Detail — `/books/[id]`**
```
┌─────────────────────────────────────────────────────┐
│ ┌───────────┐   The Midnight Library                 │  ← Fraunces H1
│ │           │   Matt Haig                              │  ← Inter, ink-600
│ │  cover    │   $14.00                                 │  ← Plex Mono, larger weight
│ │  (large)  │   [ ◈ In Stock ]  ← StampBadge            │
│ │           │   Qty [ - 1 + ]   [ Add to Cart ]         │  ← shelf-green-600 primary button
│ └───────────┘                                           │
│                Description paragraph in Inter, ink-600  │
└─────────────────────────────────────────────────────┘
```

**Checkout — `/checkout`**
```
┌───────────────────────────┬───────────────────────────┐
│ Shipping                  │  Order Summary             │
│ Name  [____________]      │  1× Midnight Library  $14  │
│ Address                   │  2× Project Hail Mary $38  │
│ [ multi-line textarea   ] │  ───────────────────────── │
│ [ street/city/state/zip ] │  Total          $52.00     │
│                            │                             │
│  Pay at pickup — no       │  [   Place Order   ]        │  ← shelf-green-600, full-width
│  payment step here.       │                             │
└───────────────────────────┴───────────────────────────┘
```
*Reflects the default (mock-payment) path — one field maps to `shipping_name`, one to `shipping_address` (a single multi-line field, not separate street/city/state/zip columns; see Section 2.1's two-column schema). If the Stripe upgrade path is taken instead (1.3), this panel is replaced entirely by a "Continue to Payment" button that redirects to Stripe's hosted Checkout — the two payment paths are alternatives decided once at build time, never a live choice presented to the customer in the same build.*

**Admin Dashboard — `/admin`**
```
┌──────────┬────────────────────────────────────────────┐
│ Foxed &  │  Dashboard                                  │
│ Bound    │  ┌────────┐┌────────┐┌────────┐┌──────────┐ │
│          │  │Revenue ││Orders  ││Top     ││Low Stock │ │
│ ▸ Dash   │  │$1,204  ││  38    ││Seller  ││   4      │ │  ← StatCard: parchment-200,
│  Inventory│  │(30d)   ││(30d)   ││(name)  ││ items    │ │    Plex Mono numerals
│  Orders  │  └────────┘└────────┘└────────┘└──────────┘ │
│          │  ┌──────────────────────────────────────┐   │
│          │  │  Revenue, last 30 days (bar chart)    │   │
│          │  └──────────────────────────────────────┘   │
└──────────┴────────────────────────────────────────────┘
```

### 3.6 Component States

Every interactive component needs all of these defined before it's "done" — this table is the actual Definition-of-Done for Sprint 4 (Section 5), not an aspiration:

| Component | Default | Hover | Active/Focus | Empty | Error/Loading |
|---|---|---|---|---|---|
| **Book card** | parchment-200 surface, soft shadow | shadow lifts, cover scales 1.02 (150ms) | — | — (grid itself has empty state, see below) | Skeleton: gray blocks matching card layout |
| **Primary button** | `shelf-green-600` fill, `paper-50` text | darken 8% | 2px `foil-gold-500` focus ring (keyboard nav — non-negotiable) | — | Disabled: 50% opacity, cursor not-allowed, label unchanged |
| **Catalog grid** | — | — | — | "No books match that search." + clear-filters link, in the interface's voice, not an apology | Toast: "Couldn't load the catalog — try again." with retry button |
| **Cart** | — | Row: subtle background tint | — | Illustrated-free empty state: "Your cart is empty." + "Browse books" CTA | Line-item removed if it 404s server-side, with inline notice why |
| **Admin inventory table row** | `paper-50` / `parchment-200` zebra stripe | row tint on hover | Selected row: `shelf-green-600` left border | "No books yet — add your first one." + Add Book button | Failed row action: inline `claret-600` text under the row, not a silent failure |
| **StampBadge** | rotation + dashed ring per status color | — (non-interactive) | — | n/a | n/a |
| **Form inputs** | 1px `ink-900` @ 30% opacity border | border darkens | `foil-gold-500` focus ring, 2px | n/a | `claret-600` border + one-line message directly under the field, stating what's wrong and how to fix it |

Quality floor, non-negotiable regardless of how much time is left: every interactive element has a visible keyboard focus state, the layout holds down to a 375px mobile viewport, and `prefers-reduced-motion` disables the transitions in Section 4 rather than ignoring it.

---

## 4. Micro-Interactions & Animation Flow

Motion budget for this build: a small number of deliberate moments, executed cleanly, rather than animation on every element. Under a 30-hour clock, restraint is also the faster choice to implement.

| Interaction | Behavior | Timing | Implementation |
|---|---|---|---|
| **Add to cart** | Button label briefly swaps to a checkmark + "Added"; cart icon count bumps with a single scale pulse (1 → 1.15 → 1); a toast confirms with the book title | 200ms button swap, 300ms icon pulse, toast auto-dismiss 2.5s | Tailwind `transition` + `scale-110` utility class toggled via a short `setTimeout`-cleared state; shadcn/ui `Toast` for the confirmation. No JS animation library needed. |
| **Cart drawer / modal reveal** | Slides in from the right, backdrop fades in behind it | 200ms ease-out | shadcn/ui `Dialog`/`Sheet` primitive — reveal animation is built in via Radix; just theme it, don't hand-roll it. |
| **Page-to-page navigation** | No custom page transition. Next.js App Router's default instant swap is correct here — a custom transition layer is real effort for a 30-hour budget with near-zero user-facing payoff on a utility app. | — | Explicitly **not building this** — listed here so it's a decision, not an oversight. |
| **Skeleton loaders** | Catalog grid, product detail, and admin tables show shape-matched gray skeletons (not spinners) while Server Components fetch | Pulse animation, 1.5s loop | shadcn/ui `Skeleton` primitive, sized to match the real component's dimensions exactly so there's no layout shift on load. |
| **StampBadge status change** | When an order's status updates (owner marks fulfilled), the badge does a quick rotate-and-settle — from 0° to its resting -2°/2° tilt with a small overshoot | 250ms `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight bounce) | Pure CSS `@keyframes`, triggered by a key-change re-render. This is the one place a small bounce is earned — it's the signature element, and the "stamp landing" motion is the entire point of the metaphor. |
| **Form validation errors** | Field border color transitions to `claret-600`, error text fades in below it — no shake animation | 150ms | CSS transition on border-color + opacity. Shake is deliberately excluded — it reads as filler motion per the "less is more" principle, not as information. |
| **Low-stock threshold crossed (admin)** | Row background tints faintly toward `foil-gold-500`/`claret-600` as it re-sorts to the top of the flagged list | 200ms background transition | CSS transition; no reflow animation library needed since it's a background-color change, not a position change. |

**Implementation approach, stated plainly:** Tailwind's built-in `transition-*` utilities and a handful of custom `@keyframes` in `globals.css` cover every row in this table. No motion library (Framer Motion, GSAP) is necessary for this feature set — pulling one in would cost setup time this budget doesn't have, for effects Tailwind and native CSS already produce. If a future post-MVP pass wants orchestrated page transitions or scroll-triggered reveals, that's the point to reach for one, not now.

---

## 5. Hour-by-Hour Execution Roadmap

Six sprints, 30 hours, one held-in-reserve buffer hour that is not to be spent on new features under any circumstances.

### Sprint 0 — Think & Plan Lock (Hours 0–2)
- Run `/office-hours`, then `/autoplan` in reduction mode against Section 1's feature matrix. Treat the output as final.
- Scaffold Next.js app, install Tailwind + shadcn/ui, wire the Section 3 design tokens into `tailwind.config.ts`.
- Create Supabase project, apply the Section 2.1 schema + RLS as a migration.
- **Deploy the empty scaffold to Vercel now** — proves the deploy pipeline works at hour 2, not hour 29.
- *Risk:* planning scope-creep. *Mitigation:* hard 2-hour cap; anything not resolved by then defaults to Deferred.

### Sprint 1 — Data Layer & Auth (Hours 2–6)
- Auth wiring (signup/login), seed exactly one owner profile manually (no owner-signup UI).
- Seed script: 30–40 books with real-ish titles/authors/prices/placeholder cover URLs.
- Write and **test** RLS policies as both `anon` and `authenticated` roles against a real query — not just read the policy and assume it works.
- `/plan-eng-review` checkpoint on the schema before building UI against it.
- *Risk:* RLS misconfiguration (a policy with no matching base `GRANT` fails silently until tested). *Mitigation:* explicit test pass this sprint, not discovered in Sprint 5.

### Sprint 2 — Customer Portal Core (Hours 6–14)
- Catalog, search/filter, product detail, cart, checkout, order confirmation, order history.
- **Checkpoint at hour ~10:** on schedule → attempt Stripe Checkout upgrade (Section 1.3); behind schedule → stay on "Pay at pickup" and don't revisit the decision.
- `/review` at sprint end.
- *Risk:* payment integration scope creep. *Mitigation:* the checkpoint decision above is binding, not a suggestion.

### Sprint 3 — Owner Portal Core (Hours 14–21)
- Inventory table + add/edit form, stock adjustment, orders queue + status update, analytics dashboard (4 metrics only, Recharts bar chart on pre-aggregated SQL).
- End-to-end smoke test: place an order as customer → confirm it appears in the owner queue → mark fulfilled → confirm customer's order view reflects it.
- `/review`, and a first `/qa` pass if time allows.
- *Risk:* analytics scope creep (date pickers, export, custom reports). *Mitigation:* four metrics, fixed 30-day window, no exceptions this sprint.

### Sprint 4 — Polish, Motion, States (Hours 21–26)
- Apply Section 3.6's component-states table as a literal checklist per component.
- Apply Section 4's motion table.
- Mobile responsive pass, keyboard-focus audit, `prefers-reduced-motion` check.
- `/plan-design-review` for an outside-eye pass on consistency and "AI slop."
- *Risk:* open-ended tweaking. *Mitigation:* the states table is the Definition of Done — once every row is checked, this sprint is over, not "as polished as possible."

### Sprint 5 — QA, Ship, Buffer (Hours 26–30)
- Full `/qa` regression across both personas' critical paths (the same end-to-end flow from Sprint 3, run through a real headless browser this time, plus an RLS check: confirm a logged-in customer is actually blocked from `/admin` routes).
- Fix what it finds.
- `/ship`: final build, coverage check, production deploy, verify environment variables on the host.
- **Final hour is buffer** — held in reserve for whatever Sprint 5's QA pass surfaces. If nothing does, stop; don't spend it on a new feature or a `/retro`.

### Cross-Cutting Risk Mitigations

| Risk | Mitigation |
|---|---|
| Payment integration balloons | Mock "Pay at pickup" is the default path, not the fallback — Stripe is opportunistic upgrade only, decided once at a fixed checkpoint |
| RLS silently blocks legitimate reads | Test policies against real `anon`/`authenticated` roles in Sprint 1, not assumed correct from reading the SQL |
| Analytics turns into a reporting engine | Hard cap at 4 metrics, fixed window, no date picker, decided in Section 1 before Sprint 3 starts |
| Polish pass has no end condition | Section 3.6's states table is the literal Definition of Done |
| Bugs found only at the very end | `/qa` runs opportunistically after Sprint 3 as well as in Sprint 5 — two chances to catch cross-persona issues, not one |
| Deploy fails at the last hour | Empty scaffold deployed to production in Sprint 0, hour 2 — the pipeline is proven working before any real feature exists |

---

## 6. Demo Day Contingency

Section 5 is scoped around *shipping*. This section is scoped around the different, narrower problem of *presenting well for a few minutes in front of people* — a genuinely easier bar than "matches this spec completely," and worth treating as its own deliverable rather than assuming it falls out of Sprint 5 for free.

### 6.1 The Demo Script — the only path that needs to work perfectly

Rehearse this exact sequence, not "whatever the audience wants to see." A live demo is a scripted three minutes, not an open Q&A with the app.

| # | Step | Screen | What it proves |
|---|---|---|---|
| 1 | Open catalog, filter to one genre pill | `/` | Search/filter works, `StampBadge` visible on a low-stock title |
| 2 | Open that low-stock book's detail page | `/books/[id]` | Product detail, stock-aware Add to Cart |
| 3 | Add to cart — narrate the toast + icon pulse | `/` (cart icon) | The one animation worth calling attention to live |
| 4 | Go to cart, then checkout, place the order | `/cart` → `/checkout` | Full purchase path, order confirmation |
| 5 | Switch to the owner account (pre-logged-in second tab — see 6.4) | `/admin/orders` | The order just placed appears in the queue in real time |
| 6 | Mark it fulfilled | `/admin/orders` | `StampBadge` transition (the one bounce animation worth keeping — see 6.3) |
| 7 | Switch back to the customer tab, refresh order history | `/orders` | Status update reflects across personas — this is the actual thesis of the two-portal architecture, make sure it's the closing beat |
| 8 | Glance at the admin dashboard on the way out | `/admin` | Non-zero revenue/order numbers (see 6.2 — this only works if seeded) |

Total run time target: under 3 minutes. If it's longer in rehearsal, cut narration, not steps.

### 6.2 Pre-Demo Seed State

An empty or randomly-seeded database demos badly no matter how well the app works. Seed deliberately, the day before, not the morning of:

- **A curated "hero" book** with a real cover image URL (not a broken placeholder) for step 2 — pick one with genuine title/author/description, since this is the one book the audience actually reads.
- **At least one book at `low_stock`** (per Section 2.1's derivation rule) and one at `out_of_stock`, so the `StampBadge` color range is visible somewhere in the catalog grid without you having to explain it.
- **A handful of historical orders already `fulfilled`**, dated across the last 30 days, *in addition to* Sprint 1's 30–40 book seed — without this, the admin dashboard's revenue chart and top-sellers card are empty or flat before you've even placed the live demo order, which undercuts step 8 completely. This is a seed-script addition, not a manual dashboard step: add it to Sprint 1's seed script now so it isn't a last-minute scramble.
- **The demo customer account's cart is empty** before you start — a leftover test item from a rehearsal run turns step 3–4 into a confusing "wait, why are there two things in the cart" moment.
- **Clear the browser cache / use a fresh incognito window** for the live tab specifically, so stale client state from earlier testing can't surface mid-demo.

### 6.3 Polish Cut Order — if Sprint 4 runs long

This list only ever touches Section 4's micro-interactions. It never touches Section 3.6's component states (empty/error/loading) and never touches anything in Section 1.1's Must-Have matrix — a broken empty state reads as an unfinished app on stage; a missing animation doesn't. If Sprint 4 is short on time, cut top-down, stop as soon as you're on schedule again:

1. `StampBadge` rotate-and-settle bounce → instant state change, no animation
2. Low-stock row background tint transition → instant color swap
3. Form validation error fade-in → instant appearance
4. Cart icon scale-pulse on add-to-cart → keep the toast, drop the icon animation
5. Skeleton loaders → last resort, and don't drop straight to nothing; substitute a plain "Loading…" text so there's never a blank-to-content flash, which reads worse live than a plain loading state does

**Never cut, regardless of time pressure:** anything in Section 3.6 (a demo that hits an unhandled error or a raw empty screen live is far more damaging than any animation being absent), RLS/security work, or anything in Section 1.1's Must-Have rows.

### 6.4 Live-Demo Failure Contingency

Live demos fail for reasons that have nothing to do with whether the app was built correctly. Prepare for that separately from preparing the app:

- **Record a full screen-capture of the working demo script (Section 6.1) during final rehearsal**, once it runs clean end to end. This is the fallback if venue wifi, the Supabase connection, or a projector handoff goes wrong live — not a nice-to-have, treat it as part of Sprint 5's deliverables.
- **Open both portal tabs before you start presenting**, already logged in as the customer and owner accounts respectively (two browser windows or two tabs, not one account you log in/out of live) — no live typing of URLs or credentials while presenting.
- **Load the pages once, off-stage, before you go up**, so Vercel's cold-start latency and Supabase's connection warmup happen before anyone's watching, not during your step 1.
- **Test on the actual presentation device and network beforehand**, not just your dev machine — a venue's guest wifi is a materially different environment than the network the app was built on.
- **Have the recorded video ready to play with one click**, not buried in a folder you have to hunt for if the live version stalls mid-script.

### 6.5 Rehearsal

Run the Section 6.1 script start to finish at least twice before presenting — once to find where the timing or narration is awkward, once more to confirm the fix worked. Know what you'll say during the one skeleton-loader beat that's still in the app (Section 6.3, item 5, if it wasn't cut) so a half-second of loading doesn't turn into a half-second of silence — silence reads as "is it broken?" to an audience in a way it never does to you mid-build.
