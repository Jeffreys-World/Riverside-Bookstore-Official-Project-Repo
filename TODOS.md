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

---

## Build Products C (Customer Support Chatbot) and D (Marketing Content Generator)

**What:** The two remaining products from the original four-product assignment brief.

**Why:** The brief names all four products; the Product A+B live-sync phase is a scoped slice, not the whole assignment.

**Pros:** Completes the assignment scope. C and D are structurally simpler than A+B — no mutations, no realtime sync required.

**Cons:** Real build time. Whether both are needed depends on the grading rubric (all four required vs. depth rewarded on fewer).

**Context:** Flagged during `/plan-eng-review` on 2026-08-25. The shared foundation (schema, RLS, Gemini Live tool registry) already supports both — `lib/live-tools.ts` has their tool declarations stubbed (`productCToolDeclarations`, `productDToolDeclarations`).

**Depends on:** None technically — could be built in parallel with A+B. This session's plan sequences A+B first for the live-sync payoff.

---

## Run /design-consultation for a full design system before Products C+D

**What:** A proper design system session (typography, color, spacing, component vocabulary) beyond this phase's lightweight A+B tokens.

**Why:** Products C (chatbot) and D (marketing generator) will need their own UI decisions. A real system prevents each product looking like a separately-designed app.

**Pros:** Consistency across all four products; catches this early instead of after C/D are half-built.

**Cons:** Real time investment — most valuable once C/D are actually being scoped, not before.

**Context:** Flagged during `/plan-design-review` on 2026-08-25. Pass 5 found zero `DESIGN.md` existed for this project; the bookstore-specific tokens chosen this session (serif display type for book titles, warm paper/ink palette, monospace for B's stock numbers) are a starting point for A+B, not a full system.

**Depends on:** Products C/D reaching design/build stage.
