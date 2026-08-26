# TODOS

## Build a real staff Supabase Auth role/claim system

**What:** Replace the seeded-user gate (used for the Product A+B live-sync phase) with a proper `staff` role/claim, RLS policies keyed to it, and a real sign-in flow.

**Why:** The seeded-user approach is fine for proving cross-product live sync but not for "anywhere real" — `supabase/migrations/0002_rls_and_functions.sql`'s own comment on `fetch_pending_preorders()` already flags this as a known gap.

**Pros:** Closes a real security gap before this could ever be a live store's staff tool.

**Cons:** Real auth-system work — new role, migration, middleware, sign-in UI — not trivial.

**Context:** Flagged during `/plan-eng-review` on 2026-08-25 while reviewing the Product A+B live-sync design doc (`flextop-main-design-20260825-163207.md`). The scope reduction that session made explicitly deferred this, rather than skipping it silently.

**Depends on:** Product B's dashboard existing first (built against the seeded-user gate).

**Status (2026-08-25 build):** Product B's dashboard, sign-in page, and sign-in/sign-out server
actions are built and gate on Supabase Auth session per `supabase/migrations/0003_orders_staff_select.sql`'s
`authenticated`-only RLS policy. What's still missing: the seeded staff user itself — that requires
creating one in your live Supabase project (Authentication -> Users -> Add user), which needs
project access this build didn't have. Until that user exists, `/product-b` will only ever show
the sign-in page. Also unverified: this build had no Node.js/npm available to run `npm run build`,
`npm run typecheck`, or `npm test` locally — CI on push is the first real check.

**Status (2026-08-25, later):** Staff user created (`jeffreydelacruzbarrera@gmail.com`, confirmed
in Supabase Auth) — verified present via `auth.admin.listUsers()`. `/product-b` correctly
redirects to sign-in when unauthenticated (307) and the sign-in page loads (200). Login itself
still needs a manual pass in-browser to confirm the dashboard renders and Realtime updates land —
this only verified the account exists and the RLS gate is wired, not the full sign-in round trip.
The underlying gap (seeded user, not a real role/claim) is unchanged.

---

## Build Products C (Customer Support Chatbot) and D (Marketing Content Generator)

**What:** The two remaining products from the original four-product assignment brief.

**Why:** The brief names all four products; the Product A+B live-sync phase is a scoped slice, not the whole assignment.

**Pros:** Completes the assignment scope. C and D are structurally simpler than A+B — no mutations, no realtime sync required.

**Cons:** Real build time. Whether both are needed depends on the grading rubric (all four required vs. depth rewarded on fewer).

**Context:** Flagged during `/plan-eng-review` on 2026-08-25. The shared foundation (schema, RLS, Gemini Live tool registry) already supports both — `lib/live-tools.ts` has their tool declarations stubbed (`productCToolDeclarations`, `productDToolDeclarations`).

**Depends on:** None technically — could be built in parallel with A+B. This session's plan sequences A+B first for the live-sync payoff.

**Status (2026-08-25 build):** Both built. Product C is a single-turn Gemini function-calling
chatbot reusing the same `check_inventory` / `check_order_status` / `get_upcoming_events` tool
declarations from `lib/live-tools.ts` — no new tool contracts invented, all reads already RLS-safe.
Product D is plain `generateContent()` creative writing (Instagram/Newsletter/Staff Pick Card),
no tools, no persistence. Neither touches the Live/voice WebSocket path — both are text-only via
the new `lib/gemini.ts`. Built directly at the user's explicit request ("product c and d, now"),
which superseded running the design-consultation TODO below first — see that entry's status.

---

## Run /design-consultation for a full design system before Products C+D

**What:** A proper design system session (typography, color, spacing, component vocabulary) beyond this phase's lightweight A+B tokens.

**Why:** Products C (chatbot) and D (marketing generator) will need their own UI decisions. A real system prevents each product looking like a separately-designed app.

**Pros:** Consistency across all four products; catches this early instead of after C/D are half-built.

**Cons:** Real time investment — most valuable once C/D are actually being scoped, not before.

