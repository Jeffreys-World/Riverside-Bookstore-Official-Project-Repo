"use server";

/**
 * Product A's Server Actions. Mutations (checkoutAction) go through
 * getServiceRoleClient() per lib/supabase.ts's rule, since create_preorder
 * isn't anon-grantable — the browser never calls Supabase directly for
 * those, matching app/api/live/execute-tool/route.ts's pattern for the
 * same create_preorder RPC. Reads (getAccountAction) and the customer
 * auth flow use the regular server client instead.
 */

import { redirect } from "next/navigation";
import { getServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import { checkoutRequestSchema, customerCredentialsSchema } from "@/types/schema";
import {
  EMAIL_ALREADY_REGISTERED,
  authErrorMessage,
  isExistingUserSignUp,
  validatePassedId,
} from "@/lib/customer-auth";
import {
  resolveCustomer,
  resolveCustomerId,
  resolveMutationCustomerId,
} from "@/lib/customer-session";
import type { SupabaseClient } from "@supabase/supabase-js";

// Only allow same-site redirects back into Product A after sign-in /
// sign-up, so a crafted ?next= can't bounce a freshly-authenticated
// visitor to an external URL.
function sanitizeNext(next: string): string {
  return /^\/product-a(\/|\?|$)/.test(next) ? next : "";
}

async function placeSingleOrder(
  supabase: SupabaseClient,
  args: {
    customer_id: string;
    isbn: string;
    quantity: number;
    pickup_date: string;
    pickup_window: string;
  }
): Promise<{ ok: true; orderId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("create_preorder", {
    p_customer_id: args.customer_id,
    p_isbn: args.isbn,
    p_quantity: args.quantity,
    p_pickup_date: args.pickup_date,
    p_pickup_window: args.pickup_window,
  });

  if (error) {
    // create_preorder raises two distinct INSUFFICIENT_STOCK messages
    // (see supabase/migrations/0011_loyalty_stamps.sql) — surface each as
    // its own copy rather than one generic "order failed" message.
    if (error.message.includes("has not been inventoried yet")) {
      return {
        ok: false,
        message: "hasn't been inventoried yet — a bookseller can check current stock in person.",
      };
    }
    const shortage = error.message.match(/only (\d+) of/);
    if (shortage) {
      return { ok: false, message: `only ${shortage[1]} left in stock.` };
    }
    // A well-formed but nonexistent customer_id violates the
    // orders.customer_id FK (0001) — retrying never helps, so say what's
    // actually wrong instead of the generic message.
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        message: "we couldn't find that customer ID — check it, or create an account.",
      };
    }
    return { ok: false, message: "something went wrong placing this item. Please try again." };
  }

  return { ok: true, orderId: data as string };
}

export interface CheckoutLineResult {
  isbn: string;
  ok: boolean;
  orderId?: string;
  message?: string;
}

export type CheckoutResult =
  | { ok: true; lines: CheckoutLineResult[]; rewardPoints: number | null }
  | { ok: false; message: string };

/**
 * The cart drawer's multi-item checkout. Loops create_preorder once per
 * line item — sequentially, not Promise.all, so a shared customer_id's
 * reward_points increments don't race against each other — rather than a
 * single whole-cart RPC: each item keeps its own atomic stock check
 * (SELECT FOR UPDATE per row already), and one sold-out item doesn't fail
 * the rest of the cart, it just reports its own failure alongside the
 * others' successes.
 */
