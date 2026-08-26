"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  evaluateStockStatus,
  sortBySeverity,
  type FlaggedInventoryRecord,
} from "@/lib/inventory";
import { useRealtimeSubscription } from "@/lib/realtime";
import { addBookAction, searchBooksAction } from "./actions";
import { StaffNav } from "./staff-nav";
import { StampBadge, type StampTone } from "@/components/stamp-badge";
import type { BookSearchCandidate } from "@/lib/google-books";

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

const STATUS_TONE: Record<FlaggedInventoryRecord["status"], StampTone> = {
  out_of_stock: "negative",
  low_stock: "pending",
  needs_attention: "neutral",
  in_stock: "positive",
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
  loadError,
}: {
  initialOrders: OrderRow[];
  initialBooksByIsbn: Record<string, BookRow>;
  initialMerchandiseById: Record<string, MerchandiseRow>;
  addBookError?: string;
  bookAdded?: string;
  loadError?: string;
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

  // Add-book form fields are lifted into state so a Google Books search
  // result can prefill them — the form still submits natively via
  // action={addBookAction}, this just controls what's in the inputs at
  // submit time.
  const [newIsbn, setNewIsbn] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newCoverUrl, setNewCoverUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchCandidate[] | null>(null);
  const [searchError, setSearchError] = useState("");

  async function handleSearch() {
    if (searching) return;
    setSearching(true);
    setSearchError("");
    setSearchResults(null);
    try {
      const res = await searchBooksAction(searchQuery);
      if (res.ok) {
        setSearchResults(res.results);
        if (res.results.length === 0) setSearchError("No results with a usable ISBN-13.");
      } else {
        setSearchError(res.message);
      }
    } finally {
      setSearching(false);
    }
  }

  function pickCandidate(c: BookSearchCandidate) {
    setNewIsbn(c.isbn);
    setNewTitle(c.title);
    setNewAuthor(c.author);
    setNewCoverUrl(c.coverUrl);
    setSearchResults(null);
  }

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
      <StaffNav active="dashboard" />
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl text-ink">Inventory</h1>
        {reconnecting && (
          <span className="rounded-full bg-gold/20 px-3 py-1 text-sm text-ink">
            Reconnecting…
          </span>
        )}
      </div>

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      {loadError && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-claret/30 bg-claret-soft p-3 text-sm text-claret"
        >
          {loadError}
        </p>
      )}

      {bookAdded && (
        // Rendered at the top, not next to the form below, since a
        // successful add navigates back to the top of the page — a staff
        // member submitting the form at the bottom would otherwise see no
        // visible confirmation at all without scrolling back down past
        // Pending pre-orders and Stock levels.
        <p
          role="status"
          className="mt-6 rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-ink"
        >
          Added &ldquo;{bookAdded}&rdquo; to the catalog.
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-xl text-ink">Pending pre-orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
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
                    : "border-ink/10 bg-surface"
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
          <p className="mt-4 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
            No titles in the catalog yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {flaggedBooks.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-surface p-4"
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
                  <StampBadge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</StampBadge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl text-ink">Merchandise stock</h2>
        {flaggedMerchandise.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
            No cards or gifts in the catalog yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {flaggedMerchandise.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-surface p-4"
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
                  <StampBadge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</StampBadge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-xl text-ink">Add a book</h2>
        <p className="mt-1 text-sm text-ink/60">
          Search Google Books to fill in the details below, or type an ISBN by hand — either way,
          cover and description are looked up automatically once added.
        </p>

        <div className="mt-4 rounded-lg border border-ink/10 bg-surface p-4">
          <label htmlFor="google_books_search" className="block text-sm font-medium text-ink">
            Search Google Books
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="google_books_search"
              type="text"
              placeholder="Title or author"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="min-h-[44px] flex-none rounded-md border border-ink/20 px-4 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>

          {searchError && <p className="mt-2 text-sm text-claret">{searchError}</p>}

          {searchResults && searchResults.length > 0 && (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {searchResults.map((c) => (
                <li key={c.isbn}>
                  <button
                    type="button"
                    onClick={() => pickCandidate(c)}
                    className="flex w-full items-center gap-3 rounded-md border border-ink/10 bg-white p-2 text-left hover:border-accent"
                  >
                    {c.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverUrl} alt="" className="h-14 w-10 flex-none rounded object-cover" />
                    ) : (
                      <div
                        aria-hidden
                        className="flex h-14 w-10 flex-none items-center justify-center rounded bg-ink/5 text-[9px] text-ink/40"
                      >
                        No cover
                      </div>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{c.title}</span>
                      <span className="block truncate text-xs text-ink/60">{c.author}</span>
                      <span className="block font-mono text-xs text-ink/40">{c.isbn}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form action={addBookAction} className="mt-4 space-y-4 rounded-lg border border-ink/10 bg-surface p-4">
          {newCoverUrl && (
            <div className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent-soft p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newCoverUrl} alt="" className="h-16 w-11 flex-none rounded object-cover" />
              <p className="text-sm text-ink">Selected from Google Books — cover will be saved on add.</p>
            </div>
          )}
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
              value={newIsbn}
              onChange={(e) => setNewIsbn(e.target.value)}
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
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
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
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
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
            className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper"
          >
            Add book
          </button>

          {addBookError && (
            <p
              role="alert"
              className="rounded-md border border-claret/30 bg-claret-soft p-3 text-sm text-claret"
            >
              {addBookError}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