**Context:** Flagged during `/plan-design-review` on 2026-08-25. Pass 5 found zero `DESIGN.md` existed for this project; the bookstore-specific tokens chosen this session (serif display type for book titles, warm paper/ink palette, monospace for B's stock numbers) are a starting point for A+B, not a full system.

**Depends on:** Products C/D reaching design/build stage.

**Status (2026-08-25 build):** Skipped for now, deliberately — the user asked to build C+D
directly rather than run this first. C and D reuse A+B's existing tokens (serif/sans/mono, warm
palette) as-is, so they're visually consistent with the rest of the app, but neither got its own
design pass (no dedicated review of chat UI patterns or content-generator layout specifically).
Still worth running before this goes further than a coursework demo.

---

## Verify Product B sign-in end-to-end in-browser

**What:** Confirm the full login round trip — sign in with the staff account, land on the
dashboard, see the pending-preorder queue, and confirm a pre-order placed on Product A shows up
live via Realtime without a manual refresh.

**Why:** This session confirmed the staff user exists in Supabase Auth and that the RLS gate
redirects correctly when unauthenticated, but never completed an actual login (no access to the
account password from this session).

**Depends on:** Staff user already created — done this session.

**Status: Done (2026-08-25).** Logged in successfully; dashboard rendered pending pre-orders and
stock levels. Along the way found and fixed a real bug: `authenticated` had no GRANT/policy on
`books` (0002 only covered `anon`), so titles fell back to raw ISBNs and "Stock levels" showed
empty — fixed in `0006_authenticated_books_select.sql`. After the fix, titles resolved correctly
and Realtime-driven stock decrements (from the pre-orders placed earlier this session) showed up
live without a refresh.

---

## Add a staff "add book" flow to Product B

**What:** A form (or admin action) in Product B for staff to add a new title to `books`, instead
of the catalog only ever coming from the seed migration.

**Why:** Right now the catalog is frozen at the 6 seed titles. There's no way to grow it without
hand-writing a SQL migration. Once this exists, it should also trigger the Google Books lookup
(see next item) so new titles get a cover/description automatically instead of needing a manual
backfill run.

**Depends on:** None technically, but pairs naturally with the auto-backfill item below.

**Status (2026-08-26 build):** Built, and paired with the auto-backfill item below in the
same change since they share one insert path. Product B's dashboard now has an "Add a book"
form (`app/product-b/dashboard.tsx`) posting to `addBookAction`
(`app/product-b/actions.ts`), validated against a new `addBookRequestSchema` in
`types/schema.ts`. Insert goes straight to `books` as the `authenticated` role — no
`SECURITY DEFINER` function needed, unlike `create_preorder`, since a new ISBN has no
concurrent-row race (the primary key already makes a duplicate insert fail atomically).
New titles also stream live to any other open staff dashboard: the books Realtime
subscription was widened from `UPDATE`-only to `*` in `lib/realtime` usage.

**Status (2026-08-26, later):** `0007_authenticated_books_insert.sql` applied to the live
project by the user via the Supabase CLI (`login && link && db push`) — this session had no
CLI credentials to do it directly. Build/lint/typecheck/vitest all pass locally.
**Still unverified:** the actual in-browser round trip (sign in as staff, submit the form,
confirm the title and its Google Books cover/description appear) — this session had no
staff account password to drive that itself; the user opted to test it manually rather than
hand over credentials. Update this entry once that pass is done.

---

## Auto-fetch Google Books metadata on insert instead of manual backfill

**What:** Call `lib/google-books.ts`'s `fetchBookMetadata()` at the point a book is added to
`books` (once the add-book flow above exists), so `cover_url`/`description` are populated
immediately instead of requiring `node scripts/backfill-book-covers.mjs` to be re-run by hand.

**Why:** The current backfill script is a one-time/manual step (2026-08-25 session) — fine for
seeding the 6-book demo catalog once, but doesn't scale if books get added through the app.

**Context:** Google's keyless Books API quota is fully disabled (`quota_limit_value: 0`) —
`GOOGLE_BOOKS_API_KEY` is required going forward, already set in `.env.local`. The fetch helper
already retries transient 429/5xx errors (fixed 2026-08-25 after the backfill script silently
dropped data on flaky 503s), so it's safe to call synchronously from a Server Action.

**Depends on:** The add-book flow above.

