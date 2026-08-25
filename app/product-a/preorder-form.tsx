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
import { createPreorderAction } from "./actions";

interface BookRow {
  isbn: string;
  book_title: string;
  author_name: string;
  stock_quantity: number | null;
}

const STATUS_LABEL: Record<FlaggedInventoryRecord["status"], string> = {
  out_of_stock: "Out of stock",
  low_stock: "Low stock",
  needs_attention: "Not yet inventoried",
  in_stock: "In stock",
};

export function PreorderForm({ books }: { books: BookRow[] }) {
  const flagged = useMemo(
    () =>
      evaluateStockStatus(
        books.map((b) => ({ isbn: b.isbn, stockQuantity: b.stock_quantity }))
      ),
    [books]
  );

  const [isbn, setIsbn] = useState(books[0]?.isbn ?? "");
  const [customerId, setCustomerId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { kind: "success"; orderId: string } | { kind: "error"; message: string } | null
  >(null);

  const selectedStatus = flagged.find((f) => f.isbn === isbn)?.status;

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
          ? { kind: "success", orderId: res.orderId }
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
        <input
          id="customer_id"
          name="customer_id"
          type="text"
          placeholder="cust_XXXXX"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
          className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
        />
      </div>

      <div>
        <label htmlFor="isbn" className="block text-sm font-medium text-ink">
          Title
        </label>
        <select
          id="isbn"
          name="isbn"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
        >
          {books.map((b) => (
            <option key={b.isbn} value={b.isbn}>
              {b.book_title} — {b.author_name}
            </option>
          ))}
        </select>
        {selectedStatus && (
          <p className="mt-1 text-sm text-ink/60">{STATUS_LABEL[selectedStatus]}</p>
        )}
      </div>

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
