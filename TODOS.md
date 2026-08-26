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