**Status (2026-08-26 build):** Done, built alongside the add-book flow above.
`addBookAction` calls `fetchBookMetadata(isbn)` synchronously right after the insert
succeeds, then updates `cover_url`/`description` on that row. A metadata-fetch failure
(after `fetchBookMetadata`'s own retries are exhausted) is caught and swallowed — it does
not roll back or block the book insert; the row is left with `cover_url`/`description`
still null, the same already-valid, already-rendered state a never-backfilled book is in
(see `0005_add_book_metadata.sql`). No manual script re-run needed for books added this way.

---

## Add book pricing and a merchandise (cards/gifts) catalog

**What:** `books` had no `price` column at all, and the schema had no table for the cards and
small gifts the business description mentions the store sells — only `books` existed.

**Why:** Flagged by the user 2026-08-26 while reviewing product coverage against the brief:
"we do not have data for the other products of the books store, neither pricing of each book
items."

**Depends on:** None.

**Status (2026-08-26 build):** Done. `0008_add_book_price.sql` adds `price numeric(10,2)` to
`books` (seeded for the 6 demo titles). `0009_merchandise.sql` adds a separate `merchandise`
table (id, item_name, category `card`/`gift`, price, stock_quantity) — separate from `books`
since these items have no ISBN — with RLS mirroring `books` (anon+authenticated SELECT,
authenticated-only INSERT) and 6 seed rows. `lib/inventory.ts`'s `InventoryRecord.isbn` field
was generalized to `id` so `evaluateStockStatus`/`sortBySeverity` work for both books and
merchandise without a duplicate implementation. Product A now shows book prices and a read-only
"Cards & Gifts" browse section (no pre-order — orders stay book-only per the brief). Product B's
add-book form now requires a price, and the dashboard adds a live "Merchandise stock" section
(same Realtime pattern as books).

**Still open:** No staff "add merchandise" flow exists yet — the 6 seed rows are the only way
merchandise data gets in today, same starting point `books` had before the add-book flow was
built. Migrations still need `supabase db push` against the live project (no CLI credentials in
this session, same recurring gap as every prior migration in this file).

---

## Close the 5 gaps found by the 2026-08-26 pain-point review

**What:** A 4-agent review (one per product) checked each product's actual code against the
pain point it's supposed to solve, per the brief. Found: Product A never wrote `reward_points`
anywhere (pain point 2 unaddressed) and had no customer signup path (only `cust_demo01` could
ever check out); Product B's dashboard swallowed query errors and left a public RPC
(`fetch_pending_preorders`) reachable by anon, bypassing the sign-in gate; Product C's two live
Supabase reads also swallowed errors, so a failed lookup read as "not in stock"/"no events";
Product D only had real data for books, not the "or upcoming event" half of its brief.

**Why:** User asked to close all 5 in one pass ("yes all") right after the review report.

**Status (2026-08-26 build):** Done, 5 commits:
- `0011_loyalty_stamps.sql` — `create_preorder()` now increments `customers.reward_points` by
  one stamp per order.
- `0010_customer_signup.sql` — new `create_customer()` RPC mints a real `cust_XXXXX` id;
  Product A gets a "New customer? Sign up" button (`signUpCustomerAction`) and shows the fresh
  reward balance after a successful pre-order.
- `0012_harden_rpc_grants.sql` — revoked anon EXECUTE on `fetch_pending_preorders()` (no
  legitimate anon caller existed) and added explicit anon+authenticated revokes on
  `create_preorder`/`create_customer` in case the project's default privileges grant roles
  EXECUTE directly (a bare `REVOKE FROM PUBLIC` wouldn't cover that).
- Product B's `page.tsx` now checks each query's `error`, logs server-side, and shows a banner
  on the dashboard instead of silently rendering empty lists.
- Product C's `check_inventory`/`get_upcoming_events` now return `lookup_failed: true` on a
  query error instead of `data ?? []`; the system instruction tells the model to say it's
  having trouble checking rather than report a false negative.
- Product D's `page.tsx` now also queries future `author_events`; `content-form.tsx` adds an
  event picker alongside the book picker, feeding grounded facts into the generation prompt.

Build/lint/typecheck/vitest all pass. **Not yet verified live:** these migrations aren't pushed
to the live Supabase project yet (same recurring gap — no CLI credentials in this session), and
there's no local Supabase CLI available either, so none of this was exercised in-browser against
a real database this session. Run `supabase db push`, then walk each product manually before
calling this closed.

**Status (2026-08-26, later):** Verified live. User installed the Supabase CLI, linked, and
pushed — hit two real snags along the way, both now documented: `link`/`push` are cwd-relative
(first attempt ran from `~`, silently created `~/supabase/.temp` instead of touching the repo),
and the remote's migration history had zero rows for any version including 0001-0007 despite
those being genuinely live, fixed via `supabase migration repair --status applied 0001..0007`
before 0008-0012 would push cleanly. After that: confirmed `books.price`/`merchandise` live via
direct REST calls, confirmed `fetch_pending_preorders` 401s for anon, and drove a real signup ->
pre-order round trip through the browser (Playwright + a manually-located Chrome-for-Testing
binary, since `chromium-cli` wasn't available and the npx-installed `playwright` package's cached
browser version didn't match) — got a genuine new customer id and a `reward_points` increment to
1, independently confirmed via `get_loyalty_balance`. Two books added via the staff form before
this session's price migration show `price: 0.00` (the hardcoded backfill only covered the
original 6 seed ISBNs) — needs a manual price fix via Product B's dashboard, still open.

---

## Add Product A "My Account" page, site-wide nav, and Product C quick-info panel

**What:** Three asks in one message: (1) a customer account page on Product A showing order
history and loyalty points, (2) a site-wide tab nav both customers and staff can use to move
between products, (3) Product C should surface store hours/return policy/event schedule directly
rather than only through the chatbot.

**Why:** User request after confirming the pain-point-review fixes worked live.

**Status (2026-08-26 build):** Done, verified live. `0013_customer_order_history.sql` adds
`get_customer_orders()` (same anon-safe SECURITY DEFINER pattern as `get_loyalty_balance` — safe
because the caller must already know the exact customer_id). New `/product-a/account` route
reads it plus `get_loyalty_balance`, joins book titles, and remembers the customer's id in
localStorage (`lib/customer-id-storage.ts`) after signup or a successful pre-order so a return
visit auto-loads. `app/site-nav.tsx` renders in the root layout on every page: Order & Loyalty /
My Account / Support / Marketing / Staff, active tab highlighted via `usePathname`. Product C's
page now queries `author_events` and shows hours/policy/events in a visible panel above the chat,
not just in the hidden system prompt.

**Real bug found and fixed along the way:** testing the account page's error path hit an actual
crash — a multi-argument `console.error(msg, errorObj)` call inside a Server Action made the
Console Ninja VSCode extension's console hook throw (`Cannot read properties of null/undefined
(reading 'stack')`), turning an intended graceful `{ ok: false }` response into a real 500.
Reproduced identically regardless of whether the extra args were raw error objects or plain
strings — only argument *count* mattered. Fixed by collapsing every `console.error` added this
session (4 call sites) to a single template-literal string. Worth remembering for any future
server-side logging in this repo on this machine.

Build/lint/typecheck/vitest all pass; full browser verification done for every new surface
(nav on all 5 pages, Product C panel, and a real signup -> account-page round trip showing the
actual order and point).

---

## /qa pass (2026-08-26): 7 issues found, 3 fixed, 4 deferred

**What:** Full-app QA sweep (all 4 products + account page + site nav) against the live dev
server and real Supabase database. Full report: `.gstack/qa-reports/qa-report-localhost-2026-08-26.md`.
Health score 90 -> 99/100.

**Fixed this pass (commits `1838884`, `87db83f`, `bd7ca5a`, `6e733b2`):**
- **Book-selection radios had no accessible name for 6 of 8 catalog titles** (high,
  accessibility). Each book's long description paragraph was inside the same `<label>` as its
  radio input, and the flattened label text (1400-2800+ chars once the description is included)
  exceeded Chromium's accessible-name-from-content length threshold, so the browser computed an
  *empty* name — confirmed via the real Chromium accessibility tree, not just a lint rule. Fixed
  by marking the description paragraph `aria-hidden` in `app/product-a/preorder-form.tsx` so the
  name is computed from title/author/price/status only. No regression test added — this repo's
  Vitest runs in `environment: "node"` with no jsdom/RTL, and `CLAUDE.md` documents
  browser-behavior verification here as manual by design.
- **Product D's generated Instagram captions contained literal, unrendered markdown asterisks**
  (medium, content) — Gemini sometimes wraps a title in `*emphasis*`, which showed up as literal
  asterisks once pasted into a caption instead of italics, undercutting the "ready to paste"
  point of the feature. Fixed with a `stripMarkdownEmphasis()` helper, extracted to
  `lib/markdown.ts` (couldn't live in `product-d/actions.ts` itself — a `"use server"` file can
  only export async functions) with a real regression test at `lib/markdown.test.ts` (5 cases).
- **Three more multi-argument `console.error` calls matching the exact Console Ninja crash
  pattern already found and fixed once this session** (high, functional) —
  `app/api/live/token/route.ts:87`, `app/product-c/actions.ts:198` (a third call site in a file
  that already had two others fixed), and `app/product-d/actions.ts:74` all called
  `console.error(label, err)` with two arguments, all inside a catch block wrapping a real
  external API call (Gemini). Found via a repo-wide grep while fixing the item above, not via an
  observed crash — same fix as before (collapse to one template-literal string arg). No
  regression test: the crash is caused by a VSCode extension hooking `console` in the dev-server
  process, which a standalone `vitest run` process never touches, so there's nothing in-process
  to assert against.

**Deferred this pass (all low severity — see the QA report for repro steps):**
- Homepage status card still says Products C and D "need GOOGLE_API_KEY at runtime" — the key is
  configured and both were verified working live during this pass. One-line text fix whenever
  it's convenient; misleading for anyone (e.g. a grader) reading the homepage literally.
- The pre-order form's "Customer ID must look like cust_XXXXX" error doesn't clear when a
  subsequent sign-up succeeds — both messages show at once until the next real submit.
- The site nav overflows at a 375px mobile width with no fade/arrow hinting it's scrollable
  (it is scrollable — confirmed — just not obviously so).
- Gemini-backed responses (Product C chat, Product D generation) take 19-32s in dev mode with
  only a static "Checking..." label — no streaming or changing progress text. Inherent to the
  Gemini round trip (Product C's is two calls: function-call, then final answer), not something
  a small source fix resolves.

**Also confirmed working, not just "not broken":** the full loyalty loop (sign up -> pre-order ->
stamp -> account page shows both) end-to-end with real data; Product C's live-inventory grounding
(correctly declined to confirm stock on a not-yet-inventoried title instead of guessing); the
"not yet inventoried" pre-order rejection path; all 8 catalog titles reachable in Product D's
dropdown (one looked missing in a QA tool's own rendering — a colon in "Sapiens: A Brief History
of Humankind" tripped up the snapshot tool, not the app; verified via a raw DOM query before
writing it up, so it was never filed as a bug).

---

## UI/UX overhaul: catalog cards, cart drawer, checkout with pickup scheduling, staff workspace

**What:** A full pass on the customer-facing UI/UX per a new spec — enlarged catalog cards with
Reserve/Pre-Order fulfillment badges, an interactive cart drawer, a checkout page with the pickup
address and a date/time selector, a dedicated sign-up screen, a refreshed My Account, and gating
Product D behind staff auth so it reads as one "employee workspace" with Product B. Also adopted
the color/type system from a new `design.md` reference doc the user added mid-session, closing the
`/design-consultation` gap TODOS.md had flagged as deliberately skipped since 2026-08-25.

**Why:** User request, delivered as a fairly complete spec rather than a vague ask — see
`design.md` for the reference doc and the session's own decisions (below) for the schema/backend
tradeoffs it required.

**Status (2026-08-26 build):** Done, 5 commits, verified live in-browser (real signup -> cart ->
checkout -> account round trip, screenshots at desktop and 375px mobile). Key decisions, made with
the user before building rather than guessed:
- **Fulfillment badges reuse existing stock status** (no `release_date` column added) —
  in_stock/low_stock -> "Reserve", out_of_stock/needs_attention -> "Pre-Order". Discovered during
  browser verification that this needed a follow-up: `create_preorder` hard-rejects any order once
  `stock_quantity` isn't `> quantity` (CLAUDE.md's own concurrency rule), so a title flagged
  "Pre-Order" could never actually complete checkout. Fixed by disabling "Add to cart" for those
  titles (label reads "Ask a bookseller" instead) rather than loosening the RPC's stock guard.
- **Cart checkout loops the existing single-item `create_preorder` RPC per line** (sequential, not
  a new whole-cart transactional RPC) — `0014_orders_pickup_slot.sql` only adds two new optional
  trailing params (`p_pickup_date`, `p_pickup_window`) to the existing function rather than
  changing its atomicity model. One sold-out item reports its own failure; the rest of the cart
  still succeeds — confirmed live (Atomic Habits correctly failed as not-yet-inventoried while
  Klara and the Sun succeeded in the same checkout).
- **Pickup date/window is persisted**, not UI-only — `orders.pickup_date`/`pickup_window` (nullable,
  existing rows and the Live API voice kiosk's `create_preorder` calls unaffected), visible on both
  the checkout confirmation and My Account's order history.
- **Sign-up stays without real customer auth** — the new dedicated `/product-a/signup` screen
  collects email + password for a real-feeling flow, but neither is persisted or checked; it still
  mints a `cust_XXXXX` via the existing `create_customer()` RPC. Building real customer accounts
  (Supabase Auth, an `email` column) was scoped out as comparable in size to the staff role/claim
  work already deferred above, and would have expanded CLAUDE.md's locked data contract.
- **Loyalty balance "real-time" update is a 20s poll**, not a Realtime subscription — `customers`
  is deliberately not anon-`SELECT`-able (0002's reasoning), so there's no RLS-safe channel to
  subscribe to without reopening that table to broad reads. Polling was judged the safe
  approximation rather than weakening a previously-hardened policy.

**Also fixed along the way:** the 2026-08-26 QA pass's deferred "site nav overflows at 375px with
no fade/arrow hinting it's scrollable" item — added a scroll-fade gradient hint, confirmed via
browser that all 4 tabs remain reachable by scrolling. The other three items from that QA pass
(homepage status card copy, pre-order form's stale-error-message bug, and slow Gemini response
UX) are still open — the second one is arguably moot now since the single-item pre-order form it
referred to no longer exists (replaced by the cart/checkout flow this session), but wasn't
re-verified against the new checkout form specifically.

**Not verified live:** Product B's staff dashboard changes (StaffNav tabs, StampBadge stock rows,
removed duplicate sign-out button) — build/lint/typecheck pass and the JSX was reviewed, but this
session had no staff account password to actually sign in and confirm the dashboard renders
correctly, same recurring gap as prior sessions. Also unverified: the pre-existing $0.00 price bug
on two staff-added books (flagged 2026-08-26, still open, unrelated to this session's changes) is
now more visible since those books show a "$0.00" price tag on the redesigned, larger catalog
cards.

---

## Add "search Google Books" to the staff add-book form

**What:** User asked whether more books/merchandise could be added, then clarified they meant
searching an external source (Google Books) by title/author rather than typing an exact ISBN.
`lib/google-books.ts` gains `searchBookCandidates(query)` (free-text search, several results,
filtered to ISBN-13 matches); Product B's "Add a book" form now has a search box above the manual
fields — picking a result prefills ISBN/title/author and shows the cover.

**Status (2026-08-26 build):** Done. Build/lint/typecheck/vitest pass. The search function itself
was verified against the live Google Books API directly (not through the UI) — confirmed real
results parse correctly, confirmed the retry-with-backoff logic (added after live testing hit
transient 503s on 2 of 3 back-to-back calls) recovers on a later attempt. **Not verified**: the
actual in-browser flow (search box -> pick a result -> submit -> book appears with cover) — same
recurring gap as everything else in Product B this session, no staff account password available.
Confirmed at the data level instead: 8 books / 6 merchandise rows currently exist and the catalog
page has no display cap (`.select()` with no `.limit()`/`.range()`), so "only seeing 8" earlier
in the session was the actual full catalog, not a display bug.

**Still open:** merchandise (cards/gifts) has no equivalent add flow — the 6 seed rows are still
the only way merchandise data gets in, same gap noted in the 2026-08-26 merchandise entry above.
