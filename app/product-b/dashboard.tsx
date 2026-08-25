"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  evaluateStockStatus,
  sortBySeverity,
  type FlaggedInventoryRecord,
} from "@/lib/inventory";
import { useRealtimeSubscription } from "@/lib/realtime";
import { signOutAction } from "./actions";

interface OrderRow {
  order_id: string;
  customer_id: string;
  isbn: string;
  quantity: number;
  order_status: string;
  created_at: string;
}

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

// How long a newly-arrived pre-order stays highlighted before fading back
// to the normal row style — long enough to notice, short enough not to
// clutter the list once staff has seen it.
const ARRIVAL_HIGHLIGHT_MS = 2500;

export function Dashboard({
  initialOrders,
  initialBooksByIsbn,
}: {
  initialOrders: OrderRow[];
  initialBooksByIsbn: Record<string, BookRow>;
}) {
  const [supabase] = useState(() => getBrowserClient());
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [booksByIsbn, setBooksByIsbn] = useState<Record<string, BookRow>>(initialBooksByIsbn);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  const ordersStatus = useRealtimeSubscription(
    supabase,
    "product-b-orders",
    { event: "INSERT", schema: "public", table: "orders", filter: "order_status=eq.preorder" },
    (payload) => {
      const row = payload.new as unknown as OrderRow;
      setOrders((prev) => [row, ...prev]);
      setAnnouncement(`New pre-order: ${row.order_id}`);
      setJustArrived((prev) => new Set(prev).add(row.order_id));
      setTimeout(() => {
        setJustArrived((prev) => {
          const next = new Set(prev);
          next.delete(row.order_id);
          return next;
        });
      }, ARRIVAL_HIGHLIGHT_MS);
    }
  );

  const booksStatus = useRealtimeSubscription(
    supabase,
    "product-b-books",
    { event: "UPDATE", schema: "public", table: "books" },
    (payload) => {
      const row = payload.new as unknown as BookRow;
      setBooksByIsbn((prev) => ({ ...prev, [row.isbn]: row }));
    }
  );

  const reconnecting = ordersStatus !== "connected" || booksStatus !== "connected";

  const flaggedBooks = sortBySeverity(
    evaluateStockStatus(
      Object.values(booksByIsbn).map((b) => ({ isbn: b.isbn, stockQuantity: b.stock_quantity }))
    )
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-ink">Staff Dashboard</h1>
        <div className="flex items-center gap-3">
          {reconnecting && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">
              Reconnecting…
            </span>
          )}
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-ink/60 underline">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-ink">Pending pre-orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-white p-4 text-ink/70">
            No pending pre-orders right now.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((o) => (
              <li
                key={o.order_id}
                className={`rounded-lg border p-4 transition-colors duration-1000 ${
                  justArrived.has(o.order_id)
                    ? "border-accent bg-accent-soft"
                    : "border-ink/10 bg-white"
                }`}
              >
                <p className="font-mono text-sm text-ink/60">{o.order_id}</p>
                <p className="text-ink">
                  {booksByIsbn[o.isbn]?.book_title ?? o.isbn} &times; {o.quantity}
                </p>
                <p className="text-sm text-ink/60">Customer: {o.customer_id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl text-ink">Stock levels</h2>
        {flaggedBooks.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-white p-4 text-ink/70">
            No titles in the catalog yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {flaggedBooks.map((f) => (
              <li
                key={f.isbn}
                className="flex items-center justify-between rounded-lg border border-ink/10 bg-white p-4"
              >
                <span className="text-ink">{booksByIsbn[f.isbn]?.book_title ?? f.isbn}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-ink/60">
                    {f.stockQuantity ?? "—"}
                  </span>
                  <span className="text-sm text-ink/60">{STATUS_LABEL[f.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
