"use client";

/**
 * Shared "which item is the detail drawer showing" state — BookCard and
 * GiftCard both live in different files (and gifts render server-side by
 * default), so this is a context rather than page-local state.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StockStatus } from "@/types/schema";

export type DetailProduct =
  | {
      kind: "book";
      isbn: string;
      title: string;
      author: string;
      coverUrl: string | null;
      description: string | null;
      authorBio: string | null;
      price: number;
      status: StockStatus;
      stockQuantity: number | null;
    }
  | {
      kind: "gift";
      id: string;
      title: string;
      category: string;
      price: number;
      status: StockStatus;
      stockQuantity: number | null;
      imageUrl: string | null;
    };

interface ProductDrawerContextValue {
  product: DetailProduct | null;
  open: (product: DetailProduct) => void;
  close: () => void;
}

const ProductDrawerContext = createContext<ProductDrawerContextValue | null>(null);

export function ProductDrawerProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<DetailProduct | null>(null);

  const value = useMemo(
    () => ({ product, open: (p: DetailProduct) => setProduct(p), close: () => setProduct(null) }),
    [product]
  );

  return <ProductDrawerContext.Provider value={value}>{children}</ProductDrawerContext.Provider>;
}

export function useProductDrawer(): ProductDrawerContextValue {
  const ctx = useContext(ProductDrawerContext);
  if (!ctx) throw new Error("useProductDrawer must be used within a ProductDrawerProvider");
  return ctx;
}
