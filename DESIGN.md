# Design System — Riverside Books

> Source of truth for every visual and UI decision across Products A-D.
> Values here are **reconciled against shipped code** (`app/globals.css`,
> `tailwind.config.ts`, `app/layout.tsx`) as of 2026-08-30 — where this doc and
> the code ever disagree, the code was right and this doc is stale; fix the doc.
>
> The original 30-hour build spec (scope matrix, hour-by-hour roadmap, demo-day
> contingency) is archived at `docs/archive/2026-08-30-original-build-spec.md`.
> It described a build that has since shipped; none of it is current guidance.

---

## Product Context

- **What this is:** A four-product bookstore suite sharing one database, one auth
  system, and one design system. Product A is the public storefront (browse,
  pre-order, loyalty). Product B is the staff inventory and ops dashboard. Product C
  is the public support center (FAQ, chatbot, events). Product D is a staff-only
  marketing content generator.
- **Who it's for:** Two audiences on one system. Customers (A, C) are browsing a
  bookshop. Staff (B, D) are running one — repeat users, daily, at speed.
- **Space/industry:** Independent bookselling. The peer set is Shopify storefronts
  and generic retail admin panels; the whole point of this system is to read as
  neither.
- **Project type:** Hybrid — public storefront/editorial surfaces (A, C) plus
  internal data-dense tooling (B, D).

### The memorable thing

**"The bookseller behind the counter."**

Someone who knows the shelves handled this. Every design decision in this document
serves that one idea; a choice that doesn't serve it is decoration, and decoration
is what gets cut first.

Products A and B already express it through the ink stamp. Products C and D were
built with correct tokens and none of the ideas — this document extends the system
to them (see "Product C" and "Product D" below).

---

## Aesthetic Direction

- **Direction:** Warm literary, with an operational counterweight. The customer side
  leans editorial (serif titles, paper tones, generous rhythm); the staff side leans
  utilitarian (mono numerals, denser tables). **Same tokens, different balance** — so
  the suite reads as one brand, not two skinned templates.
- **Decoration level:** Intentional. Texture comes from the palette's warmth and the
  stamp's dashed ring, not from illustration, patterns, or gradients.
- **Mood:** An aged-paper reading room that happens to be well-run. Warm but not
  twee; precise but not clinical.
- **Deliberately avoided** — the three patterns that read as AI-generated defaults:
  warm-cream-plus-terracotta, near-black-plus-acid-accent, and zero-radius
  broadsheet layouts. Also banned outright: purple/violet gradients, three-column
  icon-in-circle feature grids, centered-everything, gradient CTAs, and `system-ui`
  as a display or body face.

---

## Typography

Loaded via `next/font/google` in `app/layout.tsx` — self-hosted at build time, no
runtime CDN request, `display: "swap"` on all three faces.

| Role | Typeface | CSS var | Where |
|---|---|---|---|
| Display | **Fraunces** (variable; `opsz` + `SOFT` axes) | `--font-serif` | H1/H2, book titles, store wordmark, **chatbot answers** |
| Body / UI | **Inter** | `--font-sans` | Form fields, buttons, nav, body copy, both portals |
| Data / utility | **IBM Plex Mono** (400/500/600) | `--font-mono` | Prices, order IDs, ISBNs, stamp labels, every number in staff tables |

The mono face on the staff side does real work, not decoration: it is what makes
Product B and D *feel* operational next to the customer side's serif, using one
shared system.

**On Inter:** Inter is a widely-overused body face and would not be the pick for a
fresh system. It is retained deliberately — it is shipped across four products and
reads as neutral against Fraunces, which is where this system's character actually
lives. Recorded as a decision, not an oversight.

### Scale (as shipped, measured)

