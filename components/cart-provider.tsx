"use client";

/**
 * Client-side cart for Product A's catalog -> drawer -> checkout flow.
 * There's no cart table in the schema — CLAUDE.md's data contract has no
 * row for "items a customer is currently considering," only `orders`
 * (created once checkout actually runs create_preorder per line item).
 * So the cart is pure browser state, persisted to localStorage the same
 * way lib/customer-id-storage.ts remembers the customer id, and it only
 * ever holds books: merchandise (cards/gifts) is browse-only per
 * CLAUDE.md, not wired into orders/pre-orders.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartItem {
  isbn: string;
  book_title: string;
  author_name: string;
  cover_url: string | null;
  price: number;
  quantity: number;
  maxQuantity: number;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  count: number;
  subtotal: number;
  addItem: (book: Omit<CartItem, "quantity">) => void;
  removeItem: (isbn: string) => void;
  setQuantity: (isbn: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "riverside_cart";

function loadInitialItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Cart starts empty on the server render and hydrates from
  // localStorage after mount — avoids an SSR/client markup mismatch,
  // same reasoning as customer-id-storage.ts never being read at render.
  useEffect(() => {
    setItems(loadInitialItems());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Private browsing / storage disabled — cart just won't survive a reload.
    }
  }, [items, hydrated]);

  const addItem = useCallback((book: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.isbn === book.isbn);
      if (existing) {
        const nextQty = Math.min(existing.quantity + 1, existing.maxQuantity);
        return prev.map((i) => (i.isbn === book.isbn ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { ...book, quantity: 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((isbn: string) => {
    setItems((prev) => prev.filter((i) => i.isbn !== isbn));
  }, []);

  const setQuantity = useCallback((isbn: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.isbn === isbn ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity)) } : i
      )
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((n, i) => n + i.price * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, isOpen, count, subtotal, addItem, removeItem, setQuantity, clear, open, close, toggle }),
    [items, isOpen, count, subtotal, addItem, removeItem, setQuantity, clear, open, close, toggle]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
