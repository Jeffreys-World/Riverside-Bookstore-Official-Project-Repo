/**
 * types/schema.ts
 *
 * SINGLE SOURCE OF TRUTH for the shared Riverside Bookstore data contract.
 *
 * Every product (A/B/C/D) imports from here. Do NOT redeclare these types,
 * the OrderStatus union, or the ID format regexes locally in your product
 * folder — that hand-retyping is exactly what caused the schema to drift
 * across the original planning docs (see 4_Changes_Summary.md, items 2-6).
 *
 * If you need a field this file doesn't have, add it here as its own
 * commit, separate from the feature that needed it (see Solo Build Plan,
 * Section 2.1) — don't invent it locally in your product.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Order status — canonical, lowercase. [FIXED: original docs mixed
// 'Completed'/'Shipped' with 'pending'/'preorder'.]
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  "pending",
  "preorder",
  "shipped",
  "completed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderStatusSchema = z.enum(ORDER_STATUSES);

// ---------------------------------------------------------------------------
// ID formats — canonical. [FIXED: Ticket ID previously had two competing
// formats across documents; standardized on tkt_XXXXX to match cust_/ord_.]
// ---------------------------------------------------------------------------

export const CUSTOMER_ID_REGEX = /^cust_[a-zA-Z0-9]{5,}$/;
export const ORDER_ID_REGEX = /^ord_[a-zA-Z0-9]{5,}$/;
export const TICKET_ID_REGEX = /^tkt_[a-zA-Z0-9]{5,}$/;
export const ISBN13_REGEX = /^(97[89])-?\d{1,5}-?\d{1,7}-?\d{1,7}-?\d$/;

// ---------------------------------------------------------------------------
// stock_quantity — explicitly nullable everywhere. [FIXED: master schema
// always allowed null; Product A's original CLAUDE.md didn't account for
// it, so a null-stock row in the customer catalog was unhandled. Every
// product that reads this column must use StockQuantity, not `number`.]
// ---------------------------------------------------------------------------

export type StockQuantity = number | null;

export const stockQuantitySchema = z.number().int().nonnegative().nullable();

// ---------------------------------------------------------------------------
// Core row types
// ---------------------------------------------------------------------------

export interface Customer {
  customer_id: string; // cust_XXXXX
  signup_date: string; // YYYY-MM-DD
  reward_points: number;
}

export interface Book {
  ISBN: string; // ISBN-13
  book_title: string;
  author_name: string;
  stock_quantity: StockQuantity; // null = not yet inventoried, NEVER coerce to 0
  reorder_threshold: number; // default 5
  cover_url: string | null; // null = no Google Books match / not yet backfilled
  description: string | null; // null = no Google Books match / not yet backfilled
}

export interface AuthorEvent {
  event_title: string;
  event_description: string;
  /**
   * Stored as TIMESTAMPTZ / ISO 8601 in Postgres. [FIXED: the original
   * master schema table's own "format" column and "example value" column
   * contradicted each other, and disagreed with the TIMESTAMPTZ type
   * separately declared in Products A and C's CLAUDE.md. Format for
   * display in the UI layer with formatEventTimestamp() below — never
   * store a pre-formatted string.]
   */
  author_event_at: string; // ISO 8601, e.g. "2026-09-05T18:30:00-07:00"
}

export interface EventTicket {
  ticket_id: string; // tkt_XXXXX
  customer_id: string;
  event_title: string;
}

export interface Order {
  order_id: string; // ord_XXXXX
  customer_id: string;
  ISBN: string;
  quantity: number;
  order_status: OrderStatus;
}

// ---------------------------------------------------------------------------
// Zod request schemas for the shared, cross-product operations
// (create_preorder is the one mutating Live API tool — see lib/live-tools.ts)
// ---------------------------------------------------------------------------

export const createPreorderRequestSchema = z.object({
  customer_id: z.string().regex(CUSTOMER_ID_REGEX),
  isbn: z.string().regex(ISBN13_REGEX),
  quantity: z.number().int().positive(),
});
export type CreatePreorderRequest = z.infer<typeof createPreorderRequestSchema>;

// addBookRequestSchema — Product B's staff "add book" flow
// (app/product-b/actions.ts's addBookAction). stock_quantity is optional
// on purpose: leaving it blank stores null ("not yet inventoried"), the
// same valid state books can already be in — never coerce a blank field
// to 0 here.
export const addBookRequestSchema = z.object({
  isbn: z.string().regex(ISBN13_REGEX),
  book_title: z.string().trim().min(1),
  author_name: z.string().trim().min(1),
  stock_quantity: stockQuantitySchema,
});
export type AddBookRequest = z.infer<typeof addBookRequestSchema>;

// ---------------------------------------------------------------------------
// Display formatting helpers (UI layer only — never used for storage)
// ---------------------------------------------------------------------------

/** "2026-09-05T18:30:00-07:00" -> "September 5, 2026 at 6:30 PM" */
export function formatEventTimestamp(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

/**
 * Stock status flagging. [FIXED: this is the canonical implementation —
 * see lib/inventory.ts for the full pure function + tests. Re-exported
 * here as the type only, so every product can type against it without
 * importing Product B's module if they don't need the logic itself.]
 */
export const STOCK_STATUSES = [
  "out_of_stock",
  "low_stock",
  "needs_attention",
  "in_stock",
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];