| Level | Class | Face | Use |
|---|---|---|---|
| Page title | `text-3xl` | Fraunces | One per route, top of `<main>` |
| Section title | `text-2xl` / `text-xl` | Fraunces | Major sub-sections |
| Card / panel title | `text-lg` | Fraunces | Card headers, drawer titles |
| Body | `text-sm` | Inter | Default body copy — this system runs one step denser than typical |
| Emphasis body | `text-base` | Inter | Chatbot answers, primary prose |
| Meta / caption | `text-xs` | Inter or mono | Timestamps, helper text, counts |
| Stamp label | `text-[10px]` uppercase | IBM Plex Mono | `StampBadge` only |

---

## Color

- **Approach:** Restrained. Shelf-green is the only interactive color; gold is
  rationed to one appearance per screen; everything else is paper, ink, and one
  surface step.
- **Implementation:** All colors are CSS custom properties in `app/globals.css`
  declared as space-separated RGB channels, consumed through Tailwind with
  `rgb(var(--color-x) / <alpha-value>)`. This is why `bg-paper` / `text-ink`
  repaint for dark mode with **no `dark:` variants at any call site** — do not add
  them; change the variable instead.

### Light (`:root`)

| Token | Hex | RGB | Use |
|---|---|---|---|
| `paper` | `#F6F1E4` | `246 241 228` | Page background — aged paper, not clean-SaaS cream |
| `ink` | `#1B2E28` | `27 46 40` | Primary text, nav, primary button fill |
| `accent` | `#3F6C51` | `63 108 81` | **The** interactive color — links, active states, primary CTAs, focus ring |
| `accent-soft` | `#E4EDE7` | `228 237 231` | Tinted panels, the branded image placeholder |
| `gold` | `#8A6D28` | `138 109 40` | Rationed accent — one per screen |
| `claret` | `#7A2E2E` | `122 46 46` | Errors, out-of-stock, destructive |
| `claret-soft` | `#F7E9E9` | `247 233 233` | Error panel backgrounds |
| `surface` | `#EFE7D3` | `239 231 211` | Cards and tables — one step up from page |
| `field` | `#FFFFFF` | `255 255 255` | Form inputs — must pop against `surface` |
| `scrim` | `#000000` | `0 0 0` | Modal/drawer backdrop |

**Gold is `#8A6D28`, not `#B08D3F`.** The original `#B08D3F` measured ~2.5:1 on
`bg-surface` and failed WCAG AA everywhere gold is a *text* color (prices, the
`PENDING` / `PRE-ORDER` / low-stock stamps, reward points). The shipped value is
~4.6:1. Any new gold usage inherits this constraint — check contrast before
introducing a lighter gold anywhere.

### Dark (`.dark`)

Not a generic gray dark theme — the same warm bookstore palette inverted into a
dark reading room. Toggled by a `class` on the root (`darkMode: "class"`).

| Token | Value | Note |
|---|---|---|
| `paper` | `23 20 15` | Near-black **warm** charcoal, not neutral gray |
| `ink` | `237 230 214` | Warm cream text |
| `accent` | `122 178 140` | Brighter sage — the light-mode green is too dark here |
| `accent-soft` | `34 51 42` | |
| `gold` | `212 175 106` | Already passed contrast; deliberately left alone during the light-mode fix |
| `claret` | `224 138 138` | |
| `claret-soft` | `58 32 32` | |
| `surface` | `33 29 23` | |
| `field` | `46 41 33` | Lighter than `surface`, so inputs still pop |
| `scrim` | `0 0 0` | Stays black in **both** themes — a token that flipped with `ink` would *lighten* the dark page instead of dimming it |

