"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import {
  evaluateStockStatus,
  sortBySeverity,
  type FlaggedInventoryRecord,
} from "@/lib/inventory";
import { useRealtimeSubscription } from "@/lib/realtime";
import { addBookAction, addMerchandiseAction, searchBooksAction } from "./actions";
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

const TABS = [
  { key: "pre-orders", label: "Pending Pre-Orders" },
  { key: "stock", label: "Stock Levels" },
  { key: "merch-stock", label: "Merchandise Stock" },
  { key: "add-book", label: "Add a Book" },
  { key: "add-merch", label: "Add Merchandise" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

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

      <div
        role="tablist"
        aria-label="Inventory sections"
        className="mt-8 flex gap-1 overflow-x-auto border-b border-ink/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-accent text-ink"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pre-orders" && (
        <section role="tabpanel" className="mt-8">
          {orders.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No pending pre-orders right now.
            </p>
          ) : (
            <ul className="space-y-2">
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
      )}

      {activeTab === "stock" && (
        <section role="tabpanel" className="mt-8">
          {flaggedBooks.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No titles in the catalog yet.
            </p>
          ) : (
            <ul className="space-y-2">
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
      )}

      {activeTab === "merch-stock" && (
        <section role="tabpanel" className="mt-8">
          {flaggedMerchandise.length === 0 ? (
            <p className="rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
              No cards or gifts in the catalog yet.
            </p>
          ) : (
            <ul className="space-y-2">
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
      )}

      {activeTab === "add-book" && (
        <section role="tabpanel" className="mt-8">
          <p className="text-sm text-ink/60">
            Search Google Books to fill in the details below, or type everything by hand — cover
            and description are looked up automatically once added, unless you fill them in
            yourself.
          </p>

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
                <p className="text-sm text-ink">This cover will be saved on add.</p>
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
                className="mt-1 block w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
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
                className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
              />
            </div>
            <div>
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
                className="mt-1 block w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
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
      )}

      {activeTab === "add-merch" && (
        <section role="tabpanel" className="mt-8">
          <p className="text-sm text-ink/60">
            Cards and gifts — browse-only, not part of the pre-order flow.
          </p>

          {merchAdded && (
            <p role="status" className="mt-4 rounded-md border border-accent/30 bg-accent-soft p-3 text-sm text-ink">
              Added &ldquo;{merchAdded}&rdquo; to merchandise.
            </p>
          )}

          <form
            action={addMerchandiseAction}
            className="mt-4 space-y-4 rounded-lg border border-ink/10 bg-surface p-4"
          >
            <div>
              <label htmlFor="item_name" className="block text-sm font-medium text-ink">
                Item name
              </label>
              <input
                id="item_name"
                name="item_name"
                type="text"
                required
                className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
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
                className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
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
                className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
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
                className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper"
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
