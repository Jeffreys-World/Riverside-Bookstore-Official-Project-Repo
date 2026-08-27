# Plan — Solid customer login / signup (Product A) via Supabase Auth

**Branch:** main · **Scope:** Auth core + logged-in polish. Minimal blast radius — "don't break the app."
**Reverses:** TODOS.md 2026-08-26 "Sign-up stays without real customer auth" — deliberate, realigns with DESIGN.md §1.1.
**Framing (be honest in the PR):** a login *experience* + identity, **not a data-access boundary**.
No RLS change; the existing localStorage-`customer_id` path stays the working mechanism for every
non-account flow. Same data exposure as today; tracked as a TODO.

### The load-bearing idea

Signup and login resolve the customer's `customer_id` from the session and **write it to
`localStorage` (`saveCustomerId`)**. Checkout, events RSVP, blind-date, donate, and the cart already
read `loadCustomerId()` — so they keep working **with their server actions completely untouched**.
The session is an add-on for the account page + logout + hiding the ID field, not a refactor.

### Files

| Kind | Files |
|---|---|
| **NEW** | `supabase/migrations/0034_customer_auth.sql`, `lib/customer-auth.ts`, `app/product-a/login/page.tsx`, `scripts/backfill-customer-demo.mjs` |
| **REWRITE** | `app/product-a/signup/page.tsx` (cosmetic → real `signUp`) |
| **EDIT (auth-aware)** | `app/product-a/actions.ts` (+3 auth actions +`getMyCustomerIdAction`; `getAccountAction` resolves session-first), `app/product-a/account/account-view.tsx`, `app/product-a/account/page.tsx` |
| **GUARDED EDIT (additive, session-gated)** | `app/product-a/checkout/page.tsx`, `app/product-a/events/[id]/event-rsvp.tsx`, `app/site-nav.tsx`, `app/product-b/page.tsx` + `app/product-b/actions.ts` (drop `signOut()` on non-staff) |
| **CONTRACT** | `types/schema.ts`, `CLAUDE.md`, `types/supabase.ts` (regen) |
| **UNTOUCHED** | `checkoutAction`, `redeemBlindDateAction`, `donatePointsAction`, `app/product-a/events/actions.ts`, `components/cart-provider.tsx`, `lib/customer-id-storage.ts`, every RPC except the one new function |

