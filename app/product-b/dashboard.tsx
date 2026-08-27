"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  evaluateStockStatus,
  sortBySeverity,
  type FlaggedInventoryRecord,
} from "@/lib/inventory";
import { useRealtimeSubscription } from "@/lib/realtime";
import {
  addBookAction,
  addMerchandiseAction,
  searchBooksAction,
  removeBookStockAction,
  removeMerchandiseStockAction,
  deleteBookAction,
  deleteMerchandiseAction,
  type RemoveStockResult,
  type DeleteListingResult,
} from "./actions";
import { StaffNav } from "./staff-nav";
import { StampBadge, type StampTone } from "@/components/stamp-badge";
import { CardImage } from "@/components/card-image";
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
  image_url: string | null;
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

const TABS = [
  {
    key: "pre-orders",
    label: "Pending Pre-Orders",
    description:
      "Live queue of pre-orders customers placed in the app. Each card shows the title, quantity, and customer ID — pull the book, set it aside, and the customer pays and collects it in person. New pre-orders appear here on their own, no refresh needed.",
  },
  {
    key: "stock",
    label: "Stock Levels",
    description:
      "Every catalog title, most urgent first: out of stock, then low, then not yet inventoried. Use Remove stock to reduce a miscounted quantity; use Delete listing to pull a bad entry (duplicate, wrong price) off the site entirely.",
  },
  {
    key: "merch-stock",
    label: "Merchandise Stock",
    description:
      "The same stock view for cards and gifts. These are browse-only items — not part of the pre-order flow — so this is purely a shelf-count tool.",
  },
  {
    key: "add-book",
    label: "Add a Book",
    description:
      "Add a title to the catalog so customers can pre-order it. Search Google Books to prefill the details, or type them by hand — cover and description are fetched automatically on add unless you fill them in yourself.",
  },
  {
    key: "add-merch",
    label: "Add Merchandise",
    description:
      "Add a card or gift to the shelf listing. Browse-only stock — customers can see it but can't pre-order it.",
  },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// Manual "walk back a stock_quantity typo" control — shown on Stock
// Levels/Merchandise Stock cards. Own local state (amount/pending/error)
// so a mistake on one card doesn't touch the others; parent just gets
// told the resulting quantity to merge into its map.
function StockRemoveControl({
  disabled,
  onRemove,
}: {
  disabled: boolean;
  onRemove: (amount: number) => Promise<RemoveStockResult>;
}) {
  const [amount, setAmount] = useState("1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError("Enter 1 or more");
      return;
    }
    setPending(true);
    setError("");
    const res = await onRemove(parsed);
    setPending(false);
    if (!res.ok) setError(res.message);
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <input
        type="number"
        min={1}
        step={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Amount to remove"
        disabled={disabled}
        className="min-h-[36px] w-14 rounded-md border border-ink/20 bg-field px-2 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="min-h-[36px] flex-1 rounded-md border border-claret/30 px-2 py-1 text-xs font-medium text-claret transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {pending ? "Removing…" : "Remove stock"}
      </button>
      {error && <p className="w-full text-[10px] text-claret">{error}</p>}
    </div>
  );
}

// Takes a listing off the site entirely — for a genuinely bad entry
// (duplicate, wrong price), not a stock_quantity correction. A native
// confirm() is enough friction for a staff-only tool doing something
// irreversible; no need for a custom two-step UI.
function DeleteListingControl({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => Promise<DeleteListingResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (!window.confirm(`Remove "${label}" from the store entirely? This can't be undone.`)) return;
    setPending(true);
    setError("");
    const res = await onDelete();
    setPending(false);
    if (!res.ok) setError(res.message);
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="min-h-[36px] w-full rounded-md border border-claret/50 bg-claret-soft px-2 py-1 text-xs font-medium text-claret transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {pending ? "Removing…" : "Delete listing"}
      </button>
      {error && <p className="mt-1 text-[10px] text-claret">{error}</p>}
    </div>
  );
}

export function Dashboard({
  initialOrders,
  initialBooksByIsbn,
  initialMerchandiseById,
  addBookError,
  bookAdded,
  addMerchError,
  merchAdded,
  loadError,
}: {
  initialOrders: OrderRow[];
  initialBooksByIsbn: Record<string, BookRow>;
  initialMerchandiseById: Record<string, MerchandiseRow>;
  addBookError?: string;
  bookAdded?: string;
  addMerchError?: string;
  merchAdded?: string;
  loadError?: string;
}) {
  const [supabase] = useState(() => getBrowserClient());
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [booksByIsbn, setBooksByIsbn] = useState<Record<string, BookRow>>(initialBooksByIsbn);
  const [merchandiseById, setMerchandiseById] =
    useState<Record<string, MerchandiseRow>>(initialMerchandiseById);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());
  // A redirect from addBookAction/addMerchandiseAction lands back on
  // /product-b with a query param — jump straight to the tab that
  // triggered it so the confirmation banner (or error) is visible without
  // staff having to click back to where they were.
  const [activeTab, setActiveTab] = useState<TabKey>(
    bookAdded || addBookError ? "add-book" : merchAdded || addMerchError ? "add-merch" : "pre-orders"
  );
  const [announcement, setAnnouncement] = useState(
    bookAdded ? `Added ${bookAdded}` : merchAdded ? `Added ${merchAdded}` : ""
  );

  // Add-book form fields are lifted into state so a Google Books search
  // result can prefill them — the form still submits natively via
  // action={addBookAction}, this just controls what's in the inputs at
  // submit time.
  const [newIsbn, setNewIsbn] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [newAuthorBio, setNewAuthorBio] = useState("");
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
    setNewDescription(c.description ?? "");
    setNewCoverUrl(c.coverUrl ?? "");
    setSearchResults(null);
  }

  // postgres_changes never replays events missed while the socket was
  // down, and the orders list is otherwise only ever grown by live
  // INSERTs — so a pre-order placed during the SSR→SUBSCRIBED gap or any
  // reconnect window would be silently absent from the queue until a full
  // reload. On every reconnect, re-pull the authoritative current set.
  async function resyncOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("order_id, customer_id, isbn, quantity, order_status, created_at")
      .eq("order_status", "preorder")
      .order("created_at", { ascending: false });
    if (error || !data) return;
    setOrders((prev) => {
      const known = new Set(prev.map((o) => o.order_id));
      const missed = data.filter((o) => !known.has(o.order_id));
      if (missed.length > 0) {
        setAnnouncement(
          `Reconnected — ${missed.length} pre-order${missed.length === 1 ? "" : "s"} synced`
        );
      }
      return data as OrderRow[];
    });
  }

  async function resyncBooks() {
    const { data, error } = await supabase
      .from("books")
      .select("isbn, book_title, author_name, stock_quantity, cover_url, price");
    if (error || !data) return;
    setBooksByIsbn(Object.fromEntries((data as BookRow[]).map((b) => [b.isbn, b])));
  }

  async function resyncMerchandise() {
    const { data, error } = await supabase
      .from("merchandise")
      .select("id, item_name, category, price, stock_quantity, image_url");
    if (error || !data) return;
    setMerchandiseById(Object.fromEntries((data as MerchandiseRow[]).map((m) => [m.id, m])));
  }

  const ordersStatus = useRealtimeSubscription(
    supabase,
    "product-b-orders",
    { event: "INSERT", schema: "public", table: "orders", filter: "order_status=eq.preorder" },
    (payload) => {
      const row = payload.new as unknown as OrderRow;
      setOrders((prev) =>
        prev.some((o) => o.order_id === row.order_id) ? prev : [row, ...prev]
      );
      setAnnouncement(`New pre-order: ${row.order_id}`);
      setJustArrived((prev) => new Set(prev).add(row.order_id));
      setTimeout(() => {
        setJustArrived((prev) => {
          const next = new Set(prev);
          next.delete(row.order_id);
          return next;
        });
      }, ARRIVAL_HIGHLIGHT_MS);
    },
    resyncOrders
  );

  const booksStatus = useRealtimeSubscription(
    supabase,
    "product-b-books",
    // "*" (not just UPDATE) so a book another staff session just added
    // via addBookAction — or deleted via deleteBookAction — appears here
    // live too, not only stock changes.
    { event: "*", schema: "public", table: "books" },
    (payload) => {
      if (payload.eventType === "DELETE") {
        const isbn = (payload.old as unknown as BookRow).isbn;
        setBooksByIsbn((prev) => {
          if (!isbn || !(isbn in prev)) return prev;
          const next = { ...prev };
          delete next[isbn];
          return next;
        });
        return;
      }
      const row = payload.new as unknown as BookRow;
      setBooksByIsbn((prev) => ({ ...prev, [row.isbn]: row }));
    },
    resyncBooks
  );

  const merchandiseStatus = useRealtimeSubscription(
    supabase,
    "product-b-merchandise",
    { event: "*", schema: "public", table: "merchandise" },
    (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as unknown as MerchandiseRow).id;
        setMerchandiseById((prev) => {
          if (!id || !(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      const row = payload.new as unknown as MerchandiseRow;
      setMerchandiseById((prev) => ({ ...prev, [row.id]: row }));
    },
    resyncMerchandise
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
    <main className="mx-auto max-w-7xl px-6 py-16">
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

      <div
        role="tablist"
        aria-label="Inventory sections"
        className="mt-8 flex flex-wrap items-center justify-between gap-2 border-b border-ink/10"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-[52px] flex-1 whitespace-nowrap border-b-2 px-4 py-4 text-base font-medium transition-transform duration-150 hover:scale-105 ${
              activeTab === tab.key
                ? "border-accent text-ink"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* One-line "what this tab is for" note, so staff (especially anyone
          new) know how each section is meant to be used — e.g. that
          Pending Pre-Orders is the live pickup queue, not a history log. */}
      <p className="mt-4 max-w-3xl text-sm text-ink/60">
        {TABS.find((tab) => tab.key === activeTab)?.description}
      </p>

      {activeTab === "pre-orders" && (
        <section role="tabpanel" className="mt-8">
          {orders.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No pending pre-orders right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {orders.map((o) => (
                <article
                  key={o.order_id}
                  className={`flex flex-col overflow-hidden rounded-lg border transition-colors duration-1000 ${
                    justArrived.has(o.order_id)
                      ? "border-accent bg-accent-soft"
                      : "border-ink/10 bg-surface"
                  }`}
                >
                  <CardImage src={booksByIsbn[o.isbn]?.cover_url ?? null} alt="" aspect="portrait" />
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="font-mono text-xs text-ink/60">{o.order_id}</p>
                    <p className="text-ink">
                      {booksByIsbn[o.isbn]?.book_title ?? o.isbn} &times; {o.quantity}
                    </p>
                    <p className="mt-auto text-sm text-ink/60">Customer: {o.customer_id}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "stock" && (
        <section role="tabpanel" className="mt-8">
          {flaggedBooks.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No titles in the catalog yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {flaggedBooks.map((f) => (
                <article
                  key={f.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface"
                >
                  <CardImage src={booksByIsbn[f.id]?.cover_url ?? null} alt="" aspect="portrait" />
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="truncate text-ink">{booksByIsbn[f.id]?.book_title ?? f.id}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      {booksByIsbn[f.id]?.price !== undefined && (
                        <span className="font-mono text-sm text-ink/50">
                          {currencyFormatter.format(booksByIsbn[f.id]?.price ?? 0)}
                        </span>
                      )}
                      <span className="font-mono text-sm text-ink/60">{f.stockQuantity ?? "—"}</span>
                    </div>
                    <StampBadge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</StampBadge>
                    <StockRemoveControl
                      disabled={!f.stockQuantity}
                      onRemove={async (amount) => {
                        const res = await removeBookStockAction(f.id, amount);
                        if (res.ok) {
                          setBooksByIsbn((prev) => {
                            const existing = prev[f.id];
                            return existing
                              ? { ...prev, [f.id]: { ...existing, stock_quantity: res.stockQuantity } }
                              : prev;
                          });
                        }
                        return res;
                      }}
                    />
                    <DeleteListingControl
                      label={booksByIsbn[f.id]?.book_title ?? f.id}
                      onDelete={async () => {
                        const res = await deleteBookAction(f.id);
                        if (res.ok) {
                          setBooksByIsbn((prev) => {
                            const next = { ...prev };
                            delete next[f.id];
                            return next;
                          });
                        }
                        return res;
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "merch-stock" && (
        <section role="tabpanel" className="mt-8">
          {flaggedMerchandise.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No cards or gifts in the catalog yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {flaggedMerchandise.map((f) => (
                <article
                  key={f.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface"
                >
                  <CardImage src={merchandiseById[f.id]?.image_url ?? null} alt="" aspect="square" />
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="truncate text-ink">{merchandiseById[f.id]?.item_name ?? f.id}</p>
                    {merchandiseById[f.id]?.category !== undefined && (
                      <p className="text-xs capitalize text-ink/50">{merchandiseById[f.id]?.category}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      {merchandiseById[f.id]?.price !== undefined && (
                        <span className="font-mono text-sm text-ink/50">
                          {currencyFormatter.format(merchandiseById[f.id]?.price ?? 0)}
                        </span>
                      )}
                      <span className="font-mono text-sm text-ink/60">{f.stockQuantity ?? "—"}</span>
                    </div>
                    <StampBadge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</StampBadge>
                    <StockRemoveControl
                      disabled={!f.stockQuantity}
                      onRemove={async (amount) => {
                        const res = await removeMerchandiseStockAction(f.id, amount);
                        if (res.ok) {
                          setMerchandiseById((prev) => {
                            const existing = prev[f.id];
                            return existing
                              ? { ...prev, [f.id]: { ...existing, stock_quantity: res.stockQuantity } }
                              : prev;
                          });
                        }
                        return res;
                      }}
                    />
                    <DeleteListingControl
                      label={merchandiseById[f.id]?.item_name ?? f.id}
                      onDelete={async () => {
                        const res = await deleteMerchandiseAction(f.id);
                        if (res.ok) {
                          setMerchandiseById((prev) => {
                            const next = { ...prev };
                            delete next[f.id];
                            return next;
                          });
                        }
                        return res;
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "add-book" && (
        <section role="tabpanel" className="mt-8">
          {bookAdded && (
            <p role="status" className="mt-4 rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-ink">
              Added &ldquo;{bookAdded}&rdquo; to the catalog.
            </p>
          )}

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
                className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="min-h-[44px] flex-none rounded-md border border-ink/20 px-4 text-sm font-medium text-ink transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
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
                      className="flex w-full items-center gap-3 rounded-md border border-ink/10 bg-field p-2 text-left transition-transform duration-150 hover:scale-[1.02] hover:border-accent"
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
                <p className="text-sm text-ink">This cover will be saved on add.</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 font-mono text-ink"
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
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
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
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
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
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
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
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label htmlFor="cover_url" className="block text-sm font-medium text-ink">
                  Cover asset URL <span className="font-normal text-ink/50">(optional)</span>
                </label>
                <input
                  id="cover_url"
                  name="cover_url"
                  type="url"
                  placeholder="Leave blank to auto-fetch from Google Books by ISBN"
                  value={newCoverUrl}
                  onChange={(e) => setNewCoverUrl(e.target.value)}
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="description" className="block text-sm font-medium text-ink">
                  Description <span className="font-normal text-ink/50">(optional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Leave blank to auto-fetch from Google Books by ISBN"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="author_bio" className="block text-sm font-medium text-ink">
                  Author bio <span className="font-normal text-ink/50">(optional)</span>
                </label>
                <textarea
                  id="author_bio"
                  name="author_bio"
                  rows={3}
                  placeholder="No auto-fetch source for this one — type it in, or leave blank"
                  value={newAuthorBio}
                  onChange={(e) => setNewAuthorBio(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
            </div>
            <button
              type="submit"
              className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105"
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
      )}

      {activeTab === "add-merch" && (
        <section role="tabpanel" className="mt-8">
          {merchAdded && (
            <p role="status" className="mt-4 rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-ink">
              Added &ldquo;{merchAdded}&rdquo; to merchandise.
            </p>
          )}

          <form
            action={addMerchandiseAction}
            className="mt-4 space-y-4 rounded-lg border border-ink/10 bg-surface p-4"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="item_name" className="block text-sm font-medium text-ink">
                  Item name
                </label>
                <input
                  id="item_name"
                  name="item_name"
                  type="text"
                  required
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-ink">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue="gift"
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                >
                  <option value="gift">Gift</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label htmlFor="merch_stock_quantity" className="block text-sm font-medium text-ink">
                  Stock quantity
                </label>
                <input
                  id="merch_stock_quantity"
                  name="stock_quantity"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Leave blank if not yet inventoried"
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label htmlFor="merch_price" className="block text-sm font-medium text-ink">
                  Price
                </label>
                <input
                  id="merch_price"
                  name="price"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  placeholder="0.00"
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label htmlFor="merch_image_url" className="block text-sm font-medium text-ink">
                  Image URL <span className="font-normal text-ink/50">(optional)</span>
                </label>
                <input
                  id="merch_image_url"
                  name="image_url"
                  type="url"
                  placeholder="No auto-fetch source for merchandise — paste a product photo URL, or leave blank"
                  className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
                />
              </div>
            </div>
            <button
              type="submit"
              className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105"
            >
              Add merchandise
            </button>

            {addMerchError && (
              <p
                role="alert"
                className="rounded-md border border-claret/30 bg-claret-soft p-3 text-sm text-claret"
              >
                {addMerchError}
              </p>
            )}
          </form>
        </section>
      )}
    </main>
  );
}
