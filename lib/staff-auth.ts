/**
 * lib/staff-auth.ts
 *
 * Shared staff authorization for the Product B / Product D staff
 * surfaces. Two layers, same as every other mutating path in this repo:
 *
 *  - `requireStaffPage()` — for Server Components. Redirects an
 *    unauthenticated visitor to the sign-in page and a signed-in
 *    non-staff visitor (e.g. a Product A customer — one shared auth
 *    cookie) to the customer app. is_staff() (0018_staff_rbac.sql) is
 *    re-checked on every load, so a roster change takes effect
 *    immediately without forcing a sign-out.
 *
 *  - `assertStaff()` — for Server Actions that don't touch an
 *    RLS-protected table (so there's no policy to fall back on). Returns
 *    a boolean; the caller returns its own friendly error.
 */

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";

export async function requireStaffPage(): Promise<void> {
  const supabase = getServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // orders has no anon SELECT policy (0003) — an unauthenticated visitor
  // must never reach a staff surface.
  if (!session) {
    redirect("/product-b/sign-in");
  }

  // A session alone isn't staff (0018). signInAction already rejects a
  // non-staff sign-in, but a session can also arrive from an existing
  // cookie (a signed-in Product A customer, or after a roster change
  // revokes access), so re-check here rather than trusting sign-in time.
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error) {
    // A transient RPC failure (PostgREST 5xx, network blip, token-refresh
    // race) must not be conflated with "not staff" and bounce a real
    // staff member to the customer storefront — that reads as a revoked
    // account. Fail closed, but to sign-in with a retry message.
    console.error(`is_staff() check failed: ${error.message}`);
    redirect(
      `/product-b/sign-in?error=${encodeURIComponent(
        "We couldn't verify your staff access just now — please sign in again."
      )}`
    );
  }
  if (!isStaff) {
    redirect("/product-a");
  }
}

export async function assertStaff(): Promise<boolean> {
  const supabase = getServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return false;
  }
  const { data: isStaff } = await supabase.rpc("is_staff");
  return isStaff === true;
}
