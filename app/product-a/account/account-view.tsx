"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { loadCustomerId, saveCustomerId } from "@/lib/customer-id-storage";
import {
  CUSTOMER_ID_REGEX,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  REWARD_TIERS,
  BLIND_DATE_POINTS_COST,
  type OrderStatus,
} from "@/types/schema";
import { StampBadge } from "@/components/stamp-badge";
import { CardImage } from "@/components/card-image";
import {
  getAccountAction,
  redeemBlindDateAction,
  donatePointsAction,
  type AccountOrder,
} from "../actions";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const ACCOUNT_TABS = [
  { key: "points", label: "Reward Points" },
  { key: "tiers", label: "Reward Tiers" },
  { key: "blind-date", label: "Blind Date with a Book" },
  { key: "donate", label: "Donate Your Points" },
  { key: "orders", label: "Order History" },
] as const;
type AccountTabKey = (typeof ACCOUNT_TABS)[number]["key"];

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
  const [blindDate, setBlindDate] = useState<
    { kind: "pending" } | { kind: "revealed"; bookTitle: string } | { kind: "error"; message: string } | null
  >(null);
  const [donation, setDonation] = useState<
    { kind: "pending" } | { kind: "done"; pointsDonated: number } | { kind: "error"; message: string } | null
  >(null);
  const [activeTab, setActiveTab] = useState<AccountTabKey>("points");

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

  async function handleBlindDate() {
    if (blindDate?.kind === "pending") return;
    setBlindDate({ kind: "pending" });
    const res = await redeemBlindDateAction(activeIdRef.current);
    if (res.ok) {
      setBlindDate({ kind: "revealed", bookTitle: res.bookTitle });
      loadAccount(activeIdRef.current, { silent: true }); // refresh points + order history
    } else {
      setBlindDate({ kind: "error", message: res.message });
    }
  }

  async function handleDonate() {
    if (donation?.kind === "pending") return;
    setDonation({ kind: "pending" });
    const res = await donatePointsAction(activeIdRef.current);
    if (res.ok) {
      setDonation({ kind: "done", pointsDonated: res.pointsDonated });
      loadAccount(activeIdRef.current, { silent: true }); // refresh points
    } else {
      setDonation({ kind: "error", message: res.message });
    }
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

        </div>
      </div>

      {result?.kind === "success" && (
        <div className="mt-8">
          <div
            role="tablist"
            aria-label="Account sections"
            className="flex gap-1 overflow-x-auto border-b border-ink/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ACCOUNT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-transform transition-colors duration-150 hover:scale-110 ${
                  activeTab === tab.key
                    ? "border-accent text-ink"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "points" && (
            <section role="tabpanel" className="mt-6 max-w-md rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Reward points</h2>
              <p className="mt-1 font-mono text-3xl text-gold">{result.rewardPoints}</p>
              <p className="text-sm text-ink/60">
                {result.rewardPoints === 1 ? "point" : "points"} · $1 spent = 1 point
              </p>
            </section>
          )}

          {activeTab === "tiers" && (
            <section role="tabpanel" className="mt-6 max-w-md rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Reward tiers</h2>
              <p className="mt-1 text-xs text-ink/50">Redeem in-store at the register.</p>
              <ul className="mt-3 space-y-2">
                {REWARD_TIERS.map((tier) => {
                  const unlocked = result.rewardPoints >= tier.points;
                  return (
                    <li
                      key={tier.points}
                      className={`rounded-md border p-3 ${
                        unlocked ? "border-accent/30 bg-accent-soft" : "border-ink/10 bg-field"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{tier.label}</p>
                        <span className="font-mono text-xs text-ink/50">{tier.points} pts</span>
                      </div>
                      <p className="mt-1 text-xs text-ink/60">{tier.description}</p>
                      {!unlocked && (
                        <p className="mt-1 text-xs text-ink/40">
                          {tier.points - result.rewardPoints} points to go
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {activeTab === "blind-date" && (
            <section role="tabpanel" className="mt-6 max-w-md rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Blind Date with a Book</h2>
              <p className="mt-1 text-xs text-ink/60">
                Spend {BLIND_DATE_POINTS_COST} points on a mystery staff pick instead of browsing —
                reserved for pickup like any other order.
              </p>
              <button
                type="button"
                onClick={handleBlindDate}
                disabled={blindDate?.kind === "pending" || result.rewardPoints < BLIND_DATE_POINTS_COST}
                className="mt-3 min-h-[44px] w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
              >
                {blindDate?.kind === "pending" ? "Revealing…" : `Redeem for ${BLIND_DATE_POINTS_COST} points`}
              </button>
              {blindDate?.kind === "revealed" && (
                <p role="status" className="mt-2 rounded-md border border-accent/30 bg-accent-soft p-2 text-sm text-ink">
                  Your mystery pick: <strong>{blindDate.bookTitle}</strong>. Reserved for pickup.
                </p>
              )}
              {blindDate?.kind === "error" && (
                <p role="alert" className="mt-2 text-sm text-claret">
                  {blindDate.message}
                </p>
              )}
            </section>
          )}

          {activeTab === "donate" && (
            <section role="tabpanel" className="mt-6 max-w-md rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Donate your points</h2>
              <p className="mt-1 text-xs text-ink/60">
                Convert your entire balance into a donation toward a local literacy program.
              </p>
              {result.rewardPoints > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleDonate}
                    disabled={donation?.kind === "pending" || donation?.kind === "done"}
                    className="mt-3 min-h-[44px] w-full rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {donation?.kind === "pending" ? "Donating…" : `Donate ${result.rewardPoints} points`}
                  </button>
                  {donation?.kind === "done" && (
                    <p role="status" className="mt-2 rounded-md border border-accent/30 bg-accent-soft p-2 text-sm text-ink">
                      Thank you — {donation.pointsDonated} points donated.
                    </p>
                  )}
                  {donation?.kind === "error" && (
                    <p role="alert" className="mt-2 text-sm text-claret">
                      {donation.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-ink/50">No points to donate right now.</p>
              )}
            </section>
          )}

          {activeTab === "orders" && (
            <section role="tabpanel" className="mt-6">
              {result.orders.length === 0 ? (
                <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
                  No orders yet — add a title to your cart to start earning rewards.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
      )}
    </div>
  );
}