export async function checkoutAction(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check your cart, customer ID, and pickup time, then try again." };
  }
  const { customer_id: passedId, items, pickup_date, pickup_window } = parsed.data;

  // A session, when there is one, decides whose account this reserves
  // against — the id the browser sent is only trusted signed out.
  const identity = await resolveMutationCustomerId(passedId);
  if (!identity.ok) return { ok: false, message: identity.message };
  const customer_id = identity.customerId;

  const supabase = getServiceRoleClient();
  const lines: CheckoutLineResult[] = [];
  for (const item of items) {
    const result = await placeSingleOrder(supabase, {
      customer_id,
      isbn: item.isbn,
      quantity: item.quantity,
      pickup_date,
      pickup_window,
    });
    lines.push(
      result.ok
        ? { isbn: item.isbn, ok: true, orderId: result.orderId }
        : { isbn: item.isbn, ok: false, message: result.message }
    );
  }

  // Nothing was reserved — don't hand the client an ok:true it will
  // render as a "pickup arranged" success screen.
  if (lines.length > 0 && lines.every((l) => !l.ok)) {
    const only = lines[0]?.message ?? "";
    const allSameReason = lines.every((l) => l.message === only);
    let message: string;
    if (allSameReason && /customer id/i.test(only)) {
      // Every line failed for the same account-level reason — lead with it.
      message = only.charAt(0).toUpperCase() + only.slice(1);
    } else if (lines.length === 1 || allSameReason) {
      message = `That couldn't be reserved — ${only}`;
    } else {
      message = "None of your items could be reserved — check availability and try again.";
    }
    return { ok: false, message };
  }

  // Best-effort: surface the fresh stamp count alongside the confirmation.
  // Each successful create_preorder call already incremented it — this is
  // just a read, so a failure here must not undo or hide the order(s).
  const { data: balance } = await supabase.rpc("get_loyalty_balance", {
    p_customer_id: customer_id,
  });

  return { ok: true, lines, rewardPoints: typeof balance === "number" ? balance : null };
}

// ---------------------------------------------------------------------------
// Customer auth (0034_customer_auth.sql). Email + password via Supabase
// Auth — the same GoTrue machinery the staff side already uses
// (app/product-b/actions.ts), minus the staff_users gate. These run
// through the normal server client so the session cookie is written from
// a real Server Action (getServerClient's set() only works here, not from
// a Server Component). The page-level actions redirect rather than
// return — matching signInAction on the staff side — while the inline
// variants below return state for useActionState.
// ---------------------------------------------------------------------------

/**
 * Turn a Supabase Auth session into a customer_id for a client component
 * (checkout, events RSVP, account) that can't call resolveCustomerId
 * directly (it imports next/headers). Returns null when signed out or for
 * a staff session.
 */
export async function getMyCustomerIdAction(): Promise<string | null> {
  return resolveCustomerId();
}

/**
 * Both auth flows are written as a `*Core` that returns where it wants to
 * go, then wrapped twice: the redirecting action the dedicated /login and
 * /signup pages post to, and an `*InlineAction` (useActionState) the
 * account page's embedded tabs use — so a mistyped password there shows
 * an error in place instead of bouncing the visitor to another page.
 */
type AuthCoreResult =
  | { kind: "done"; redirectTo: string }
  | { kind: "error"; message: string };

type SignUpCoreResult = AuthCoreResult | { kind: "pending"; email: string };

/**
 * useFormState shape for the account page's embedded auth forms. Success
 * comes back as `redirectTo` for the client to navigate rather than a
 * redirect() from inside the action: React throws "cannot update a
 * component while rendering a different component" and blanks the page
 * when a useFormState action redirects (Next 14 + React 18.3), and here
 * the destination is usually the account page the visitor is already on,
 * which just needs re-resolving.
 */
export interface AuthFormState {
  error?: string;
  notice?: string;
  redirectTo?: string;
}

function nextQueryString(formData: FormData): string {
  const next = sanitizeNext(String(formData.get("next") ?? ""));
  return next ? `&next=${encodeURIComponent(next)}` : "";
}

async function signInCore(formData: FormData): Promise<AuthCoreResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? ""));

  const supabase = getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { kind: "error", message: authErrorMessage(error) };
  return { kind: "done", redirectTo: next || "/product-a/account" };
}

/**
 * supabase.auth.signUp mints the auth user; resolveCustomerId then links a
 * customers row — adopting an unclaimed localStorage cust_XXXXX (claim_id,
 * mirrored into a hidden field by the signup page) so a returning customer
 * keeps their points + order history. If the project has "Confirm email"
 * on, signUp returns no session and this reports `pending` rather than a
 * broken-looking account page.
 */
