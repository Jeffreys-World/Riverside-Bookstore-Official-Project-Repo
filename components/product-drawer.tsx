"use client";

import { useState } from "react";
import { useProductDrawer } from "./product-drawer-provider";
import { useCart } from "./cart-provider";
import { StampBadge, type StampTone } from "./stamp-badge";
import { fulfillmentBadgeFor } from "@/lib/inventory";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function ProductDrawer() {
  const { product, close } = useProductDrawer();
  const { addItem, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const isOpen = product !== null;
  // Gifts aren't part of pre-order (browse-only, CLAUDE.md), so
  // "Reserve"/"Pre-Order" — the book fulfillment badge's language — would
  // be misleading here; gifts get plain in-stock/out-of-stock wording
  // instead, matching gift-card.tsx's badge.
  const badge: { label: string; tone: StampTone } | null =
    product?.kind === "book"
      ? fulfillmentBadgeFor(product.status)
      : product?.kind === "gift"
        ? product.status === "out_of_stock"
          ? { label: "Out of stock", tone: "negative" }
          : { label: "In store", tone: "positive" }
        : null;

  const inCart = product?.kind === "book" ? items.find((i) => i.isbn === product.isbn) : undefined;
  const orderable = product?.kind === "book" && (product.status === "in_stock" || product.status === "low_stock");
  const atMax = !!inCart && inCart.quantity >= inCart.maxQuantity;

  function handleAdd() {
    if (product?.kind !== "book") return;
    addItem({
      isbn: product.isbn,
      book_title: product.title,
      author_name: product.author,
      cover_url: product.coverUrl,
      price: product.price,
      maxQuantity: product.stockQuantity ?? 0,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={product ? product.title : "Product details"}
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-paper shadow-xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-end px-5 py-4">
          <button
            type="button"
            onClick={close}
            aria-label="Close product details"
            className="min-h-[44px] min-w-[44px] rounded-md text-ink/60 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {product && (
          <div className="flex-1 px-6 pb-8">
            <div className="mx-auto w-40 sm:w-48">
              {product.kind === "book" && product.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.coverUrl}
                  alt=""
                  className="aspect-[2/3] w-full rounded object-cover shadow-md"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center rounded bg-surface text-xs text-ink/40">
                  No cover available
                </div>
              )}
            </div>

            <h2 className="mt-6 font-serif text-2xl text-ink">{product.title}</h2>
            <p className="mt-1 text-ink/60">
              {product.kind === "book" ? product.author : `${product.category === "card" ? "Card" : "Gift"}`}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <span className="font-mono text-2xl font-semibold text-gold">
                {currencyFormatter.format(product.price)}
              </span>
              {badge && <StampBadge tone={badge.tone}>{badge.label}</StampBadge>}
            </div>

            {product.kind === "book" ? (
              <>
                <h3 className="mt-6 text-sm font-medium uppercase tracking-wide text-ink/50">
                  About this book
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/80">
                  {product.description || "No description available yet for this title."}
                </p>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!orderable || atMax}
                  className="mt-6 min-h-[44px] w-full rounded-md bg-accent px-6 py-2 font-medium text-paper transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {!orderable ? "Ask a bookseller" : atMax ? "Max in cart" : justAdded ? "Added ✓" : "Add to cart"}
                </button>
                {!orderable && (
                  <p className="mt-2 text-xs text-ink/50">
                    This title isn&apos;t currently on the shelf — a bookseller can check stock in person.
                  </p>
                )}
              </>
            ) : (
              <>
                <h3 className="mt-6 text-sm font-medium uppercase tracking-wide text-ink/50">
                  Specifications
                </h3>
                <dl className="mt-2 space-y-1 text-sm text-ink/80">
                  <div className="flex justify-between">
                    <dt className="text-ink/50">Category</dt>
                    <dd className="capitalize">{product.category}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/50">Availability</dt>
                    <dd>{product.stockQuantity !== null ? `${product.stockQuantity} on the shelf` : "Not yet inventoried"}</dd>
                  </div>
                </dl>
                <p className="mt-6 rounded-md border border-ink/10 bg-surface p-3 text-sm text-ink/70">
                  In-store only — cards and gifts aren&apos;t part of online pre-order. Ask a bookseller to
                  hold one at the register.
                </p>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
