/**
 * lib/customer-auth.ts
 *
 * Pure helpers for Product A's customer authentication. Deliberately has
 * NO server-only imports (next/headers, supabase-server) so it stays
 * unit-testable under the node-environment Vitest setup and safe to pull
 * into either a client or a server module. The session -> customer_id
 * resolution that DOES touch the server client lives in
 * lib/customer-session.ts.
 *
 * Product A keeps two identities in play at once:
 *   - a Supabase Auth session (new, 0034_customer_auth.sql)
 *   - the localStorage cust_XXXXX the pre-auth flow still uses everywhere
 *     (checkout, events RSVP, blind-date, donate — see
 *     lib/customer-id-storage.ts)
 * The session wins when present; the passed id is the fallback.
 */

import { CUSTOMER_ID_REGEX } from "@/types/schema";

/**
 * The one place the "this email already has an account" sentence is
 * written, so authErrorMessage() and the sign-up duplicate-detection
 * branch (customerSignUpAction) cannot drift apart.
 */
export const EMAIL_ALREADY_REGISTERED =
  "That email is already registered. Try signing in instead.";

/**
 * The fallback branch of customer-id resolution: a client-supplied id
 * (from localStorage) is only trusted when there is no session AND it is
 * a well-formed cust_XXXXX. Anything else -> null (caller then treats the
 * visitor as signed-out).
 */
export function validatePassedId(passedId: string | null | undefined): string | null {
  return passedId && CUSTOMER_ID_REGEX.test(passedId) ? passedId : null;
}

/**
 * Turn a Supabase Auth error into a single sentence a customer can act
 * on. Prefers the stable `code` field (GoTrue has emitted these since
 * 2024); the message-substring checks are a fallback for older shapes and
 * for the browser client, which doesn't always surface `code`.
 */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code;
  const msg = (error?.message ?? "").toLowerCase();

  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already been registered")) {
    return EMAIL_ALREADY_REGISTERED;
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "That email and password don't match. Check them and try again.";
  }
  if (code === "weak_password" || msg.includes("password should be at least")) {
    return "Choose a password with at least 8 characters.";
  }
  if (code === "validation_failed" || msg.includes("unable to validate email") || msg.includes("invalid email")) {
    return "That doesn't look like a valid email address.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit")) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Mutating-action identity. Reads are happy to trust a well-formed
// cust_XXXXX on its own (knowing the id is the pre-auth credential), but
// the actions that spend points or reserve stock must not: when a
// Supabase Auth session exists it decides who the caller is, and a
// client-passed id that disagrees is refused rather than silently
// honoured. The IO half (auth.getUser + get_or_create_my_customer) lives
// in lib/customer-session.ts; this is the pure decision it wraps.
// ---------------------------------------------------------------------------

export type MutationIdDecision =
  | { ok: true; customerId: string }
  | { ok: false; message: string };

/** Signed out with nothing usable in localStorage. */
export const NO_CUSTOMER_ID_MESSAGE =
  "Enter a valid customer ID (cust_XXXXX), or create an account.";

/**
 * The session's customer differs from the id the page submitted — most
 * often a stale localStorage id racing the session lookup on a shared
 * machine. Refusing (rather than quietly using the session id) keeps the
 * account that gets charged the same one the screen was showing.
 */
export const SESSION_ID_MISMATCH_MESSAGE =
  "You're signed in as a different account than this page was showing. Refresh the page and try again.";

/**
 * @param sessionCustomerId the customer_id resolved from the Supabase Auth
 *   session, or null when the visitor is signed out.
 * @param passedId the client-supplied cust_XXXXX (localStorage), if any.
 */
export function decideMutationCustomerId(
  sessionCustomerId: string | null,
  passedId: string | null | undefined
): MutationIdDecision {
  const passed = validatePassedId(passedId);

  if (sessionCustomerId) {
    if (passed && passed !== sessionCustomerId) {
      return { ok: false, message: SESSION_ID_MISMATCH_MESSAGE };
    }
    return { ok: true, customerId: sessionCustomerId };
  }

  return passed ? { ok: true, customerId: passed } : { ok: false, message: NO_CUSTOMER_ID_MESSAGE };
}

/**
 * Detect the "this address already has an account" response that
 * supabase.auth.signUp gives when the project has "Confirm email" ON.
 * GoTrue's anti-enumeration behaviour returns no error and a populated
 * but obfuscated user, so the only tells are an empty `identities` array
 * (a genuine new sign-up has exactly one) or an already-confirmed email.
 * With confirmations OFF the duplicate comes back as a real error and
 * authErrorMessage() handles it instead.
 */
export function isExistingUserSignUp(
  data:
    | {
        user?: { identities?: unknown[] | null; email_confirmed_at?: string | null } | null;
        session?: unknown | null;
      }
    | null
    | undefined
): boolean {
  const user = data?.user;
  if (!user || data?.session) return false;
  if (Array.isArray(user.identities)) return user.identities.length === 0;
  return Boolean(user.email_confirmed_at);
}
