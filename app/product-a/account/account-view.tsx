"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
} from "react";
// useFormState, not React 19's useActionState — this app is on React
// 18.3 with Next 14, where the hook still lives in react-dom.
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { clearCustomerId, loadCustomerId, saveCustomerId } from "@/lib/customer-id-storage";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  REWARD_TIERS,
  pointsToGoLabel,
  BLIND_DATE_POINTS_COST,
  type OrderStatus,
} from "@/types/schema";
import { StampBadge } from "@/components/stamp-badge";
import { CardImage } from "@/components/card-image";
import { SubmitButton } from "@/components/submit-button";
import { ClaimIdField } from "@/components/claim-id-field";
import {
  getAccountAction,
  customerSignInInlineAction,
  customerSignOutAction,
  customerSignUpInlineAction,
  redeemBlindDateAction,
  donatePointsAction,
  type AccountOrder,
  type AuthFormState,
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
const ACCOUNT_TAB_KEYS = ACCOUNT_TABS.map((t) => t.key);

// The signed-out screen leads with these two tabs so a first-time visitor
// sees "Create account" as a peer of "Sign in", not a secondary button.
// Both panels post to the same Server Actions the dedicated
// /product-a/login and /product-a/signup pages use.
const AUTH_TABS = [
  { key: "signin", label: "Sign in" },
  { key: "signup", label: "Create account" },
] as const;
type AuthTabKey = (typeof AUTH_TABS)[number]["key"];
const AUTH_TAB_KEYS = AUTH_TABS.map((t) => t.key);

// Loyalty points have no anon-safe Realtime path today: `customers` is
// deliberately excluded from an open anon SELECT policy (0002's reasoning
// — a table-level grant can't tell "I already know this customer_id" from
// "let me scan every row" — the same reason get_loyalty_balance exists as
// a SECURITY DEFINER RPC instead). A short poll while this page is open
// gets the "updated automatically after each purchase" behavior the spec
// asks for without reopening that table to broad reads.
const BALANCE_POLL_MS = 20000;

interface AccountData {
  customerId: string;
  email: string | null;
  rewardPoints: number;
  orders: AccountOrder[];
}

export function AccountView({
  initialSignedIn,
  welcomeClaimed,
}: {
  initialSignedIn: boolean;
  welcomeClaimed: boolean;
}) {
  // The server already knows if there's a session, so start "loading" for
  // a signed-in visitor (no flash of the signed-out screen) and
  // "signed-out" otherwise. A signed-out visitor who nonetheless has a
  // saved cust_XXXXX briefly sees the signed-out screen before the mount
  // fetch flips them to "account" — that's the legacy path only.
  const [phase, setPhase] = useState<"loading" | "account" | "signed-out">(
    initialSignedIn ? "loading" : "signed-out"
  );
  const [data, setData] = useState<AccountData | null>(null);
  const [typedId, setTypedId] = useState("");
  const [typedIdError, setTypedIdError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeIdRef = useRef("");

  const [blindDate, setBlindDate] = useState<
    { kind: "pending" } | { kind: "revealed"; bookTitle: string } | { kind: "error"; message: string } | null
  >(null);
  const [donation, setDonation] = useState<
    { kind: "pending" } | { kind: "done"; pointsDonated: number } | { kind: "error"; message: string } | null
  >(null);
  const [activeTab, setActiveTab] = useState<AccountTabKey>("points");
  const [authTab, setAuthTab] = useState<AuthTabKey>("signin");
  const router = useRouter();
  const accountTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const authTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // The embedded tabs post to the *Inline* auth actions, which return an
  // error instead of redirecting to /product-a/login|signup — a typo here
  // shouldn't move the visitor off the account page they opened.
  const [signInState, signInFormAction] = useFormState<AuthFormState, FormData>(
    customerSignInInlineAction,
    {}
  );
  const [signUpState, signUpFormAction] = useFormState<AuthFormState, FormData>(
    customerSignUpInlineAction,
    {}
  );

  // Arrow-key navigation is the expected interaction for role="tablist",
  // and Product C's Support Center tabs already work this way. These two
  // tablists announced the role without honouring it: no roving tabindex
  // (all five tabs sat in the tab order) and arrow keys did nothing.
  // Found by /qa on 2026-08-29.
  function moveTab<K extends string>(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    keys: readonly K[],
    current: K,
    select: (key: K) => void,
    refs: MutableRefObject<Record<string, HTMLButtonElement | null>>
  ) {
    const i = keys.indexOf(current);
    let next = i;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (i + 1) % keys.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (i - 1 + keys.length) % keys.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = keys.length - 1;
    else return;
    event.preventDefault();
    const nextKey = keys[next];
    if (nextKey === undefined) return;
    select(nextKey);
    refs.current[nextKey]?.focus();
  }

  // Resolve the account: server prefers the session, falls back to a
  // client-passed cust_XXXXX. `passedId` is only meaningful when signed
  // out; harmless otherwise (server ignores it).
  const resolveAccount = useCallback(
    async (passedId: string | undefined, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setBusy(true);
      try {
        const res = await getAccountAction(passedId);
        if (res.ok) {
          saveCustomerId(res.customerId);
          activeIdRef.current = res.customerId;
          setData({
            customerId: res.customerId,
            email: res.email,
            rewardPoints: res.rewardPoints,
            orders: res.orders,
          });
          setPhase("account");
          setTypedIdError("");
        } else if (!opts.silent) {
          setPhase("signed-out");
          // Only show the message when the visitor actually typed an id —
          // the bare "sign in or enter your id" prompt is the screen, not an error.
          if (passedId) setTypedIdError(res.message);
        }
      } finally {
        if (!opts.silent) setBusy(false);
      }
    },
    []
  );

  // First load: try the session (no arg), falling back to a saved id.
  useEffect(() => {
    resolveAccount(loadCustomerId() || undefined);
  }, [resolveAccount]);

  // An embedded sign-in/sign-up succeeded. The inline actions hand back a
  // destination instead of redirecting themselves (see AuthFormState) —
  // when it's this page, re-resolve in place so the visitor stays on the
  // tab they used; router.refresh() re-runs the server component so its
  // initialSignedIn matches the new cookie.
  const redirectTo = signInState.redirectTo ?? signUpState.redirectTo;
  useEffect(() => {
    if (!redirectTo) return;
    if (redirectTo.startsWith("/product-a/account")) {
      setPhase("loading");
      resolveAccount(undefined);
      router.refresh();
    } else {
      router.push(redirectTo);
    }
  }, [redirectTo, resolveAccount, router]);

  // Poll while an account is open so a purchase elsewhere (another tab,
  // the voice kiosk) shows up without a manual refresh.
  useEffect(() => {
    if (phase !== "account") return;
    const id = activeIdRef.current;
    const interval = setInterval(() => resolveAccount(id || undefined, { silent: true }), BALANCE_POLL_MS);
    return () => clearInterval(interval);
  }, [phase, resolveAccount]);

  function handleTypedIdSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    resolveAccount(typedId.trim());
  }

  // Only for the id-only path (no session) — forget the saved id and drop
  // back to the signed-out screen. A real session is ended by
  // customerSignOutAction (server) instead.
  function handleForgetId() {
    clearCustomerId();
    activeIdRef.current = "";
    setData(null);
    setTypedId("");
    setTypedIdError("");
    setActiveTab("points");
    setBlindDate(null);
    setDonation(null);
    setPhase("signed-out");
  }

  async function handleBlindDate() {
    if (blindDate?.kind === "pending") return;
    setBlindDate({ kind: "pending" });
    const res = await redeemBlindDateAction(activeIdRef.current);
    if (res.ok) {
      setBlindDate({ kind: "revealed", bookTitle: res.bookTitle });
      resolveAccount(activeIdRef.current || undefined, { silent: true });
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
      resolveAccount(activeIdRef.current || undefined, { silent: true });
    } else {
      setDonation({ kind: "error", message: res.message });
    }
  }

  // ---- signed-out screen (D3) --------------------------------------------
  if (phase === "signed-out") {
    return (
      <div className="mt-8 max-w-md">
        <p className="text-ink/70">
          Sign in to see your points and order history — or create an account to start earning.
        </p>

        <div className="mt-6">
          <div
            role="tablist"
            aria-label="Sign in or create an account"
            className="flex items-center gap-2 border-b border-ink/10"
          >
            {AUTH_TABS.map((tab) => (
              <button
                key={tab.key}
                ref={(el) => {
                  authTabRefs.current[tab.key] = el;
                }}
                type="button"
                role="tab"
                aria-selected={authTab === tab.key}
                tabIndex={authTab === tab.key ? 0 : -1}
                onClick={() => setAuthTab(tab.key)}
                onKeyDown={(e) => moveTab(e, AUTH_TAB_KEYS, authTab, setAuthTab, authTabRefs)}
                className={`min-h-[52px] flex-1 whitespace-nowrap border-b-2 px-4 py-4 text-base font-medium transition-transform duration-150 hover:scale-105 ${
                  authTab === tab.key
                    ? "border-accent text-ink"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {authTab === "signin" ? (
            <form
              action={signInFormAction}
              role="tabpanel"
              aria-label="Sign in"
              className="mt-6 space-y-4"
            >
              {signInState.error && (
                <p
                  role="alert"
                  className="rounded-md border border-claret/30 bg-claret-soft p-3 text-sm text-claret"
                >
                  {signInState.error}
                </p>
              )}
              <div>
                <label htmlFor="signin_email" className="block text-sm font-medium text-ink">
                  Email
                </label>
                <input
                  id="signin_email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label htmlFor="signin_password" className="block text-sm font-medium text-ink">
                  Password
                </label>
                <input
                  id="signin_password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <SubmitButton
                pendingLabel="Signing in…"
                className="min-h-[44px] w-full rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                Sign in
              </SubmitButton>
            </form>
          ) : (
            <form
              action={signUpFormAction}
              role="tabpanel"
              aria-label="Create account"
              className="mt-6 space-y-4"
            >
              {signUpState.error && (
                <p
                  role="alert"
                  className="rounded-md border border-claret/30 bg-claret-soft p-3 text-sm text-claret"
                >
                  {signUpState.error}
                </p>
              )}
              {signUpState.notice && (
                <p role="status" className="rounded-md bg-accent-soft p-3 text-sm text-ink">
                  {signUpState.notice}
                </p>
              )}
              <ClaimIdField />
              <div>
                <label htmlFor="signup_email" className="block text-sm font-medium text-ink">
                  Email
                </label>
                <input
                  id="signup_email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label htmlFor="signup_password" className="block text-sm font-medium text-ink">
                  Password
                </label>
                <input
                  id="signup_password"
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
              <p className="text-xs text-ink/50">
                Earn a point for every $1 you pre-order and keep your pickups in one place.
              </p>
            </form>
          )}
        </div>

        <div className="my-8 flex items-center gap-3 text-xs text-ink/40">
          <hr className="flex-1 border-ink/10" />
          <span>Have an account from before?</span>
          <hr className="flex-1 border-ink/10" />
        </div>

        <details className="rounded-md border border-ink/10 bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm text-ink/70">Enter your customer ID</summary>
          <form onSubmit={handleTypedIdSubmit} className="mt-3 flex gap-2">
            <label htmlFor="account_customer_id" className="sr-only">
              Customer ID
            </label>
            <input
              id="account_customer_id"
              type="text"
              placeholder="cust_XXXXX"
              value={typedId}
              onChange={(e) => setTypedId(e.target.value)}
              className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] flex-none rounded-md border border-ink/20 px-5 py-2 text-sm font-medium text-ink transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {busy ? "Loading…" : "View"}
            </button>
          </form>
          <p className="mt-2 text-xs text-ink/50">
            Signing up with your email links this ID to a login you won&apos;t have to remember.
          </p>
          <div role="status" aria-live="polite" className="mt-2 min-h-[1.25rem]">
            {typedIdError && <p className="text-sm text-claret">{typedIdError}</p>}
          </div>
        </details>
      </div>
    );
  }

  // ---- loading ----------------------------------------------------------
  if (phase === "loading" || !data) {
    return (
      <p role="status" className="mt-8 text-ink/60">
        Loading your account…
      </p>
    );
  }

  // ---- account ---------------------------------------------------------
  return (
    <div className="mt-8">
      <div className="max-w-md">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink/70">
              Signed in as <span className="text-ink">{data.email ?? data.customerId}</span>
            </p>
            {data.email && (
              <p className="font-mono text-xs text-ink/60">{data.customerId}</p>
            )}
          </div>
          {data.email ? (
            <form action={customerSignOutAction}>
              <button
                type="submit"
                className="min-h-[36px] rounded-md border border-ink/20 px-4 py-1.5 text-sm font-medium text-ink transition-transform duration-150 hover:scale-105 hover:border-ink/40"
              >
                Log out
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleForgetId}
              className="min-h-[36px] rounded-md border border-ink/20 px-4 py-1.5 text-sm font-medium text-ink transition-transform duration-150 hover:scale-105 hover:border-ink/40"
            >
              Use a different account
            </button>
          )}
        </div>

        {welcomeClaimed && (
          <p
            role="status"
            className="mt-4 rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-ink"
          >
            Welcome back — we linked your existing Riverside account. Your{" "}
            <strong>
              {data.rewardPoints} {data.rewardPoints === 1 ? "point" : "points"}
            </strong>{" "}
            and order history are here.
          </p>
        )}
      </div>

      <div className="mt-8">
        <div
          role="tablist"
          aria-label="Account sections"
          className="flex items-center gap-2 overflow-x-auto border-b border-ink/10 sm:flex-wrap sm:justify-between sm:overflow-x-visible"
        >
          {ACCOUNT_TABS.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => {
                accountTabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => moveTab(e, ACCOUNT_TAB_KEYS, activeTab, setActiveTab, accountTabRefs)}
              className={`min-h-[52px] flex-none whitespace-nowrap border-b-2 px-4 py-4 text-base font-medium transition-transform duration-150 hover:scale-105 sm:flex-1 ${
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
            <p className="mt-1 font-mono text-3xl text-gold">{data.rewardPoints}</p>
            <p className="text-sm text-ink/60">
              {data.rewardPoints === 1 ? "point" : "points"} · $1 spent = 1 point
            </p>
          </section>
        )}

        {activeTab === "tiers" && (
          <section role="tabpanel" className="mt-6">
            <h2 className="font-serif text-lg text-ink">Reward tiers</h2>
            <p className="mt-1 text-xs text-ink/50">Redeem in-store at the register.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REWARD_TIERS.map((tier) => {
                const unlocked = data.rewardPoints >= tier.points;
                return (
                  <div
                    key={tier.points}
                    className={`rounded-lg border p-4 ${
                      unlocked ? "border-accent/30 bg-accent-soft" : "border-ink/10 bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{tier.label}</p>
                      <span className="font-mono text-xs text-ink/50">{tier.points} pts</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/60">{tier.description}</p>
                    {!unlocked && (
                      <p className="mt-1 text-xs text-ink/60">
                        {pointsToGoLabel(tier.points, data.rewardPoints)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
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
              disabled={blindDate?.kind === "pending" || data.rewardPoints < BLIND_DATE_POINTS_COST}
              className="mt-3 min-h-[44px] w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
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
            {data.rewardPoints > 0 ? (
              <>
                <button
                  type="button"
                  onClick={handleDonate}
                  disabled={donation?.kind === "pending" || donation?.kind === "done"}
                  className="mt-3 min-h-[44px] w-full rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {donation?.kind === "pending" ? "Donating…" : `Donate ${data.rewardPoints} points`}
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
            {data.orders.length === 0 ? (
              <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
                No orders yet — add a title to your cart to start earning rewards.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {data.orders.map((o) => {
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
                        <span className="font-mono text-xs text-ink/60">{o.order_id}</span>
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
    </div>
  );
}
