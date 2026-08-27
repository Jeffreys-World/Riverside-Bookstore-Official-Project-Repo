"use client";

/**
 * Dedicated customer registration screen. Product A has no real customer
 * auth (see lib/customer-id-storage.ts and CLAUDE.md's data contract —
 * `customers` has no email/password column), so email + password here are
 * collected for a real-feeling sign-up flow but not persisted or checked;
 * submitting mints a fresh cust_XXXXX id via create_customer()
 * (signUpCustomerAction, unchanged) the same way the old inline "New
 * customer? Sign up" button on the catalog page did. A returning visit
 * still works through the existing localStorage-remembered id, same as
 * today — this screen doesn't change that model, just gives sign-up its
 * own page per the spec.
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { saveCustomerId } from "@/lib/customer-id-storage";
import { signUpCustomerAction } from "../actions";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { kind: "success"; customerId: string } | { kind: "error"; message: string } | null
  >(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await signUpCustomerAction();
      if (res.ok) {
        saveCustomerId(res.customerId);
        setResult({ kind: "success", customerId: res.customerId });
      } else {
        setResult({ kind: "error", message: res.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.kind === "success") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Welcome to Riverside Books</h1>
        <p className="mt-4 text-ink/70">Your account is ready. Your loyalty ID is:</p>
        <p className="mt-2 rounded-md border border-ink/10 bg-surface px-4 py-3 font-mono text-lg text-ink">
          {result.customerId}
        </p>
        <p className="mt-2 text-sm text-ink/60">
          We&apos;ve saved this to your browser, so you won&apos;t need to re-enter it here next time.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/product-a"
            className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105"
          >
            Start browsing
          </Link>
          <Link
            href="/product-a/account"
            className="min-h-[44px] rounded-md border border-ink/20 px-6 py-2 font-medium text-ink transition-transform duration-150 hover:scale-105"
          >
            View my account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Create your account</h1>
      <p className="mt-2 text-ink/70">
        Sign up to earn a loyalty stamp with every pre-order and track your pickups.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] w-full rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? "Creating your account…" : "Create account"}
        </button>

        <div role="status" aria-live="polite" className="min-h-[1.5rem]">
          {result?.kind === "error" && (
            <p className="rounded-md border border-claret/30 bg-claret-soft p-3 text-claret">
              {result.message}
            </p>
          )}
        </div>
      </form>

      <p className="mt-6 text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/product-a/account" className="text-accent underline-offset-2 hover:underline">
          Go to your account
        </Link>
      </p>
    </main>
  );
}
