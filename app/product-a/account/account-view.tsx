"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadCustomerId, saveCustomerId } from "@/lib/customer-id-storage";
import { CUSTOMER_ID_REGEX } from "@/types/schema";
import { getAccountAction, type AccountOrder } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  preorder: "Pre-ordered — ready for pickup soon",
  shipped: "Shipped",
  completed: "Completed",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function AccountView() {
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; rewardPoints: number; orders: AccountOrder[] }
    | { kind: "error"; message: string }
    | null
  >(null);

  async function loadAccount(id: string) {
    if (!CUSTOMER_ID_REGEX.test(id)) {
      setResult({ kind: "error", message: "Enter a valid customer ID (cust_XXXXX)." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await getAccountAction(id);
      if (res.ok) {
        saveCustomerId(id);
        setResult({ kind: "success", rewardPoints: res.rewardPoints, orders: res.orders });
      } else {
        setResult({ kind: "error", message: res.message });
      }
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on first visit if we already have this customer's id from a
  // prior sign-up or pre-order — saves retyping it every time.
  useEffect(() => {
    const saved = loadCustomerId();
    if (saved) {
      setCustomerId(saved);
      loadAccount(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // guards against double-submit
    loadAccount(customerId);
  }

  return (
    <div className="mt-8">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="account_customer_id" className="sr-only">
          Customer ID
        </label>
        <input
          id="account_customer_id"
          type="text"
          placeholder="cust_XXXXX"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] flex-none rounded-md bg-accent px-6 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Loading…" : "View account"}
        </button>
      </form>

      <div role="status" aria-live="polite" className="mt-6">
        {result?.kind === "error" && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
            {result.message}
          </p>
        )}

        {result?.kind === "success" && (
          <>
            <section className="rounded-lg border border-ink/10 bg-white p-4">
              <h2 className="font-serif text-lg text-ink">Loyalty points</h2>
              <p className="mt-1 text-2xl text-ink">{result.rewardPoints}</p>
              <p className="text-sm text-ink/60">
                {result.rewardPoints === 1 ? "point" : "points"} toward your next reward
              </p>
            </section>

            <section className="mt-6">
              <h2 className="font-serif text-lg text-ink">Order history</h2>
              {result.orders.length === 0 ? (
                <p className="mt-2 rounded-lg border border-ink/10 bg-white p-4 text-ink/70">
                  No orders yet — pre-order a title to start earning rewards.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {result.orders.map((o) => (
                    <li
                      key={o.order_id}
                      className="rounded-lg border border-ink/10 bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-ink">
                          {o.book_title} &times; {o.quantity}
                        </span>
                        <span className="font-mono text-xs text-ink/50">{o.order_id}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-sm text-ink/60">
                        <span>{STATUS_LABEL[o.order_status] ?? o.order_status}</span>
                        <span>{dateFormatter.format(new Date(o.created_at))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
