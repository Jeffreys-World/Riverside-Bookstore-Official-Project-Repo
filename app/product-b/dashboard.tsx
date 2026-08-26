"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  evaluateStockStatus,
  sortBySeverity,
  type FlaggedInventoryRecord,
} from "@/lib/inventory";
import { useRealtimeSubscription } from "@/lib/realtime";
import { signOutAction, addBookAction } from "./actions";

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
  cover_url: string | null;
  price: number;
}

interface MerchandiseRow {
  id: string;
  item_name: string;
  category: string;
  price: number;
  stock_quantity: number | null;
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

// How long a newly-arrived pre-order stays highlighted before fading back
// to the normal row style — long enough to notice, short enough not to
// clutter the list once staff has seen it.
const ARRIVAL_HIGHLIGHT_MS = 2500;

export function Dashboard({
  initialOrders,
  initialBooksByIsbn,
  initialMerchandiseById,
  addBookError,
  bookAdded,
}: {
  initialOrders: OrderRow[];
  initialBooksByIsbn: Record<string, BookRow>;
  initialMerchandiseById: Record<string, MerchandiseRow>;
  addBookError?: string;
  bookAdded?: string;
}) {
  const [supabase] = useState(() => getBrowserClient());
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [booksByIsbn, setBooksByIsbn] = useState<Record<string, BookRow>>(initialBooksByIsbn);
  const [merchandiseById, setMerchandiseById] =
    useState<Record<string, MerchandiseRow>>(initialMerchandiseById);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  // Seeded from the ?bookAdded= redirect param so a screen reader
  // announces a successful add the same way it announces a live pre-order
  // arrival, even though this one came from a full page navigation, not
  // a Realtime event.
  const [announcement, setAnnouncement] = useState(bookAdded ? `Added ${bookAdded}` : "");

  // The addBookAction redirect only changes the query string on the same
  // route (/product-b -> /product-b?bookAdded=...), which the App Router
  // doesn't treat as a navigation that resets scroll position — a staff
  // member who submitted the form at the bottom of the page stays scrolled
  // down and never sees the confirmation banner up top without this.
  useEffect(() => {
    if (bookAdded) window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // "*" (not just UPDATE) so a book another staff session just added
    // via addBookAction appears here live too, not only stock changes.
    { event: "*", schema: "public", table: "books" },
    (payload) => {
      const row = payload.new as unknown as BookRow;
      setBooksByIsbn((prev) => ({ ...prev, [row.isbn]: row }));
    }
  );

  const merchandiseStatus = useRealtimeSubscription(
    supabase,
    "product-b-merchandise",
    { event: "*", schema: "public", table: "merchandise" },
    (payload) => {
      const row = payload.new as unknown as MerchandiseRow;
      setMerchandiseById((prev) => ({ ...prev, [row.id]: row }));
    }
  );

  const reconnecting =
    ordersStatus !== "connected" || booksStatus !== "connected" || merchandiseStatus !== "connected";

  const flaggedBooks = sortBySeverity(
    evaluateStockStatus(
      Object.values(booksByIsbn).map((b) => ({ id: b.isbn, stockQuantity: b.stock_quantity }))
    )
  );

  const flaggedMerchandise = sortBySeverity(
    evaluateStockStatus(
      Object.values(merchandiseById).map((m) => ({ id: m.id, stockQuantity: m.stock_quantity }))
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

      {bookAdded && (
        // Rendered at the top, not next to the form below, since a
        // successful add navigates back to the top of the page — a staff
        // member submitting the form at the bottom would otherwise see no
        // visible confirmation at all without scrolling back down past
        // Pending pre-orders and Stock levels.
        <p
          role="status"
          className="mt-6 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          Added &ldquo;{bookAdded}&rdquo; to the catalog.
        </p>
      )}

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
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {booksByIsbn[f.id]?.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={booksByIsbn[f.id]?.cover_url ?? undefined}
                      alt=""
                      loading="lazy"
                      className="h-14 w-10 flex-none rounded object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="flex h-14 w-10 flex-none items-center justify-center rounded bg-ink/5 text-[9px] text-ink/40"
                    >
                      No cover
                    </div>
                  )}
                  <span className="truncate text-ink">
                    {booksByIsbn[f.id]?.book_title ?? f.id}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-3">
                  {booksByIsbn[f.id]?.price !== undefined && (
                    <span className="font-mono text-sm text-ink/50">
                      {currencyFormatter.format(booksByIsbn[f.id]?.price ?? 0)}
                    </span>
                  )}
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

      <section className="mt-12">
        <h2 className="font-serif text-xl text-ink">Merchandise stock</h2>
        {flaggedMerchandise.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-white p-4 text-ink/70">
            No cards or gifts in the catalog yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {flaggedMerchandise.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-4"
              >
                <span className="min-w-0">
                  <span className="truncate text-ink">{merchandiseById[f.id]?.item_name ?? f.id}</span>
                  {merchandiseById[f.id]?.category !== undefined && (
                    <span className="ml-2 text-xs capitalize text-ink/50">
                      {merchandiseById[f.id]?.category}
                    </span>
                  )}
                </span>
                <span className="flex flex-none items-center gap-3">
                  {merchandiseById[f.id]?.price !== undefined && (
                    <span className="font-mono text-sm text-ink/50">
                      {currencyFormatter.format(merchandiseById[f.id]?.price ?? 0)}
                    </span>
                  )}
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

      <section className="mt-12">
        <h2 className="font-serif text-xl text-ink">Add a book</h2>
        <p className="mt-1 text-sm text-ink/60">
          Cover and description are looked up from Google Books automatically once added.
        </p>
        <form action={addBookAction} className="mt-4 space-y-4 rounded-lg border border-ink/10 bg-white p-4">
          <div>
            <label htmlFor="isbn" className="block text-sm font-medium text-ink">
              ISBN
            </label>
            <input
              id="isbn"
              name="isbn"
              type="text"
              required
              placeholder="978-..."
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 font-mono text-ink"
            />
          </div>
          <div>
            <label htmlFor="book_title" className="block text-sm font-medium text-ink">
              Title
            </label>
            <input
              id="book_title"
              name="book_title"
              type="text"
              required
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="author_name" className="block text-sm font-medium text-ink">
              Author
            </label>
            <input
              id="author_name"
              name="author_name"
              type="text"
              required
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="stock_quantity" className="block text-sm font-medium text-ink">
              Stock quantity
            </label>
            <input
              id="stock_quantity"
              name="stock_quantity"
              type="number"
              min={0}
              step={1}
              placeholder="Leave blank if not yet inventoried"
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-ink">
              Price
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step={0.01}
              required
              placeholder="0.00"
              className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-white"
          >
            Add book
          </button>

          {addBookError && (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
            >
              {addBookError}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