async function signUpCore(formData: FormData): Promise<SignUpCoreResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? ""));
  const claimId = validatePassedId(String(formData.get("claim_id") ?? ""));

  const parsed = customerCredentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Check your email and password.",
    };
  }

  const supabase = getServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { kind: "error", message: authErrorMessage(error) };

  if (!data.session) {
    // With "Confirm email" ON, GoTrue answers a duplicate sign-up with a
    // session-less, obfuscated user and no error — which would tell an
    // existing customer to open a confirmation link that never arrives.
    // Send them to sign in instead.
    if (isExistingUserSignUp(data)) return { kind: "error", message: EMAIL_ALREADY_REGISTERED };
    return { kind: "pending", email: parsed.data.email };
  }

  const customerId = await resolveCustomerId({ claimId });
  const claimed = Boolean(claimId) && customerId === claimId;

  // The "welcome back, we linked your account" banner only makes sense on
  // the account page; a ?next= redirect (mid-checkout) skips it.
  if (!next && claimed) return { kind: "done", redirectTo: "/product-a/account?welcome=claimed" };
  return { kind: "done", redirectTo: next || "/product-a/account" };
}

export async function customerSignInAction(formData: FormData) {
  const result = await signInCore(formData);
  if (result.kind === "error") {
    redirect(
      `/product-a/login?error=${encodeURIComponent(result.message)}${nextQueryString(formData)}`
    );
  }
  redirect(result.redirectTo);
}

/** Sign in without leaving the page — the account screen's "Sign in" tab. */
export async function customerSignInInlineAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const result = await signInCore(formData);
  if (result.kind === "error") return { error: result.message };
  return { redirectTo: result.redirectTo };
}

export async function customerSignOutAction() {
  const supabase = getServerClient();
  await supabase.auth.signOut();
  redirect("/product-a");
}

export async function customerSignUpAction(formData: FormData) {
  const result = await signUpCore(formData);
  if (result.kind === "error") {
    redirect(
      `/product-a/signup?error=${encodeURIComponent(result.message)}${nextQueryString(formData)}`
    );
  }
  if (result.kind === "pending") {
    redirect(`/product-a/signup?pending=1&email=${encodeURIComponent(result.email)}`);
  }
  redirect(result.redirectTo);
}

/** Create an account without leaving the page — the account screen's "Create account" tab. */
export async function customerSignUpInlineAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const result = await signUpCore(formData);
  if (result.kind === "error") return { error: result.message };
  if (result.kind === "pending") {
    return {
      notice: `Almost there — open the confirmation link we sent to ${result.email}, then sign in.`,
    };
  }
  return { redirectTo: result.redirectTo };
}

export type RedeemBlindDateResult =
  | { ok: true; orderId: string; isbn: string; bookTitle: string }
  | { ok: false; message: string };

/**
 * "Blind Date with a Book" — spends BLIND_DATE_POINTS_COST points
 * (types/schema.ts) on a random in-stock title via redeem_blind_date()
 * (0030_loyalty_program_expansion.sql), which mints a real preorder. Same
 * server-only mutation pattern as checkoutAction: the RPC isn't granted
 * to anon, so this must run through the service-role client. Whose
 * points get spent is decided by resolveMutationCustomerId, not by the
 * id account-view passes in — a session always outranks it.
 */
