/**
 * lib/supabase-browser.ts
 *
 * The one client factory safe to import from a 'use client' component.
 * Split out of lib/supabase.ts because that file also imports
 * next/headers (for getServerClient) — Next.js refuses to bundle any file
 * that imports next/headers into client code, even if the client
 * component only actually calls a different export from that file. The
 * first client component to import from lib/supabase.ts (Product B's
 * dashboard) is what surfaced this.
 */

import { createBrowserClient } from "@supabase/ssr";

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
 * getServiceRoleClient or getServerClient in a 'use client' file.
 */
export function getBrowserClient() {
  const { url, anonKey } = getPublicEnv();
  return createBrowserClient(url, anonKey);
}
