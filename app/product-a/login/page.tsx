import Link from "next/link";
import { customerSignInAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Customer sign-in. Email + password via Supabase Auth (0034_customer_auth.sql)
 * — the same GoTrue flow as the staff sign-in (app/product-b/sign-in),
 * without the staff_users gate. A logged-out visitor can still reach their
 * account by customer ID from /product-a/account; this is the path that
 * remembers them properly.
 */
export default function CustomerLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const next = searchParams.next ?? "";

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink/70">Welcome back to Riverside Books.</p>

      <form action={customerSignInAction} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          />
        </div>

        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>

        {searchParams.error && (
          <p
            role="alert"
            className="rounded-md border border-claret/30 bg-claret-soft p-3 text-sm text-claret"
          >
            {searchParams.error}
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-ink/60">
        Need an account?{" "}
        <Link
          href={next ? `/product-a/signup?next=${encodeURIComponent(next)}` : "/product-a/signup"}
          className="text-accent underline-offset-2 hover:underline"
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
