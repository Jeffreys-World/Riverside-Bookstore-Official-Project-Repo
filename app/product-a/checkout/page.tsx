"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCart } from "@/components/cart-provider";
import { checkoutAction, getMyCustomerIdAction, type CheckoutLineResult } from "../actions";
import { getBrowserClient } from "@/lib/supabase-browser";
import { saveCustomerId, loadCustomerId } from "@/lib/customer-id-storage";
import { CUSTOMER_ID_REGEX, PICKUP_LOCATION, PICKUP_WINDOWS } from "@/types/schema";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function todayISODate(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function CheckoutPage() {
  const { items, subtotal, removeItem } = useCart();
  const [customerId, setCustomerId] = useState(() => loadCustomerId());
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState(todayISODate());
  const [pickupWindow, setPickupWindow] = useState<string>(PICKUP_WINDOWS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<
    | { kind: "success"; lines: CheckoutLineResult[]; rewardPoints: number | null }
    | { kind: "error"; message: string }
    | null
  >(null);

  const minDate = useMemo(() => todayISODate(), []);

  // If the visitor is signed in (0034_customer_auth.sql), pull their
  // customer_id from the session and drop the "Customer ID" field — the
  // pre-order is attributed to the session, not a typed id. Keeps
  // localStorage in sync so the rest of the pre-auth flow (which still
  // reads loadCustomerId) keeps working unchanged.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getBrowserClient().auth.getSession();
      const email = data.session?.user.email ?? null;
      if (cancelled || !email) return;
      const id = await getMyCustomerIdAction();
      if (cancelled || !id) return;
      saveCustomerId(id);
      setCustomerId(id);
      setSignedInEmail(email);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!CUSTOMER_ID_REGEX.test(customerId)) {
      setOutcome({ kind: "error", message: "Enter a valid customer ID (cust_XXXXX), or create an account." });
      return;
    }
    if (items.length === 0) {
      setOutcome({ kind: "error", message: "Your cart is empty." });
      return;
    }

    setSubmitting(true);
    setOutcome(null);
    try {
      const result = await checkoutAction({
        customer_id: customerId,
        items: items.map((i) => ({ isbn: i.isbn, quantity: i.quantity })),
        pickup_date: pickupDate,
        pickup_window: pickupWindow,
      });

      if (!result.ok) {
        setOutcome({ kind: "error", message: result.message });
        return;
      }

      saveCustomerId(customerId);
      result.lines.filter((l) => l.ok).forEach((l) => removeItem(l.isbn));
      setOutcome({ kind: "success", lines: result.lines, rewardPoints: result.rewardPoints });
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome?.kind === "success") {
    const succeeded = outcome.lines.filter((l) => l.ok);
    const failed = outcome.lines.filter((l) => !l.ok);
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">
          {failed.length === 0 ? "You're all set" : "Mostly done"}
        </h1>
        <div className="mt-6 space-y-2">
          {succeeded.map((l) => (
            <p key={l.isbn} role="status" className="rounded-md bg-accent-soft p-3 text-ink">
              Reserved — confirmation {l.orderId}.
            </p>
          ))}
          {failed.map((l) => (
            <p key={l.isbn} role="alert" className="rounded-md border border-claret/30 bg-claret-soft p-3 text-claret">
              One item couldn&apos;t be reserved: {l.message}
            </p>
          ))}
        </div>
        {outcome.rewardPoints !== null && (
          <p className="mt-4 text-ink/80">
            You now have {outcome.rewardPoints} {outcome.rewardPoints === 1 ? "point" : "points"} toward
            your next reward.
          </p>
        )}
        <p className="mt-2 text-ink/70">
          We&apos;ll have your order ready for pickup {pickupDate} during {pickupWindow} at{" "}
          {PICKUP_LOCATION.addressLine1}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/product-a/account"
            className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105"
          >
            View my account
          </Link>
          <Link
            href="/product-a"
            className="min-h-[44px] rounded-md border border-ink/20 px-6 py-2 font-medium text-ink transition-transform duration-150 hover:scale-105"
          >
            Back to catalog
          </Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Checkout</h1>
        <p className="mt-4 text-ink/70">Your cart is empty.</p>
        <Link
          href="/product-a"
          className="mt-6 inline-block min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105"
        >
          Browse the catalog
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Checkout</h1>

      <section className="mt-8 rounded-lg border border-ink/10 bg-surface p-5">
        <h2 className="font-serif text-lg text-ink">Pickup location</h2>
        <p className="mt-1 text-ink">{PICKUP_LOCATION.name}</p>
        <p className="text-ink/70">{PICKUP_LOCATION.addressLine1}</p>
        <p className="text-ink/70">{PICKUP_LOCATION.addressLine2}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-lg text-ink">Order summary</h2>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.isbn}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-surface p-3"
            >
              <span className="min-w-0">
                <p className="truncate text-ink">{item.book_title}</p>
                <p className="text-xs text-ink/50">Qty {item.quantity}</p>
              </span>
              <span className="font-mono text-sm text-ink/80">
                {currencyFormatter.format(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
          <span className="text-ink/70">Subtotal</span>
          <span className="font-mono text-lg font-semibold text-ink">
            {currencyFormatter.format(subtotal)}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink/50">Pay in person at pickup — nothing is charged online.</p>
      </section>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
        {signedInEmail ? (
          <p className="text-sm text-ink/60">
            Reserving as <span className="text-ink">{signedInEmail}</span>.
          </p>
        ) : (
          <div>
            <label htmlFor="customer_id" className="block text-sm font-medium text-ink">
              Customer ID
            </label>
            <input
              id="customer_id"
              type="text"
              placeholder="cust_XXXXX"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
            />
            <Link
              href="/product-a/signup?next=/product-a/checkout"
              className="mt-1 inline-block text-sm text-accent underline-offset-2 transition-transform duration-150 hover:scale-105 hover:underline"
            >
              New customer? Create an account
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pickup_date" className="block text-sm font-medium text-ink">
              Pickup date
            </label>
            <input
              id="pickup_date"
              type="date"
              min={minDate}
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              required
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="pickup_window" className="block text-sm font-medium text-ink">
              Pickup time window
            </label>
            <select
              id="pickup_window"
              value={pickupWindow}
              onChange={(e) => setPickupWindow(e.target.value)}
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
            >
              {PICKUP_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] w-full rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:w-auto"
        >
          {submitting ? "Placing your order…" : "Place order"}
        </button>

        <div role="status" aria-live="polite" className="min-h-[1.5rem]">
          {outcome?.kind === "error" && (
            <p className="rounded-md border border-claret/30 bg-claret-soft p-3 text-claret">
              {outcome.message}
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