Revised after eng review + outside-voice pass:
- RPC reads `auth.uid()` internally (like `is_staff()`), called via the **normal server client** — no service-role on customer paths (outside-voice #3/#4).
- Signup **auto-claims** an unclaimed localStorage `cust_XXXXX` → returning customers keep points + history (#1, the review missed it).
- `signUp` null-session return is handled (#6); `?next=` preserves the signup→checkout loop (#11); `cust_demo01` gets a backfill script (#13).

---

## 1. Goal

Create account with email + password, log in, log out. Logged in → every Product A flow uses the
session identity (no typing `cust_XXXXX`). Logged out → the existing localStorage-id path still works
(cust_demo01, voice kiosk, guests).

## 2. What already exists (reuse, do not rebuild)

| Need | Existing asset |
|---|---|
| `auth.uid()`-internal SECURITY DEFINER pattern, granted to `authenticated`, un-spoofable | `is_staff()` — `0018_staff_rbac.sql:36-49` |
| `signInWithPassword` / `signOut` server-action + redirect | `app/product-b/actions.ts` `signInAction` / `signOutAction` |
| Login page markup | `app/product-b/sign-in/page.tsx` |
| RLS-scoped server client for reads | `getServerClient()` (`lib/supabase-server.ts`) — the account read already uses it |
| `cust_` id shape (`cust_` + 8 hex of md5) | `create_customer()` — `0010` |
| localStorage id helpers | `lib/customer-id-storage.ts` `load/save/clearCustomerId` — keep for fallback |
| roster backfill script pattern | `scripts/backfill-staff-roster.mjs` |

## 3. Schema migration — `0034_customer_auth.sql`

```sql
alter table customers
  add column auth_user_id uuid unique references auth.users (id) on delete set null,
  add column email        text unique;                       -- UNIQUE per outside-voice

-- get_or_create_my_customer — reads auth.uid()/auth.jwt() INTERNALLY (same trust
-- model as is_staff(), 0018). Callable by the normal authenticated server client,
-- NOT service_role. p_claim: an unclaimed legacy cust_ id to adopt on first signup.
create or replace function get_or_create_my_customer(p_claim text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_id    text;
begin
  if v_uid is null then
    return null;                                             -- no session
  end if;
  if exists (select 1 from staff_users where user_id = v_uid) then
    return null;                                             -- staff: never mint a customer row
  end if;

  select customer_id into v_id from customers where auth_user_id = v_uid;
  if v_id is not null then
    return v_id;                                             -- already linked
  end if;

  -- adopt an unclaimed legacy id (knowing the id already WAS the access token,
  -- so claiming an unclaimed one is no weaker than the pre-auth model)
  if p_claim is not null and p_claim ~ '^cust_[a-zA-Z0-9]{5,}$' then
    update customers
       set auth_user_id = v_uid, email = coalesce(email, v_email)
     where customer_id = p_claim and auth_user_id is null;
    if found then
      return p_claim;
    end if;
  end if;

  -- mint fresh (create_customer()'s id shape)
  v_id := 'cust_' || substr(md5(gen_random_uuid()::text), 1, 8);
  insert into customers (customer_id, signup_date, reward_points, auth_user_id, email)
  values (v_id, current_date, 0, v_uid, v_email)
  on conflict (auth_user_id) do nothing;
  select customer_id into v_id from customers where auth_user_id = v_uid;  -- re-read on race
  return v_id;
end;
$$;

revoke execute on function get_or_create_my_customer(text) from public, anon;
grant  execute on function get_or_create_my_customer(text) to authenticated;
```

- `auth_user_id` nullable → every existing row (incl. `cust_demo01`) stays valid.
- `on delete set null` → deleting an auth user never cascade-deletes order history.
- `email unique` → no duplicate-email rows after an `auth.users` delete + re-signup.
- No change to `customers` RLS / `get_loyalty_balance` / `get_customer_orders` / `create_preorder`
  (voice kiosk keeps its `p_customer_id text` path). See §8.

## 4. New module — `lib/customer-auth.ts` (plain server-only module, NOT `"use server"`)

```
validatePassedId(passedId: string | null | undefined): string | null          // PURE — unit tested
  → CUSTOMER_ID_REGEX.test(passedId) ? passedId : null

resolveCustomerId(opts?: { passedId?: string; claimId?: string }): Promise<string | null>   // server-only
  const supabase = getServerClient()                    // normal RLS-scoped client
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return validatePassedId(opts?.passedId)
  const { data } = await supabase.rpc("get_or_create_my_customer", { p_claim: opts?.claimId ?? null })
  return (data as string | null) ?? null                 // null = staff session or DB error

authErrorMessage(error: { code?: string; message: string }): string           // PURE — unit tested
  prefer error.code ('user_already_exists' | 'invalid_credentials' | 'weak_password' | 'over_email_send_rate_limit')
  fall back to message substring, then a generic "Something went wrong — try again."
```

`validatePassedId` / `authErrorMessage` stay sync + outside `"use server"` (learning
`use-server-files-only-export-async`) so Vitest can cover them.

## 5. Auth flows — all server-action `<form action>` POSTs (match staff `signInAction`)

### Signup — `app/product-a/signup/page.tsx` (rewrite) + `customerSignUpAction(formData)`
```
{ email, password, next? }  (next carried as a hidden field from ?next=)
  → getServerClient().auth.signUp({ email, password })
      error → redirect(`/product-a/signup?error=${authErrorMessage(error)}${nextQS}`)
  → if !data.session:                       // "Confirm email" is ON in the project
       redirect(`/product-a/signup?pending=1`)   // page renders "check your email, then sign in"
  → resolveCustomerId({ claimId: <cookie/no-JS: read from a hidden field mirrored from localStorage> })
       // claimId is the localStorage cust_ id if present — auto-adopts it
  → redirect(next ?? "/product-a/account")
```
- The page reads `localStorage` on mount and writes it into a hidden `claim_id` input so the
  server action can adopt it (server has no localStorage access). No JS → no claim, mints fresh.
- Submit button uses `useFormStatus` for the "Creating your account…" pending state.
- Delete `signUpCustomerAction` + `create_customer()` usage from this page (old no-arg minter).
  Leave `create_customer()` in the DB (harmless, still referenced by nothing) or drop it in 0034 —
  **drop it** (nothing else calls it; grep-verified).

### Login — NEW `app/product-a/login/page.tsx` + `customerSignInAction(formData)` (mirror staff)
```
{ email, password, next? }
  → getServerClient().auth.signInWithPassword(...)
      error → redirect(`/product-a/login?error=${authErrorMessage(error)}${nextQS}`)
  → redirect(next ?? "/product-a/account")
```

### Logout — `customerSignOutAction()` in `app/product-a/actions.ts`
```
getServerClient().auth.signOut() → redirect("/product-a")
```
Note: shared cookie — for a user who is somehow both staff and customer, this ends both sessions.
Acceptable (that overlap shouldn't exist).

## 6. Wiring — auth-aware edits + guarded (session-gated) polish

### The bridge: `getMyCustomerIdAction()` in `app/product-a/actions.ts`
```
"use server"  →  Promise<string | null>   // just: return resolveCustomerId()
```
Every client component that has a session calls this once on mount and does
`saveCustomerId(id)` + `setCustomerId(id)`. That keeps `localStorage` in lockstep with the session,
so the **untouched** server actions (`checkoutAction`, `rsvpToEventAction`, `redeemBlindDateAction`,
`donatePointsAction`) keep receiving `customer_id` from the client exactly as today.

### Auth-aware edits
| File | Change |
|---|---|
| `app/product-a/actions.ts` | ADD `customerSignUpAction` / `customerSignInAction` / `customerSignOutAction` / `getMyCustomerIdAction`. MODIFY `getAccountAction(passedId?)`: `const id = await resolveCustomerId({ passedId })` (session wins, else validate the passed localStorage id — same reach as today); `null` → `{ ok:false, message:"Sign in, or enter your customer ID." }`; ok payload also returns `customerId` + `email`. |
| `app/product-a/account/account-view.tsx` | On mount: `getAccountAction(loadCustomerId() || undefined)`. On success `saveCustomerId(res.customerId)` + `activeIdRef.current = res.customerId`. Logged-in render: account + "signed in as {email}" + **Log out** (`<form action={customerSignOutAction}>`), no ID field. Logged-out (`ok:false`, no `initialSignedIn`): "Sign in / Create account" + keep the "Have a customer ID?" fallback loader. 20s poll + blind-date + donate unchanged — still pass `activeIdRef.current`. |
| `app/product-a/account/page.tsx` | `export const dynamic = "force-dynamic"`; server `auth.getUser()` → pass `initialSignedIn` so a logged-in user doesn't see a flash of the sign-in form. |
| `app/product-a/signup/page.tsx` | rewrite per §5. |

### Guarded polish (each change is behind `if (session)`, no-op when logged out)
| File | Change |
|---|---|
| `app/product-a/checkout/page.tsx` | mount: if `getBrowserClient().auth.getSession()` → `getMyCustomerIdAction()` → `saveCustomerId` + `setCustomerId`, **hide** the `customer_id` input (value still submitted). Logged out → field unchanged. `?next=/product-a/checkout` on the "Create an account" link. `checkoutAction` **untouched**. |
| `app/product-a/events/[id]/event-rsvp.tsx` | same session-gated hide + `getMyCustomerIdAction` sync; `?next=` on the signup link. `rsvpToEventAction` / `getExistingTicketAction` **untouched**. |
| `app/site-nav.tsx` | `useCustomerSession()` — `getBrowserClient().auth.getSession()` + `onAuthStateChange` (plain listener, no realtime socket). "My Account" dropdown: logged out → Sign in / Create account / Staff Account; logged in → Your account / Log out / Staff Account. 1-frame label flash accepted (SSR-reading would force the whole layout dynamic). |
| `app/product-b/page.tsx` + `signInAction` | **Drop `supabase.auth.signOut()` in the non-staff branch** (A1). Redirect a non-staff session to `/product-a`. `is_staff()` still re-checked every load — roster-revoke still denies the dashboard, it just stops nuking an unrelated customer session. |

## 7. Config / contract updates (own commits)

- **`supabase/config.toml`** — the repo has none. The `signUp` null-session guard in §5 means the
  code is correct whether "Confirm email" is on or off, so committing a config.toml is **optional**;
  if added, set `[auth.email] enable_confirmations = false` and re-verify local dev. Recommended:
  keep it a documented dashboard setting + rely on the code guard (smaller blast radius).
- `types/schema.ts` — `Customer` gains `auth_user_id: string | null`, `email: string | null`.
  New `customerCredentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) })`.
- `CLAUDE.md` "Strict Data Contract" — add the two columns.
- `npx supabase gen types typescript --local > types/supabase.ts`.
- `scripts/backfill-customer-demo.mjs` — create an auth user for `cust_demo01`
  (`admin.createUser({ email, password, email_confirm: true })`) and set its `auth_user_id`, so the
  seeded demo account with real order history is usable in logged-in demos + E2E.

## 8. NOT in scope (deferred)

| Deferred | Why / consequence |
|---|---|
| `middleware.ts` session refresh | Decision. `getServerClient` swallows Server-Component cookie writes (staff does too). Consequence: a session expiring mid-visit doesn't refresh until the next Server Action — read-only staleness for one navigation. → TODO. |
| RLS tightening (`get_loyalty_balance` / `get_customer_orders` → `auth.uid()`) | Decision. Consequence: knowing a `cust_id` still reads that account's orders/points via the anon RPC. Pre-existing; not worsened. → TODO. |
| `checkoutAction` / RSVP actions stay client-`customer_id` | Untouched by design (blast radius). An unauth caller can still place orders / earn points / decrement stock for an arbitrary `cust_id` — pre-existing, not worsened. Folded into the RLS TODO. |
| Password reset / "forgot password" | Not requested. `resetPasswordForEmail` when wanted. |
| `/product-a/auth/callback` route | Not needed — the `signUp` null-session guard renders a "check your email then sign in" state; the confirm link just confirms, user logs in normally. |
| Migrating the voice kiosk to sessions | It's server-to-server; keeps the `p_customer_id text` RPC path. |

## 9. Failure modes (new codepaths)

| Codepath | Realistic failure | Test | Handled | User sees |
|---|---|---|---|---|
| `customerSignUpAction` → `signUp` ok, no session | "Confirm email" on | manual | yes — `?pending=1` state | "Check your email to confirm, then sign in." |
| `signUp` email exists | duplicate | `authErrorMessage` unit | yes | "That email's already registered. Sign in." + link |
| `signInWithPassword` bad creds | typo | `authErrorMessage` unit | yes | "Invalid email or password." |
| `get_or_create_my_customer` — session but RPC errors | DB blip | — | `resolveCustomerId` → null → `{ok:false}` | "Sign in to view your account." (no crash) |
| `get_or_create_my_customer` — staff session | shared cookie, staff on Product A | manual | RPC returns null; resolver returns null; account shows logged-out state | Staff sees the customer sign-in prompt, no stray `customers` row |
| signup auto-claim — `p_claim` already claimed by someone else | user typed/had a foreign id | manual | `where auth_user_id is null` guard → no-op → mints fresh | new empty account (correct) |
| session expires mid-visit, no middleware | stale session | — | **no** — silent for one navigation, self-corrects on next action | possibly stale account view once |
| logout in tab A | multi-tab | manual | `onAuthStateChange` updates tab B nav | nav flips to logged-out |
| `/product-a/account` first paint, logged-in | SSR shell | manual | `initialSignedIn` prop | account, not a flash of the sign-in form |

**Critical-gap check:** "session expires mid-visit" is silent + untested + unhandled, but low
severity (read-only, one navigation, self-corrects) and it's the stated cost of the no-middleware
decision. Noted, not blocking. No other silent+unhandled+untested path.

## 10. Tests

**Unit (Vitest — matches repo):**
- `lib/customer-auth.test.ts` — `validatePassedId`: valid id passes; bad id → null; null/undefined → null.
- `lib/customer-auth.test.ts` — `authErrorMessage`: each known `code` → friendly copy; unknown → generic.
- `types/schema.regression-*.test.ts` — `customerCredentialsSchema`: rejects bad email + `<8` password; accepts valid.

**Manual E2E (test-plan artifact for `/qa`, since the repo has no E2E framework):**
1. Signup (fresh email, no localStorage id) → logged in, fresh `cust_` row linked.
2. Signup while a valid unclaimed `cust_demo01`-style id is in localStorage → **that** row is adopted
   (points + history preserved), account shows the pre-existing balance.
3. Log out → nav flips; `/account` shows Sign in / Create account.
4. Log in → account loads with correct points + orders.
5. Logged-in checkout → no `customer_id` field; pre-order attributed to the session customer; shows on staff dashboard + order history.
6. Logged-in events RSVP → no ID field; ticket attributed to the session customer.
7. **Regression:** logged-out, type `cust_demo01` at checkout → still works (fallback intact).
8. Signup with an already-registered email → friendly error + login link, no orphan row.
9. Logged-in customer clicks "Staff Account" → lands on `/product-a` (or staff sign-in), **still logged in on Product A**.
10. Blind-date redeem + donate points while logged in → no ID entry.
11. Signup→checkout loop: from checkout, click "Create an account", finish signup → land back on checkout (`?next=`).
12. 375px mobile + `prefers-reduced-motion` on the new `/login` and rewritten `/signup`.

## 11. Build order (sequential — one dev, one context)

1. **Spine:** `0034_customer_auth.sql` (push + verify with `npx supabase gen types`), `types/schema.ts` + `CLAUDE.md`, `lib/customer-auth.ts` (+ its unit tests).
2. **Auth actions + pages:** the 4 actions in `app/product-a/actions.ts`, `/login` page, `/signup` rewrite. Manual check: signup → account, login, logout.
3. **Account page:** `account-view.tsx` + `account/page.tsx` session-aware. Manual check: logged-in vs logged-out render, auto-claim (test 2), Log out.
4. **Guarded polish:** `checkout/page.tsx`, `event-rsvp.tsx`, `site-nav.tsx`, `product-b/page.tsx`. Each behind `if (session)`; verify logged-out behaviour is byte-identical to before.
5. **Demo:** `scripts/backfill-customer-demo.mjs`, run once.
6. `npm run lint && npx tsc --noEmit && npx vitest run && npm run build` (not while `npm run dev` is up — learning `next-build-vs-dev-next-dir-collision`).

## 12. Design decisions (from /plan-design-review — 6/10 → 9/10)

Everything not listed here = **apply the existing system**: page shell `<main className="mx-auto
max-w-md px-6 py-16">`, H1 `font-serif text-3xl text-ink`, subtitle `mt-2 text-ink/70`, label
`block text-sm font-medium text-ink`, input `mt-1 block min-h-[44px] w-full rounded-md border
border-ink/20 bg-field px-3 py-2 text-ink`, primary btn `min-h-[44px] rounded-md bg-accent px-6
py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:opacity-50
disabled:hover:scale-100`, secondary btn same shape with `border border-ink/20 text-ink` and no
fill, error `role="alert"` `rounded-md border border-claret/30 bg-claret-soft p-3 text-sm
text-claret`, success `role="status"` `border-accent/30 bg-accent-soft ... text-ink`, link
`text-accent underline-offset-2 hover:underline`. All tokens are CSS-var-backed → dark mode is
automatic, no `dark:` variants. Global `:focus-visible` outline already covers new controls.

### `/product-a/login` — clone `/product-b/sign-in` exactly
Same `max-w-sm` shell, same two-field form, same `claret-soft` error banner reading
`searchParams.error`. Only differences: H1 "Sign in", subtitle "Welcome back to Riverside Books.",
submit button `useFormStatus` → "Signing in…", and a footer line
`Need an account? <Link>Create one</Link>` → `/product-a/signup` (carry `?next=`). No "ask the
owner" copy.

### D1 — Email-pending state · `/product-a/signup?pending=1`
Reuse the signup page's existing full-page `result.kind === "success"` card layout.
- H1 `font-serif text-3xl text-ink`: **"Check your email"**
- `mt-4 text-ink/70`: "We sent a confirmation link to **{email}**. Open it to finish setting up
  your account, then sign in."
- `mt-2 text-sm text-ink/60`: "The link expires in 24 hours. No email? Check your spam folder."
- Buttons row (`mt-8 flex flex-wrap gap-3`): primary `<Link href="/product-a/login">` **"Go to sign in"**;
  secondary `<Link href="/product-a/signup">` "Use a different email".
- Only renders when the Supabase project has "Confirm email" ON. With it OFF (recommended) signup
  redirects straight to `/account` and this state is unreachable — that's the intended guard, not dead weight.
- Resend-confirmation button: **deferred** (needs its own action + rate-limit copy). Note in-plan.

### D2 — Auto-claim outcome · `/product-a/account?welcome=claimed`
`customerSignUpAction` computes `const claimed = !!claimId && resolvedId === claimId` (no RPC
signature change) and redirects `…/account?welcome=claimed` on the claim path, plain `…/account`
otherwise.
- **claimed:** `account/page.tsx` renders a one-time `role="status"` banner above the tabs,
  `rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-ink`:
  "Welcome back — we linked your existing Riverside account. Your **{rewardPoints} points** and
  order history are here." (rewardPoints from the same load). Banner is not dismissible; it's gone
  on the next navigation (keyed purely on the query param, server-rendered).
- **new account:** no banner. The account page's existing "0 points" + "No orders yet — add a
  title to your cart to start earning rewards." already reads as a clean first-run state. Adding a
  "welcome!" banner there is noise (nothing was at stake).

### D3 — Logged-out account page — one primary path, ID recovery demoted
Replaces the current logged-out block (which frames "Sign in" as *load-by-ID* — now wrong).
```
Sign in to see your points and order history.        ← text-ink/70

[ Sign in ]   [ Create account ]                     ← flex flex-col sm:flex-row gap-3
                                                        primary bg-accent / secondary border

──────────────  Have an account from before?  ──────────────   ← my-8, text-xs text-ink/40, hr flex-1 each side

<details> Enter your customer ID                     ← secondary, collapsed by default
  [ cust_XXXXX ]  [ View ]                             summary is text-sm text-ink/70
  Signing up with your email links this ID to a login.  ← text-xs text-ink/50 helper
</details>
```
The `<details>` keeps the legacy path reachable (cust_demo01, mid-transition visitors) without it
competing visually with the real auth CTAs. Native `<details>` = keyboard/SR accessible for free
(see learning `browse-tool-stale-refs-and-snapshot-artifacts` — snapshot tools miss it, but it's fine).

### D4 — Checkout / RSVP after the ID field is hidden
When `session` present, the `customer_id` `<div>` (label + input + "New customer?" link) is
replaced by one line, not removed silently:
- checkout: `<p className="text-sm text-ink/60">Reserving as <span className="text-ink">{email}</span>.</p>`
- RSVP: `…RSVPing as <span className="text-ink">{email}</span>.`
- A hidden `<input type="hidden" name="customer_id" value={customerId}>` stays so the untouched
  server action still receives it. `email` comes from the `getSession()` the mount effect already runs.
- No "not you? / switch account" action inline — logout lives in the nav and on the account page;
  adding a third spot is clutter (subtraction default).

### Consistency touch-ups
- `account-view` "Signed in as `cust_XXXXX`" bar (shipped last commit) → **"Signed in as
  {email}"**, with `cust_XXXXX` kept underneath in `font-mono text-xs text-ink/40` (support still
  asks for the ID).
- `site-nav` "My Account" dropdown: logged-in items get the account email as a non-interactive
  `text-xs text-ink/40` header row above "Your account / Log out" (matches how the dropdown already
  groups items). Logged-out: "Sign in / Create account / Staff Account".
- New submit buttons all use `useFormStatus` for pending text — the current signup page's
  `disabled` + "Creating your account…" behaviour must not regress in the `<form action>` rewrite.

### Pre-existing gap flagged (not caused by this plan, solo repo → saying so)
`app/globals.css` has **no `@media (prefers-reduced-motion: reduce)`** guard, so the app-wide
`hover:scale-105/125` + `transition-transform` (commit b82eb27) ignore the setting. The new auth
screens inherit the same classes — consistently un-guarded. One 3-line `@layer base` block in
`globals.css` would fix it app-wide. → suggest a follow-up TODO, out of scope here.

## Implementation Tasks
Synthesized from this review's findings. Run with Claude Code; checkbox as you ship.

- [x] **T1 (P1, human: ~1h / CC: ~10min)** — schema — `0034_customer_auth.sql`: `customers.auth_user_id` + `email` (nullable, unique) + `get_or_create_my_customer(p_claim)` SECURITY DEFINER reading `auth.uid()`/`auth.jwt()` internally, granted to `authenticated`, revoked from `anon`/`public`
  - Surfaced by: Architecture #4 + outside-voice #3/#4/#5
  - Files: `supabase/migrations/0034_customer_auth.sql`, `types/supabase.ts`
  - Verify: `npx supabase gen types typescript --local` clean; call the RPC as anon → denied
- [x] **T2 (P1, human: ~45min / CC: ~8min)** — lib — `lib/customer-auth.ts`: `validatePassedId` (pure), `resolveCustomerId` (normal server client), `authErrorMessage` (pure, prefer `error.code`) + unit tests
  - Surfaced by: Test review; learning `use-server-files-only-export-async`
  - Files: `lib/customer-auth.ts`, `lib/customer-auth.test.ts`
  - Verify: `npx vitest run lib/customer-auth.test.ts`
- [x] **T3 (P1, human: ~2.5h / CC: ~22min)** — product-a auth — 3 server actions + `getMyCustomerIdAction`; rewrite `/signup`; new `/login` (clone `/product-b/sign-in`); form-action POSTs, `useFormStatus`, `?next=`, `signUp` null-session guard + **D1 email-pending state**, auto-claim + **D2 `?welcome=claimed` redirect**
  - Surfaced by: outside-voice #6/#11/#12; design D1/D2
  - Files: `app/product-a/actions.ts`, `app/product-a/signup/page.tsx`, `app/product-a/login/page.tsx`
  - Verify: manual — signup→account, logout, login, already-registered email, pending state (confirmations on), claim banner
- [x] **T4 (P1, human: ~2h / CC: ~17min)** — product-a account — `getAccountAction` session-first (returns `customerId`+`email`); `account-view` session-aware per **D3** (Sign in / Create account primary, `<details>` ID-recovery secondary, "Signed in as {email}" + `cust_` underneath, Log out); `account/page.tsx` dynamic + `initialSignedIn` + **D2 claimed banner**
  - Surfaced by: Architecture A2/A4 + outside-voice #1/#9; design D2/D3
  - Files: `app/product-a/actions.ts`, `app/product-a/account/account-view.tsx`, `app/product-a/account/page.tsx`
  - Verify: manual test 2 (auto-claim preserves points), logged-out layout (one primary path), fallback loader still works
- [x] **T5 (P2, human: ~1h / CC: ~12min)** — product-a polish — session-gated hide of the `customer_id` field at checkout + event-rsvp, replaced by **D4** "Reserving/RSVPing as {email}" line + hidden input; sync via `getMyCustomerIdAction` + `saveCustomerId`; `?next=` on signup links. `checkoutAction` / `rsvpToEventAction` untouched
  - Surfaced by: re-scope (additive logged-in polish); design D4
  - Files: `app/product-a/checkout/page.tsx`, `app/product-a/events/[id]/event-rsvp.tsx`
  - Verify: logged-out checkout byte-identical to before; logged-in shows the email line, order still attributed
- [x] **T6 (P2, human: ~45min / CC: ~10min)** — chrome — `site-nav` `useCustomerSession`; `product-b/page.tsx` + `signInAction` drop `signOut()` on non-staff, redirect to `/product-a`
  - Surfaced by: Architecture A1 + outside-voice (stranded session)
  - Files: `app/site-nav.tsx`, `app/product-b/page.tsx`, `app/product-b/actions.ts`
  - Verify: manual test 9 — customer clicks Staff Account, still logged in on Product A
- [x] **T7 (P2, human: ~30min / CC: ~5min)** — contract — `types/schema.ts` `Customer` + `customerCredentialsSchema` + regression test; `CLAUDE.md` data contract; regen `types/supabase.ts`
  - Surfaced by: strict data contract gains 2 columns
  - Files: `types/schema.ts`, `types/schema.regression-2.test.ts`, `CLAUDE.md`
  - Verify: `npx tsc --noEmit`, `npx vitest run`
- [x] **T8 (P3, human: ~20min / CC: ~5min)** — demo — `scripts/backfill-customer-demo.mjs`: auth user for `cust_demo01`
  - Surfaced by: outside-voice #13
  - Files: `scripts/backfill-customer-demo.mjs`
  - Verify: log in as the demo account, see its seeded order history

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (optional) |
| Outside Voice | Claude subagent | Independent 2nd opinion | 1 | issues_found | 13 findings; #1 (loyalty-ledger loss) + #4 (auth.uid() RPC) folded in, rest addressed or deferred |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open→resolved | 8 issues (3 arch, 2 code-quality, 3 plan-precision); 0 critical gaps; scope reduced twice |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | 6/10 → 9/10 | 4 unspecified UI states (D1 email-pending, D2 auto-claim messaging, D3 logged-out account layout, D4 hidden-field confirmation) — all now specced in §12; text-only pass, no mockups (applying an existing system) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run (optional) |

- **CROSS-MODEL:** The outside voice caught the one thing the eng review missed — existing
  customers orphaning their loyalty ledger on signup (#1). Resolved with auto-claim of an unclaimed
  localStorage `cust_` id. It also argued the RPC should read `auth.uid()` internally like
  `is_staff()` (#4) rather than taking caller-supplied params + service-role — folded in, it
  simplifies the plan and removes a service-role call site. Its "go lighter, no GoTrue" case (#8)
  was put to the user, who had already chosen Supabase Auth twice and confirmed the reduced
  "auth core + logged-in polish" scope instead.
- **DESIGN:** 6/10 → 9/10. Most screens are "apply the existing system" (login = clone
  `/product-b/sign-in`). The 4 new states are now specced against real tokens in §12. One
  pre-existing gap flagged for a follow-up TODO: `globals.css` has no `prefers-reduced-motion`
  guard, so app-wide `hover:scale` transitions ignore the setting (not introduced by this plan).
- **VERDICT:** ENG + DESIGN CLEARED (scope reduced, 0 critical gaps, 0 unresolved) — ready to
  implement. CEO review not needed (realigns with the existing spec, no new product direction).

NO UNRESOLVED DECISIONS
