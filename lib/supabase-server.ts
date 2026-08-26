/**
 * lib/supabase-server.ts
 *
 * Server-only Supabase client factories (Server Components, Server
 * Actions, Route Handlers). Split out of the original lib/supabase.ts —
 * see lib/supabase-browser.ts for why: this file imports next/headers,
 * which breaks the build the moment any client component imports
 * anything from the same file, even an unrelated export.
 */

import { createServerClient } from "@supabase/ssr";
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
        // A Server Component (e.g. product-b/page.tsx reading the
        // session) can trigger an auth token refresh, which tries to
        // write the refreshed cookie here — but Next.js only allows
        // cookie writes from a Server Action or Route Handler. There's
        // no middleware refreshing the session ahead of render, so this
        // throws on every such refresh. Safe to swallow: sign-in/
        // sign-out already persist the cookies that matter from real
        // Server Actions; a Server Component just can't also do it.
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // ignore — see comment above
        }
      },
      remove(name: string, options) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // ignore — see comment above
        }
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
