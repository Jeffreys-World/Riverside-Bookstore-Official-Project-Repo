"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Shown in place of a staff surface (Product B's dashboard, Product D's
 * generator) when the is_staff() check itself failed — a PostgREST 5xx,
 * a network blip, a token-refresh race. That's inconclusive, not
 * "you're not staff": redirecting to the storefront reads as a revoked
 * account and redirecting to sign-in throws away a perfectly good
 * session, so the page holds still and offers a retry instead.
 *
 * router.refresh() rather than a <Link> to the same URL: the App Router
 * would treat that as a navigation to the route it's already on and can
 * serve the cached RSC payload, which is exactly what needs re-fetching.
 */
export function StaffGateNotice() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">We couldn&apos;t verify your access</h1>
      <p className="mt-4 text-ink/70">
        The staff directory didn&apos;t answer just now, so this page is holding off on loading
        anything. You&apos;re still signed in — this is usually over in a moment.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setRetrying(true);
            router.refresh();
            // The refresh re-renders this page from the server; if the
            // check succeeds the whole component is replaced. Re-enable
            // either way so a second failure is still retryable.
            setTimeout(() => setRetrying(false), 1500);
          }}
          disabled={retrying}
          className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {retrying ? "Checking…" : "Try again"}
        </button>
        <Link
          href="/product-b/sign-in"
          className="min-h-[44px] rounded-md border border-ink/20 px-6 py-2 font-medium text-ink transition-transform duration-150 hover:scale-105"
        >
          Sign in again
        </Link>
      </div>
    </main>
  );
}
