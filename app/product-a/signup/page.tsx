import Link from "next/link";
import { customerSignUpAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { ClaimIdField } from "@/components/claim-id-field";

/**
 * Customer registration. Real email + password via Supabase Auth
 * (0034_customer_auth.sql) — signUp mints the auth user, then
 * customerSignUpAction links a customers row, adopting an unclaimed
 * localStorage cust_XXXXX (via <ClaimIdField>) so a returning customer
 * keeps their loyalty points and order history.
 *
 * `?pending=1` is the state shown when the Supabase project has "Confirm
 * email" turned on: signUp succeeds but returns no session, so the
 * customer has to click the emailed link before signing in. With
 * confirmations off (recommended for this pay-in-person shop) that state
 * is never reached — signup redirects straight to the account page.
 */
export default function SignUpPage({
  searchParams,
}: {
  searchParams: { error?: string; pending?: string; email?: string; next?: string };
}) {
  const next = searchParams.next ?? "";

  if (searchParams.pending) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Check your email</h1>
        <p className="mt-4 text-ink/70">
          We sent a confirmation link
          {searchParams.email ? (
            <>
              {" "}
              to <span className="font-medium text-ink">{searchParams.email}</span>
            </>
          ) : null}
          . Open it to finish setting up your account, then sign in.
        </p>
        <p className="mt-2 text-sm text-ink/60">
          The link expires in 24 hours. No email? Check your spam folder.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/product-a/login"
            className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105"
          >
            Go to sign in
          </Link>
          <Link
            href="/product-a/signup"
            className="min-h-[44px] rounded-md border border-ink/20 px-6 py-2 font-medium text-ink transition-transform duration-150 hover:scale-105"
          >
            Use a different email
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Create your account</h1>
      <p className="mt-2 text-ink/70">
        Sign up to earn a point for every $1 you pre-order and track your pickups.
      </p>

      <form action={customerSignUpAction} className="mt-8 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <ClaimIdField />
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
            placeholder="you@example.com"
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
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          />
        </div>

        <SubmitButton
          pendingLabel="Creating your account…"
          className="min-h-[44px] w-full rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          Create account
        </SubmitButton>

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
        Already have an account?{" "}
        <Link
          href={next ? `/product-a/login?next=${encodeURIComponent(next)}` : "/product-a/login"}
          className="text-accent underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
