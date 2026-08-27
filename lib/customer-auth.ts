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
    return "That email is already registered. Try signing in instead.";
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
