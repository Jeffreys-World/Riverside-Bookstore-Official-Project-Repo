/**
 * lib/supabase.ts
 *
 * Shared Supabase client factories. Every product uses these rather than
 * constructing its own client — this is the one place the anon key and
 * (server-only) service-role key are wired up, so the "service role key
 * must never reach client code" rule (Solo Build Plan, Section 2.3)
 * has exactly one place to be enforced correctly instead of four.
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getPublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.local.example to .env.local and fill in your project's values."
    );
  }
  return { url, anonKey };
}

/**
 * Use in Client Components ('use client'). RLS-scoped via the anon key —
 * this is the ONLY client type allowed in client-side code. Never import
 * getServiceRoleClient in a 'use client' file.
 */
export function getBrowserClient() {
  const { url, anonKey } = getPublicEnv();
  return createBrowserClient(url, anonKey);
}

/**
 * Use in Server Components, Server Actions, and Route Handlers. Still
 * RLS-scoped via the anon key, but reads the user's session cookie so
 * RLS policies that depend on auth.uid() work server-side too.
 */
export function getServerClient() {
  const { url, anonKey } = getPublicEnv();
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

/**
 * SERVER-ONLY. Bypasses Row-Level Security entirely.
 *
 * Rules (Solo Build Plan, Section 2.3):
 *  - Never call this from a file marked 'use client'.
 *  - Never call this from a Server Action reachable by unauthenticated
 *    input without your own auth/validation check first.
 *  - As of this scaffold, the only place this SHOULD be called is inside
 *    the pre-order expiration edge function (Product A) and the
 *    execute-tool route for mutating Live API tool calls
 *    (app/api/live/execute-tool/route.ts).
 *  - If you think you need this anywhere else, that's a sign the
 *    operation should be a SECURITY DEFINER Postgres function callable
 *    under RLS instead — treat adding a new call site here as worth a
 *    deliberate second look before committing, not a routine change.
 */
let serviceRoleClient: SupabaseClient | null = null;
export function getServiceRoleClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServiceRoleClient() was called from browser code. This is a " +
        "server-only client and must never run in the browser."
    );
  }
  if (!serviceRoleClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    serviceRoleClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return serviceRoleClient;
}