export async function redeemBlindDateAction(passedId: string): Promise<RedeemBlindDateResult> {
  const identity = await resolveMutationCustomerId(passedId);
  if (!identity.ok) return { ok: false, message: identity.message };
  const customerId = identity.customerId;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .rpc("redeem_blind_date", { p_customer_id: customerId })
    .single();

  if (error || !data) {
    if (error?.message.includes("INSUFFICIENT_POINTS")) {
      return { ok: false, message: "Not enough points yet for a Blind Date with a Book." };
    }
    if (error?.message.includes("NO_BOOKS_AVAILABLE")) {
      return { ok: false, message: "No titles are currently in stock for a mystery pick." };
    }
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const row = data as { order_id: string; isbn: string; book_title: string };
  return { ok: true, orderId: row.order_id, isbn: row.isbn, bookTitle: row.book_title };
}

export type DonatePointsResult = { ok: true; pointsDonated: number } | { ok: false; message: string };

/**
 * Symbolic-only "donate my points" gesture (0030_loyalty_program_expansion.sql's
 * donate_points()) — donates the entire current balance in one action, no
 * partial-amount input. Same service-role pattern, and the same
 * session-first identity check, as the points-spending action above.
 */
export async function donatePointsAction(passedId: string): Promise<DonatePointsResult> {
  const identity = await resolveMutationCustomerId(passedId);
  if (!identity.ok) return { ok: false, message: identity.message };
  const customerId = identity.customerId;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("donate_points", { p_customer_id: customerId });

  if (error || data === null) {
    if (error?.message.includes("NO_POINTS_TO_DONATE")) {
      return { ok: false, message: "You don't have any points to donate right now." };
    }
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  return { ok: true, pointsDonated: data as number };
}

export interface AccountOrder {
  order_id: string;
  isbn: string;
  book_title: string;
  cover_url: string | null;
  quantity: number;
  order_status: string;
  pickup_date: string | null;
  pickup_window: string | null;
  created_at: string;
}

export type GetAccountResult =
  | { ok: true; customerId: string; email: string | null; rewardPoints: number; orders: AccountOrder[] }
  | { ok: false; message: string };

/**
 * Product A's "My Account" page. Prefers the Supabase Auth session
 * (0034_customer_auth.sql); falls back to a client-passed cust_XXXXX from
 * localStorage when signed out (cust_demo01, mid-transition visitors).
 * Both underlying RPCs (get_loyalty_balance, get_customer_orders —
 * 0013_customer_order_history.sql) are anon-grantable reads gated on
 * already knowing the exact customer_id, so this stays on the regular
 * server client, not the service-role one.
 */
export async function getAccountAction(passedId?: string): Promise<GetAccountResult> {
  const resolved = await resolveCustomer({ passedId });
  if (!resolved) {
    return { ok: false, message: "Sign in, or enter your customer ID, to see your account." };
  }
  const { customerId, email } = resolved;

  const supabase = getServerClient();
  const [{ data: balance, error: balanceError }, { data: rawOrders, error: ordersError }] =
    await Promise.all([
      supabase.rpc("get_loyalty_balance", { p_customer_id: customerId }),
      supabase.rpc("get_customer_orders", { p_customer_id: customerId }),
    ]);

  if (balanceError || ordersError) {
    console.error(
      `getAccountAction query failed: balance=${balanceError?.message ?? "ok"} orders=${ordersError?.message ?? "ok"}`
    );
    return { ok: false, message: "Something went wrong loading your account. Please try again." };
  }
  if (balance === null) {
    // A session-resolved id always has a row, so this only trips on a
    // typed customer ID that doesn't exist.
    return { ok: false, message: "We couldn't find that customer ID." };
  }

  const orders =
    (rawOrders as Array<{
      order_id: string;
      isbn: string;
      quantity: number;
      order_status: string;
      pickup_date: string | null;
      pickup_window: string | null;
      created_at: string;
    }>) ?? [];

  const isbns = [...new Set(orders.map((o) => o.isbn))];
  let bookByIsbn: Record<string, { book_title: string; cover_url: string | null }> = {};
  if (isbns.length > 0) {
    const { data: books } = await supabase
      .from("books")
      .select("isbn, book_title, cover_url")
      .in("isbn", isbns);
    bookByIsbn = Object.fromEntries(
      (books ?? []).map((b) => [b.isbn, { book_title: b.book_title, cover_url: b.cover_url }])
    );
  }

  return {
    ok: true,
    customerId,
    email,
    rewardPoints: balance as number,
    orders: orders.map((o) => ({
      ...o,
      book_title: bookByIsbn[o.isbn]?.book_title ?? o.isbn,
      cover_url: bookByIsbn[o.isbn]?.cover_url ?? null,
    })),
  };
}
