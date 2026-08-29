/**
 * lib/customer-session.ts
 *
 * Server-only. Resolves "who is this customer" for Product A's server
 * actions, preferring the Supabase Auth session and falling back to the
 * localStorage cust_XXXXX the pre-auth flow still passes in.
 *
 * Imports getServerClient (-> next/headers), so this must never be
 * imported from a 'use client' component. Client components that need the
 * session customer_id call the getMyCustomerIdAction server action
 * instead (app/product-a/actions.ts).
 *
 * Uses the normal RLS-scoped server client, NOT the service-role client:
 * get_or_create_my_customer (0034_customer_auth.sql) reads auth.uid()
 * internally, the same trust model as is_staff() (0018), so a plain
 * authenticated call is both sufficient and un-spoofable.
 */

import { getServerClient } from "@/lib/supabase-server";
import {
  decideMutationCustomerId,
  validatePassedId,
  type MutationIdDecision,
} from "@/lib/customer-auth";

export interface ResolvedCustomer {
  customerId: string;
  /** null when resolved from the localStorage fallback (no session). */
  email: string | null;
}

interface ResolveOpts {
  /** A client-supplied cust_XXXXX (localStorage). Only used when there is no session. */
  passedId?: string | null;
  /** On first sign-up: an unclaimed legacy cust_XXXXX to adopt so the customer keeps their points + history. */
  claimId?: string | null;
}

/**
 * One auth.getUser() round trip, then either the localStorage fallback
 * (no session) or get_or_create_my_customer (session). Returns null when
 * the visitor has neither a valid session-linked customer nor a valid
 * passed id, and for a staff session (the RPC refuses to mint a customer
 * row for staff).
 */
export async function resolveCustomer(opts?: ResolveOpts): Promise<ResolvedCustomer | null> {
  const supabase = getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const id = validatePassedId(opts?.passedId);
    return id ? { customerId: id, email: null } : null;
  }

  const { data, error } = await supabase.rpc("get_or_create_my_customer", {
    p_claim: opts?.claimId ?? null,
  });

  if (error) {
    // A DB blip here surfaces to the caller as "signed out" (null) rather
    // than throwing. One string arg only — multi-arg console.error
    // crashes this machine's VSCode extension in Server Actions.
    console.error(`resolveCustomer: get_or_create_my_customer failed: ${error.message}`);
    return null;
  }

  const customerId = (data as string | null) ?? null;
  return customerId ? { customerId, email: user.email ?? null } : null;
}

/** Thin wrapper for callers that only need the id (checkout sync, sign-up claim). */
export async function resolveCustomerId(opts?: ResolveOpts): Promise<string | null> {
  return (await resolveCustomer(opts))?.customerId ?? null;
}

/**
 * The identity check the *mutating* Product A actions use (checkout,
 * RSVP, blind date, donate). Unlike resolveCustomer() — which is happy to
 * take a well-formed cust_XXXXX on its own for reads — this makes an
 * existing Supabase Auth session authoritative: the session's customer
 * wins, and a client-passed id that disagrees is refused. The signed-out
 * pre-auth flow still works, and the voice-kiosk server route
 * (app/api/live/execute-tool/route.ts) deliberately doesn't come through
 * here — it has no browser session to resolve.
 */
export async function resolveMutationCustomerId(
  passedId?: string | null
): Promise<MutationIdDecision> {
  const supabase = getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return decideMutationCustomerId(null, passedId);

  const { data, error } = await supabase.rpc("get_or_create_my_customer", { p_claim: null });
  if (error) {
    // One string arg only — multi-arg console.error crashes this
    // machine's VSCode extension in Server Actions.
    console.error(`resolveMutationCustomerId: get_or_create_my_customer failed: ${error.message}`);
    return {
      ok: false,
      message: "We couldn't verify your account just now. Refresh the page and try again.",
    };
  }

  const sessionCustomerId = (data as string | null) ?? null;
  if (!sessionCustomerId) {
    // The RPC refuses to mint a customers row for a staff session — don't
    // fall back to the passed id, or a signed-in bookseller's browser
    // would still spend a customer's points.
    return {
      ok: false,
      message: "You're signed in as staff. Sign out to use a customer account.",
    };
  }

  return decideMutationCustomerId(sessionCustomerId, passedId);
}
