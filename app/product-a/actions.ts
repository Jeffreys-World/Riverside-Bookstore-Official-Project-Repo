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
import { CUSTOMER_ID_REGEX, checkoutRequestSchema, customerCredentialsSchema } from "@/types/schema";
import { authErrorMessage, validatePassedId } from "@/lib/customer-auth";
import { resolveCustomer, resolveCustomerId } from "@/lib/customer-session";
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
  const { customer_id, items, pickup_date, pickup_window } = parsed.data;

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
// a Server Component). All four redirect rather than return — matching
// signInAction on the staff side.
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

export async function customerSignInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? ""));
  const nextQS = next ? `&next=${encodeURIComponent(next)}` : "";

  const supabase = getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/product-a/login?error=${encodeURIComponent(authErrorMessage(error))}${nextQS}`);
  }
  redirect(next || "/product-a/account");
}

export async function customerSignOutAction() {
  const supabase = getServerClient();
  await supabase.auth.signOut();
  redirect("/product-a");
}

/**
 * Real sign-up. supabase.auth.signUp mints the auth user; resolveCustomerId
 * then links a customers row — adopting an unclaimed localStorage
 * cust_XXXXX (claim_id, mirrored into a hidden field by the signup page)
 * so a returning customer keeps their points + order history. If the
 * project has "Confirm email" on, signUp returns no session and we send
 * the visitor to the pending state instead of a broken-looking account
 * page.
 */
export async function customerSignUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? ""));
  const claimId = validatePassedId(String(formData.get("claim_id") ?? ""));
  const nextQS = next ? `&next=${encodeURIComponent(next)}` : "";

  const parsed = customerCredentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check your email and password.";
    redirect(`/product-a/signup?error=${encodeURIComponent(message)}${nextQS}`);
  }

  const supabase = getServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    redirect(`/product-a/signup?error=${encodeURIComponent(authErrorMessage(error))}${nextQS}`);
  }
  if (!data.session) {
    redirect(`/product-a/signup?pending=1&email=${encodeURIComponent(parsed.data.email)}`);
  }

  const customerId = await resolveCustomerId({ claimId });
  const claimed = Boolean(claimId) && customerId === claimId;

  // The "welcome back, we linked your account" banner only makes sense on
  // the account page; a ?next= redirect (mid-checkout) skips it.
  if (!next && claimed) {
    redirect("/product-a/account?welcome=claimed");
  }
  redirect(next || "/product-a/account");
}

export type RedeemBlindDateResult =
  | { ok: true; orderId: string; isbn: string; bookTitle: string }
  | { ok: false; message: string };

/**
 * "Blind Date with a Book" — spends BLIND_DATE_POINTS_COST points
 * (types/schema.ts) on a random in-stock title via redeem_blind_date()
 * (0030_loyalty_program_expansion.sql), which mints a real preorder. Same
 * server-only mutation pattern as checkoutAction: the RPC isn't granted
 * to anon, so this must run through the service-role client. The
 * customerId here comes from account-view's activeIdRef, which is the
 * session-resolved id when signed in.
 */
export async function redeemBlindDateAction(customerId: string): Promise<RedeemBlindDateResult> {
  if (!CUSTOMER_ID_REGEX.test(customerId)) {
    return { ok: false, message: "Enter a valid customer ID (cust_XXXXX)." };
  }

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
 * partial-amount input. Same service-role pattern as the other
 * points-spending action above.
 */
export async function donatePointsAction(customerId: string): Promise<DonatePointsResult> {
  if (!CUSTOMER_ID_REGEX.test(customerId)) {
    return { ok: false, message: "Enter a valid customer ID (cust_XXXXX)." };
  }

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
