"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { loadCustomerId, saveCustomerId } from "@/lib/customer-id-storage";
import { CUSTOMER_ID_REGEX, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from "@/types/schema";
import { StampBadge } from "@/components/stamp-badge";
import { CardImage } from "@/components/card-image";
import { getAccountAction, type AccountOrder } from "../actions";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

// Loyalty points have no anon-safe Realtime path today: `customers` is
// deliberately excluded from an open anon SELECT policy (0002's reasoning
// — a table-level grant can't tell "I already know this customer_id" from
// "let me scan every row" — the same reason get_loyalty_balance exists as
// a SECURITY DEFINER RPC instead). A short poll while this page is open
// gets the "updated automatically after each purchase" behavior the spec
// asks for without reopening that table to broad reads.
const BALANCE_POLL_MS = 20000;

export function AccountView() {
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; rewardPoints: number; orders: AccountOrder[] }
    | { kind: "error"; message: string }
    | null
  >(null);
  const activeIdRef = useRef("");

  const loadAccount = useCallback(async (id: string, opts: { silent?: boolean } = {}) => {
    if (!CUSTOMER_ID_REGEX.test(id)) {
      if (!opts.silent) setResult({ kind: "error", message: "Enter a valid customer ID (cust_XXXXX)." });
      return;
    }
    if (!opts.silent) setLoading(true);
    try {
      const res = await getAccountAction(id);
      if (res.ok) {
        saveCustomerId(id);
        setResult({ kind: "success", rewardPoints: res.rewardPoints, orders: res.orders });
      } else if (!opts.silent) {
        setResult({ kind: "error", message: res.message });
      }
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  // Auto-load on first visit if we already have this customer's id from a
  // prior sign-up or pre-order — saves retyping it every time.
  useEffect(() => {
    const saved = loadCustomerId();
    if (saved) {
      setCustomerId(saved);
      activeIdRef.current = saved;
      loadAccount(saved);
    }
  }, [loadAccount]);

  // Poll for balance/order updates while an account is loaded, so a
  // purchase made elsewhere (another tab, the voice kiosk) shows up here
  // without a manual refresh.
  useEffect(() => {
    if (!activeIdRef.current) return;
    const id = activeIdRef.current;
    const interval = setInterval(() => loadAccount(id, { silent: true }), BALANCE_POLL_MS);
    return () => clearInterval(interval);
  }, [result?.kind, loadAccount]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return; // guards against double-submit
    activeIdRef.current = customerId;
    loadAccount(customerId);
  }

  return (
    <div className="mt-8">
      <div className="max-w-md">
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
            className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] flex-none rounded-md bg-accent px-6 py-2 font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading…" : "View account"}
          </button>
        </form>

        <div role="status" aria-live="polite" className="mt-6">
          {result?.kind === "error" && (
            <p className="rounded-md border border-claret/30 bg-claret-soft p-3 text-claret">
              {result.message}
            </p>
          )}

          {result?.kind === "success" && (
            <section className="rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Loyalty points</h2>
              <p className="mt-1 font-mono text-3xl text-gold">{result.rewardPoints}</p>
              <p className="text-sm text-ink/60">
                {result.rewardPoints === 1 ? "point" : "points"} toward your next reward
              </p>
            </section>
          )}
        </div>
      </div>

      {result?.kind === "success" && (
        <section className="mt-6">
          <h2 className="font-serif text-lg text-ink">Order history</h2>
          {result.orders.length === 0 ? (
            <p className="mt-2 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No orders yet — add a title to your cart to start earning rewards.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {result.orders.map((o) => {
                const status = o.order_status as OrderStatus;
                return (
                  <article
                    key={o.order_id}
                    className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface"
                  >
                    <CardImage src={o.cover_url} alt="" aspect="portrait" />
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <p className="text-ink">
                        {o.book_title} &times; {o.quantity}
                      </p>
                      <span className="font-mono text-xs text-ink/40">{o.order_id}</span>
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                        <StampBadge tone={ORDER_STATUS_TONE[status] ?? "neutral"}>
                          {ORDER_STATUS_LABEL[status] ?? o.order_status}
                        </StampBadge>
                        <span className="text-xs text-ink/50">
                          {dateFormatter.format(new Date(o.created_at))}
                        </span>
                      </div>
                      {o.pickup_date && (
                        <p className="text-xs text-ink/60">
                          Pickup {o.pickup_date}
                          {o.pickup_window ? ` · ${o.pickup_window}` : ""}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
