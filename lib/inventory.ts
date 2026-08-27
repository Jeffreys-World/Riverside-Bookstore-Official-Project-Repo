/**
 * lib/inventory.ts
 *
 * Canonical stock-status evaluation logic. Originally specified as
 * Product B's responsibility, but promoted to shared /lib
 * because Product A's catalog view depends on the exact same null-safe
 * behavior — duplicating it per-product was the original gap that let
 * Product A's stock handling silently diverge from Product B's.
 *
 * If you're building Product B's dashboard UI, import evaluateStockStatus
 * and sortBySeverity from here rather than reimplementing them.
 *
 * `id` is a generic row identifier (ISBN for books, uuid for merchandise) —
 * this module doesn't care what kind of item it's flagging, only its
 * stock_quantity.
 */

import type { StockQuantity, StockStatus } from "@/types/schema";

export interface InventoryRecord {
  id: string;
  stockQuantity: StockQuantity;
}

export interface FlaggedInventoryRecord extends InventoryRecord {
  status: StockStatus;
}

/**
 * out_of_stock:     stockQuantity === 0
 * low_stock:         0 < stockQuantity <= 5
 * needs_attention:   stockQuantity === null   (NEVER coerce null to 0)
 * in_stock:           stockQuantity > 5
 */
export function evaluateStockStatus(
  records: readonly InventoryRecord[]
): FlaggedInventoryRecord[] {
  return records.map((record) => ({
    ...record,
    status: statusFor(record.stockQuantity),
  }));
}

function statusFor(stockQuantity: StockQuantity): StockStatus {
  if (stockQuantity === null) return "needs_attention";
  if (stockQuantity === 0) return "out_of_stock";
  if (stockQuantity <= 5) return "low_stock";
  return "in_stock";
}

/** Severity order for the "Flagged Titles" dashboard section. */
const SEVERITY_ORDER: Record<StockStatus, number> = {
  out_of_stock: 0,
  needs_attention: 1,
  low_stock: 2,
  in_stock: 3,
};

export function sortBySeverity(
  records: readonly FlaggedInventoryRecord[]
): FlaggedInventoryRecord[] {
  return [...records].sort(
    (a, b) => SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status]
  );
}

/**
 * Catalog fulfillment badge. There's no publication/release-date column in
 * the schema (CLAUDE.md's data contract doesn't list one) — "Pre-Order"
 * here means "not currently on the shelf, order it in and we'll fulfill it
 * when restocked," reusing the same stock-status signal rather than
 * inventing a new field. "Reserve" means it's on the shelf now and this
 * pre-order is holding a copy for pickup.
 */
export function fulfillmentBadgeFor(
  status: StockStatus
): { label: string; tone: "positive" | "pending" } {
  if (status === "in_stock" || status === "low_stock") {
    return { label: "Reserve", tone: "positive" };
  }
  return { label: "Pre-Order", tone: "pending" };
}

/**
 * PostgREST `.or()` filter for the support chatbot's book search
 * (app/product-c/actions.ts). A customer asks "do you have anything by
 * <author>" as often as they ask for a title, so all three of ISBN,
 * title, and author are matched — dropping `author_name` here is exactly
 * the gap that made the chatbot answer "we don't carry that" for books it
 * stocks. The caller has already stripped `,` `(` `)` (the characters that
 * break `.or()` syntax) from `query`.
 */
export function bookSearchOrFilter(query: string): string {
  return [
    `isbn.eq.${query}`,
    `book_title.ilike.%${query}%`,
    `author_name.ilike.%${query}%`,
  ].join(",");
}

/**
 * PostgREST `.or()` filter for the support chatbot's card/gift search.
 * Item names are specific ("Blank Greeting Card — Birthday"), so a whole-
 * phrase `ilike` on "greeting cards" misses them. Match each meaningful
 * word (de-pluralised so "cards" hits "Card"), and map the words "card"
 * and "gift" straight to the category so "do you sell gifts" lists the
 * whole category. Caller has already stripped `,` `(` `)`.
 */
export function merchSearchOrFilter(query: string): string {
  const lower = query.toLowerCase();
  const clauses = new Set<string>([`item_name.ilike.%${query}%`]);
  for (const word of lower.split(/\s+/)) {
    if (word.length > 3) clauses.add(`item_name.ilike.%${word.replace(/s$/, "")}%`);
  }
  if (/cards?/.test(lower)) clauses.add("category.eq.card");
  if (/gifts?/.test(lower)) clauses.add("category.eq.gift");
  return [...clauses].join(",");
}
