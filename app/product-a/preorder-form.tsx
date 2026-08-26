"use client";

/**
 * Book-selection is a plain list/select over the current catalog, not a
 * search box — catalog search was cut from this build phase's scope (see
 * design doc, Open Questions). `books` comes from a direct anon-readable
 * read of the `books` table, so it's always the live catalog, not a seed
 * file.
 */

import { useMemo, useState, type FormEvent } from "react";
import { evaluateStockStatus, type FlaggedInventoryRecord } from "@/lib/inventory";
import { CUSTOMER_ID_REGEX, ISBN13_REGEX } from "@/types/schema";
import { createPreorderAction, signUpCustomerAction } from "./actions";

interface BookRow {
  isbn: string;
  book_title: string;
  author_name: string;
  stock_quantity: number | null;
  cover_url: string | null;
  description: string | null;
  price: number;
}

const STATUS_LABEL: Record<FlaggedInventoryRecord["status"], string> = {
  out_of_stock: "Out of stock",
  low_stock: "Low stock",
  needs_attention: "Not yet inventoried",
  in_stock: "In stock",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function PreorderForm({ books }: { books: BookRow[] }) {
  const flagged = useMemo(
    () =>
      evaluateStockStatus(
        books.map((b) => ({ id: b.isbn, stockQuantity: b.stock_quantity }))
      ),
    [books]
  );

  const [isbn, setIsbn] = useState(books[0]?.isbn ?? "");
  const [customerId, setCustomerId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [result, setResult] = useState<
    | { kind: "success"; orderId: string; rewardPoints: number | null }
    | { kind: "error"; message: string }
    | null
  >(null);

  const selectedStatus = flagged.find((f) => f.id === isbn)?.status;

  async function handleSignUp() {
    if (signingUp) return;
    setSigningUp(true);
    setSignupMessage("");
    try {
      const res = await signUpCustomerAction();
      if (res.ok) {
        setCustomerId(res.customerId);
        setSignupMessage(`Your loyalty ID is ${res.customerId} — save it to check your rewards next time.`);
      } else {
        setSignupMessage(res.message);
      }
    } finally {
      setSigningUp(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // guards against double-submit / double-click

    if (!CUSTOMER_ID_REGEX.test(customerId)) {
      setResult({ kind: "error", message: "Customer ID must look like cust_XXXXX." });
      return;
    }
    if (!ISBN13_REGEX.test(isbn)) {
      setResult({ kind: "error", message: "Please choose a title from the list." });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const res = await createPreorderAction({ customer_id: customerId, isbn, quantity });
      setResult(
        res.ok
          ? { kind: "success", orderId: res.orderId, rewardPoints: res.rewardPoints }
          : { kind: "error", message: res.message }
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (books.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-ink/10 bg-white p-4 text-ink/70">
        No titles are in the catalog yet — check back soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
      <div>
        <label htmlFor="customer_id" className="block text-sm font-medium text-ink">
          Customer ID
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="customer_id"
            name="customer_id"
            type="text"
            placeholder="cust_XXXXX"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className="block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
          />
          <button
            type="button"
            onClick={handleSignUp}
            disabled={signingUp}
            className="min-h-[44px] flex-none whitespace-nowrap rounded-md border border-ink/20 px-4 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingUp ? "Creating…" : "New customer? Sign up"}
          </button>
        </div>
        {signupMessage && (
          <p role="status" className="mt-2 text-sm text-ink/70">
            {signupMessage}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-ink">Title</legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {books.map((b) => {
            const status = flagged.find((f) => f.id === b.isbn)?.status;
            const selected = b.isbn === isbn;
            return (
              <label
                key={b.isbn}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                  selected
                    ? "border-accent ring-1 ring-accent"
                    : "border-ink/10 hover:border-ink/30"
                }`}
              >
                <input
                  type="radio"
                  name="isbn"
                  value={b.isbn}
                  checked={selected}
                  onChange={() => setIsbn(b.isbn)}
                  className="sr-only"
                />
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.cover_url}
                    alt=""
                    loading="lazy"
                    className="h-20 w-14 flex-none rounded object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-20 w-14 flex-none items-center justify-center rounded bg-ink/5 text-[10px] text-ink/40"
                  >
                    No cover
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{b.book_title}</p>
                  <p className="truncate text-sm text-ink/60">{b.author_name}</p>
                  <p className="mt-1 font-mono text-xs text-ink/70">
                    {currencyFormatter.format(b.price)}
                  </p>
                  {status && (
                    <p className="mt-1 text-xs text-ink/60">{STATUS_LABEL[status]}</p>
                  )}
                  {b.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink/50">{b.description}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="quantity" className="block text-sm font-medium text-ink">
          Quantity
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="mt-1 block min-h-[44px] w-24 rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || selectedStatus === "out_of_stock"}
        className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Placing your pre-order…" : "Place pre-order"}
      </button>

      <div role="status" aria-live="polite" className="min-h-[1.5rem]">
        {result?.kind === "success" && (
          <p className="rounded-md bg-accent-soft p-3 text-ink">
            Pre-order placed — confirmation {result.orderId}. We&apos;ll have it ready for
            pickup.
            {result.rewardPoints !== null && (
              <>
                {" "}
                You&apos;ve earned a stamp — you now have {result.rewardPoints}{" "}
                {result.rewardPoints === 1 ? "point" : "points"} toward your next reward.
              </>
            )}
          </p>
        )}
        {result?.kind === "error" && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
