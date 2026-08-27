"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function CartDrawer() {
  const { items, isOpen, subtotal, close, removeItem, setQuantity } = useCart();

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={`fixed inset-0 z-40 bg-scrim/50 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-paper shadow-xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="font-serif text-lg text-ink">Your cart</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="min-h-[44px] min-w-[44px] rounded-md text-ink/60 transition-transform duration-150 hover:scale-125 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="mt-8 text-center text-sm text-ink/60">
              Your cart is empty. Add a title to reserve it for pickup.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.isbn} className="flex gap-3">
                  {item.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.cover_url}
                      alt=""
                      className="h-20 w-14 flex-none rounded object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="flex h-20 w-14 flex-none items-center justify-center rounded bg-surface text-[10px] text-ink/40"
                    >
                      No cover
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.book_title}</p>
                    <p className="truncate text-xs text-ink/60">{item.author_name}</p>
                    <p className="mt-1 font-mono text-xs text-ink/70">
                      {currencyFormatter.format(item.price)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="sr-only" htmlFor={`qty-${item.isbn}`}>
                        Quantity for {item.book_title}
                      </label>
                      <div className="flex items-center rounded-md border border-ink/20">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.isbn, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${item.book_title}`}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink transition-transform duration-150 hover:scale-125 disabled:opacity-30 disabled:hover:scale-100"
                        >
                          −
                        </button>
                        <span
                          id={`qty-${item.isbn}`}
                          className="min-w-[1.5rem] text-center font-mono text-sm text-ink"
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.isbn, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          aria-label={`Increase quantity of ${item.book_title}`}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink transition-transform duration-150 hover:scale-125 disabled:opacity-30 disabled:hover:scale-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.isbn)}
                        className="inline-flex min-h-[44px] items-center px-2 text-xs text-claret underline-offset-2 transition-transform duration-150 hover:scale-105 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-ink/10 px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/70">Subtotal</span>
            <span className="font-mono text-base text-ink">{currencyFormatter.format(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-ink/50">Pay in person at pickup — nothing is charged online.</p>
          <Link
            href="/product-a/checkout"
            onClick={close}
            aria-disabled={items.length === 0}
            className={`mt-4 block min-h-[44px] rounded-md px-6 py-2 text-center font-medium transition-transform duration-150 ${
              items.length === 0
                ? "pointer-events-none border border-ink/15 bg-ink/5 text-ink/40"
                : "bg-accent text-paper hover:scale-105 hover:bg-accent/90"
            }`}
          >
            Go to checkout
          </Link>
        </div>
      </aside>
    </>
  );
}
