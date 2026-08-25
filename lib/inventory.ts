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
 */

import type { StockQuantity, StockStatus } from "@/types/schema";

export interface InventoryRecord {
  isbn: string;
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