**Elevation in dark mode.** Tailwind's shadow utilities are all `rgb(0 0 0 / 0.1)`,
tuned for a light page — against near-black surfaces they contribute nothing and
cards lose their lift entirely. `globals.css` restates the four the app uses
(`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, plus the `hover:` variants,
which must be named separately) at 0.55–0.7 opacity. If you introduce a new shadow
utility, add its dark counterpart there.

### Gold discipline

Gold appears **at most once per screen**. If it is on the price *and* the badge
*and* a button, it is overused. Spend it on the signature element and let everything
else stay quiet.

Current allocation: Product A — the pending/pre-order stamp. Product B — low-stock
flags. Product C — the pending stamp during a catalog lookup. Product D — the shelf
card's dashed rule.

---

## The Signature Element: Stamped Status

`components/stamp-badge.tsx`. Every status value in the app renders through this one
component, styled like a library due-date ink stamp: rounded-full, 2px **dashed**
border, small-caps IBM Plex Mono at 10px, and a slight rotation that varies by tone
so a row of stamps never looks mechanically aligned.

| Tone | Border + text | Rotation | Means |
|---|---|---|---|
| `positive` | `accent` | `-rotate-2` | In stock, fulfilled, completed |
| `pending` | `gold` | `rotate-1` | Pre-order, pending, low stock |
| `negative` | `claret` | `-rotate-1` | Out of stock, cancelled |
| `neutral` | `ink/30` | `rotate-2` | Everything else |

This is the one visual idea the app is remembered by, and it doubles as functionally
required UI. **It is also the coherence test for the whole suite:** a product that
displays state without using it is off-system. As of 2026-08-30 it appears in
Product A (book cards, gift cards, account) and Product B (dashboard) — and its
extension into Product C is the central move of this document.

---

## Spacing, Layout, Radius

- **Base unit:** 4px (Tailwind default scale).
- **Density:** Comfortable on customer surfaces, compact on staff surfaces. The
  body default of `text-sm` sets the overall rhythm one step denser than typical.
- **Page shell:** `mx-auto max-w-7xl px-6 py-16` for full-width product pages;
  `max-w-2xl` for narrow single-column pages (contact); `max-w-md` for forms.
- **Radius:** `rounded-md` (6px) is the default for controls, inputs, and buttons —
  107 uses. `rounded-lg` (8px) for cards and panels — 41 uses. `rounded-full` for
  stamps and pills only. **Do not introduce a third card radius.**
- **Borders:** `border-ink/10` for card and panel edges, `border-ink/20` for form
  inputs. Two weights, no more.
- **Touch targets:** every interactive control is `min-h-[44px]`. Non-negotiable —
  it is already honored across all four products.
- **Focus:** a global `:focus-visible` rule paints a 2px `accent` outline at 2px
  offset. Never remove it per-component.

---

## Motion

- **Approach:** Minimal-functional. A small number of deliberate moments, cleanly
  executed, rather than animation on every element. No motion library — Tailwind
  `transition-*` plus a handful of `@keyframes` covers everything here.
- **Duration:** `duration-150` is the house default (57 uses) for hover and state
  transitions. `duration-200` for reveals. Nothing else without a reason.
- **The hover idiom:** `transition-transform duration-150 hover:scale-105`, with
  `disabled:hover:scale-100` on anything disableable.
- **Reveals:** drawers and modals slide with a fading backdrop, ~200ms ease-out.
- **Page transitions:** explicitly **not built.** The App Router's instant swap is
  correct for a utility app. Listed so it stays a decision rather than an oversight.
- **Skeletons over spinners:** loading states are shape-matched to the content they
  replace, so nothing shifts on arrival.
- **The one earned bounce:** a `StampBadge` whose status changes rotates from 0° to
  its resting tilt with a small overshoot — 250ms
  `cubic-bezier(0.34, 1.56, 0.64, 1)`. This is the stamp landing, and it is the only
  place in the system where a bounce is justified. Form errors deliberately do
  **not** shake; the border transitions to `claret` over 150ms and the message fades
  in.

---

## Imagery

- **Every catalog image routes through `components/card-image.tsx`** — books,
  merchandise, events, and any future image-bearing card. It handles both failure
  modes identically (no URL, and a URL that 404s), because a viewer cannot tell
  those apart and should not have to.
- **The placeholder is branded, never a grey box:** an `accent-soft` panel with the
  serif "R" mark and a small uppercase label. Do not hand-roll an alternative.
- **No stock photography.** Decorative photos that have nothing to do with the item
  are worse than no photo — a mismatched hero reads as a bug (see ISSUE-005: an
  author event illustrated with a van in a desert, a greeting card shown as a
  pineapple). Real art per item, or the branded placeholder. There is no third
  option.
- **Aspect ratios** are fixed by `CardImage`: `portrait` (2:3) for books,
  `square` for merchandise, `video` (16:9) for event heroes.

---

## Product C — Support Center

Public. FAQ, chatbot, and upcoming events under one tablist at `/product-c`.

**The reading:** you walk up to the counter and ask. A real counter interaction has
three beats — they look it up, they answer in their own voice, they hand you
something. The current build has none of the three; it renders a transcript.

### C1. The exchange has speaker shape

Today the question is bold `text-ink` and the answer is a bordered card — the
emphasis is backwards. Invert it:

- **Question:** flush-right, Inter, `text-ink/60`, `text-sm`. It recedes; the user
  already knows what they asked.
- **Answer:** **Fraunces at `text-base`** (16px floor, non-negotiable for legibility)
  on `bg-surface`, with a 2px `accent` left rule. The serif is the store's voice —
  this is the deliberate departure. Chatbot answers are set in a sans everywhere
  else in the world; here the answer reads as the shop speaking.

### C2. The answer is stamped

Every answer that touches catalog stock carries a `StampBadge` derived from the
**query result, not the model's prose**: `IN STOCK` (positive), `PRE-ORDER`
(pending), `NOT IN CATALOGUE` (negative). No new primitives.

Two reasons this is correct and not decoration:

1. It makes stock state scannable. Today it is buried mid-sentence in generated
   prose the user has to read carefully.
2. The stamp is the *grounded* half of the response. It comes from the database
   query; the sentence beside it is a friendly wrapper around the same fact. Where
   they could disagree, the stamp is the one to trust.

This is a real commitment: the stamp is the suite's trust signal, so a wrong stamp
damages it in Products A and B too. It is only ever rendered from query data — never
inferred from model output.

### C3. The wait is the bookseller looking it up

Lookups take 20-30s. Today that is one line of `text-ink/50` and a rotating message.
Keep the rotating copy and its accessibility handling exactly as built — the visible
line is `aria-hidden`, with a single `sr-only` polite announcement at the start, so
screen readers are not re-interrupted every 4s. That is correct; do not regress it.

Change only the shape: render a **dashed-border placeholder in the answer's exact
geometry**, faintly pulsing, where the answer will land. When the answer arrives, the
stamp drops onto it with the 250ms overshoot defined under Motion. Zero layout shift,
because the placeholder is already the answer's shape.

### C4. Results hand over the book

Currently a `flex` row of 56px-wide covers with 10px truncated titles — decoration
pretending to be information. At that size a cover is unreadable.

Cap at **3 results**, each a row: cover at 64×96 via `CardImage`, title in Fraunces
`text-lg`, author in Inter `text-sm text-ink/60`, stock stamp, linking into Product
A's product drawer. The bookseller does not gesture at a shelf; they hand you the
book.

### C5. One empty state

`chat-widget.tsx`'s `CoverThumb` hand-rolls a `bg-ink/5` grey box with 9px text.
Replace it with `<CardImage aspect="portrait">`. There is one placeholder in this
system and it is branded.

### C6. Tabs

The existing tablist is correct and stays: roving `tabIndex`, arrow/Home/End keys,
`aria-selected`, and **all three panels stay mounted** toggled with `hidden` — the
chat panel holds conversation state and an in-flight answer that a 20-30s wait makes
easy to lose. Do not switch to conditional rendering.

---

## Product D — Marketing Content Generator

Staff-only, `is_staff()`-gated. A note plus an optional title or event goes in; an
Instagram caption, newsletter blurb, shelf-card line, and a rendered image come out.

**The reading:** D is the bookseller *writing the shelf card*. But it is a tool used
repeatedly by one person — **charm here is friction.** D gets the operational half of
the system: density, mono, and one signature moment rather than a charming interface.

### D1. Copy buttons on every output — the highest-value change in either product

D generates text whose entire purpose is to be pasted into Instagram and a newsletter
tool, and there is currently **no way to copy it** except dragging a selection by
hand. Every output gets a copy affordance, top-right: ghost button, IBM Plex Mono
uppercase 10px, `COPY` → `COPIED` in `accent` for 1.5s, then back. Uses the existing
`transition-transform duration-150` idiom.

### D2. Four outputs are not four identical cards

Today Instagram, Newsletter, Staff pick card, and the image all render as the same
`rounded-lg border-ink/10 bg-surface p-4` box in a 4-up grid. They are not the same
kind of thing, and a quarter-width column is why the newsletter blurb reads cramped.
Style each as its destination:

- **Staff pick card** — D's signature moment. Renders as an actual shelf card:
  `bg-paper` (not `surface`), card proportion, dashed `gold` rules top and bottom,
  Fraunces title, mono attribution line. It should look like the card you would slot
  under a book on the shelf. This deliberately breaks the grid; it is the one place
  in a staff tool where that is earned.
- **Newsletter** — full width, below the others. It is long-form prose.
- **Instagram** — square-ish frame, with a live character count in mono against the
  platform limit.
- **Generated image** — its own frame, labelled as a proof.

### D3. One palette source

`generated-image.tsx` hardcodes a **third copy** of the palette because canvas cannot
read CSS custom properties — and it still carries the pre-fix `#B08D3F` gold. Two
required changes:

1. Export the hex values from a single shared module that both the canvas palette and
   the token declarations derive from, so the canvas cannot silently drift again.
2. **Drop `claret` from the rotation.** `#7A2E2E` is the error and destructive color;
   a marketing post rendered in it is a semantic mismatch. Four backgrounds
   (`accent`, `ink`, `gold`, `surface`) is enough variety.

The deterministic seeding (same headline always yields the same card) is correct and
stays — regenerating content for one book should not shuffle its colors.

### D4. Density

D keeps Inter and mono, tighter spacing than C, and the three form controls collapse
to one row on wide screens rather than three stacked full-width blocks. Staff use
this daily; every saved scroll is real.

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-30 | DESIGN.md rewritten as a design system doc; original build spec archived | ~60% of the file was a 30-hour roadmap and demo-day plan for a build that has shipped. Archived to `docs/archive/2026-08-30-original-build-spec.md`. |
| 2026-08-30 | Gold documented as `#8A6D28` | Doc said `#B08D3F`; code shipped the darkened value to pass WCAG AA where gold is a text color. The code was right. |
| 2026-08-30 | Dark mode documented (11 tokens + shadow restatement) | Fully implemented in `globals.css` and described nowhere. |
| 2026-08-30 | Memorable thing set: "the bookseller behind the counter" | C and D had no organizing idea, which is why they rendered as correct tokens with no personality. |
| 2026-08-30 | `StampBadge` extended into Product C, derived from query results only | Makes four products read as one app, and makes stock state scannable instead of buried in prose. Never rendered from model output. |
| 2026-08-30 | Chatbot answers set in Fraunces at a 16px floor | Deliberate category departure — the answer reads as the store speaking. Cost: slower scanning on long answers. |
| 2026-08-30 | Copy affordances required on all Product D outputs | Generated content exists to be pasted elsewhere; there was no way to copy it. |
| 2026-08-30 | Product D shelf card breaks the grid deliberately | One signature moment in an otherwise dense staff tool. |
| 2026-08-30 | `claret` removed from the generated-image palette | It is the error color; marketing posts should not render in it. |
| 2026-08-30 | Inter retained as body face despite being an overused default | Shipped across four products; the system's character lives in Fraunces. Recorded as a decision, not an oversight. |
| 2026-08-30 | Stock photography ruled out suite-wide (ISSUE-005 direction) | Real art per item or the branded `CardImage` placeholder. Mismatched decorative photos read as bugs. |
