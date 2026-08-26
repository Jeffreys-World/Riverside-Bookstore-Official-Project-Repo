"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import { StampBadge } from "@/components/stamp-badge";
import { fulfillmentBadgeFor } from "@/lib/inventory";
import type { StockStatus } from "@/types/schema";

interface BookCardProps {
  isbn: string;
  book_title: string;
  author_name: string;
  cover_url: string | null;
  description: string | null;
  price: number;
  status: StockStatus;
  stockQuantity: number | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function BookCard(book: BookCardProps) {
  const { addItem, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const badge = fulfillmentBadgeFor(book.status);
  const inCart = items.find((i) => i.isbn === book.isbn);
  const atMax = !!inCart && inCart.quantity >= inCart.maxQuantity;

  // create_preorder (supabase/migrations/0011_loyalty_stamps.sql) hard-rejects
  // any order once stock_quantity isn't > the requested quantity — per
  // CLAUDE.md's concurrency rule, that check is load-bearing, not a gap to
  // route around client-side. So a "Pre-Order" badge here can only ever be
  // informational for out_of_stock/needs_attention titles: adding one to
  // the cart would just fail at checkout, so the button stays disabled
  // instead of promising an order the backend can't fulfill.
  const orderable = book.status === "in_stock" || book.status === "low_stock";
  const maxQuantity = book.stockQuantity ?? 0;

  function handleAdd() {
    addItem({
      isbn: book.isbn,
      book_title: book.book_title,
      author_name: book.author_name,
      cover_url: book.cover_url,
      price: book.price,
      maxQuantity,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[2/3] w-full bg-ink/5">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink/40">
            No cover available
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg leading-snug text-ink">{book.book_title}</h3>
        </div>
        <p className="text-sm text-ink/60">{book.author_name}</p>
        {book.description && (
          <p aria-hidden className="line-clamp-2 text-xs text-ink/50">
            {book.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-mono text-base font-semibold text-gold">
            {currencyFormatter.format(book.price)}
          </span>
          <StampBadge tone={badge.tone}>{badge.label}</StampBadge>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!orderable || atMax}
          className="mt-2 min-h-[44px] rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!orderable
            ? "Ask a bookseller"
            : atMax
              ? "Max in cart"
              : justAdded
                ? "Added ✓"
                : "Add to cart"}
        </button>
      </div>
    </article>
  );
}
