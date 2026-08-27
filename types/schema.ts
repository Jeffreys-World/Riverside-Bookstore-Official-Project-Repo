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

export const stockQuantitySchema = z
  .number({ invalid_type_error: "Stock quantity must be a whole number." })
  .int("Stock quantity must be a whole number.")
  .nonnegative("Stock quantity can't be negative.")
  .nullable();

// ---------------------------------------------------------------------------
// Core row types
// ---------------------------------------------------------------------------

export interface Customer {
  customer_id: string; // cust_XXXXX
  signup_date: string; // YYYY-MM-DD
  reward_points: number;
  // 0034_customer_auth.sql — both nullable. null auth_user_id = a
  // pre-auth / seeded row (e.g. cust_demo01) still reached via the
  // localStorage cust_XXXXX fallback path, not a real login yet.
  auth_user_id: string | null; // uuid, FK to auth.users
  email: string | null;
}

// customerCredentialsSchema — Product A's email + password sign-up / login
// (app/product-a/actions.ts). Supabase Auth re-validates server-side; this
// is the fast, friendly first check, same pattern as every other action's
// zod gate.
export const customerCredentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type CustomerCredentials = z.infer<typeof customerCredentialsSchema>;

export interface Book {
  ISBN: string; // ISBN-13
  book_title: string;
  author_name: string;
  stock_quantity: StockQuantity; // null = not yet inventoried, NEVER coerce to 0
  reorder_threshold: number; // default 5
  cover_url: string | null; // null = no Google Books match / not yet backfilled
  description: string | null; // null = no Google Books match / not yet backfilled
  author_bio: string | null; // null = not entered — staff-only field, no auto-lookup source
  price: number; // >= 0, display-only — no checkout/payment flow reads this yet
}

// ---------------------------------------------------------------------------
// Merchandise — cards and small gifts. Separate from `books` because these
// items have no ISBN; not part of the pre-order flow (see
// supabase/migrations/0009_merchandise.sql).
// ---------------------------------------------------------------------------

export const MERCHANDISE_CATEGORIES = ["card", "gift"] as const;
export type MerchandiseCategory = (typeof MERCHANDISE_CATEGORIES)[number];
export const merchandiseCategorySchema = z.enum(MERCHANDISE_CATEGORIES);

export interface Merchandise {
  id: string; // uuid
  item_name: string;
  category: MerchandiseCategory;
  price: number; // >= 0
  stock_quantity: StockQuantity; // null = not yet inventoried, NEVER coerce to 0
  image_url: string | null; // 0025_merchandise_image_url.sql — staff-entered, no auto-lookup source
}

export interface AuthorEvent {
  id: string; // uuid
  isbn: string | null; // FK to books, nullable (e.g. a panel with no single tied title)
  event_title: string;
  author_name: string | null; // null for pre-0015 rows that predate this column
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
  location: string; // 0015_events_details_and_rsvp.sql — defaults to the store's own address
  image_url: string | null; // 0017_events_images.sql — null for pre-0017 rows until backfilled
}

export interface EventTicket {
  ticket_id: string; // tkt_XXXXX
  customer_id: string;
  event_id: string; // uuid, FK to author_events.id [FIXED: this field was event_title, which
  // doesn't match the actual event_tickets table (0001_initial_schema.sql) — it has event_id, not
  // event_title. Never actually read/written before 0015 wired up the real RSVP flow.]
}

export const rsvpRequestSchema = z.object({
  customer_id: z.string().regex(CUSTOMER_ID_REGEX),
  event_id: z.string().uuid(),
});
export type RsvpRequest = z.infer<typeof rsvpRequestSchema>;

export interface Order {
  order_id: string; // ord_XXXXX
  customer_id: string;
  ISBN: string;
  quantity: number;
  order_status: OrderStatus;
  pickup_date: string | null; // YYYY-MM-DD, null until checkout adds it (0014_orders_pickup_slot.sql)
  pickup_window: string | null; // one of PICKUP_WINDOWS below, null until checkout adds it
}

// ---------------------------------------------------------------------------
// Reward tiers — informational only (0030_loyalty_program_expansion.sql).
// reward_points now accrues as $1 = 1 point (floor(price * quantity) per
// create_preorder call) rather than a flat +1 per order. Redemption for
// every tier here happens in-store/manually — there's no voucher or
// discount-code system in this app, matching its pay-in-person model — so
// this list is just what the account page shows as "unlocked"/"next".
// ---------------------------------------------------------------------------
export interface RewardTier {
  points: number;
  label: string;
  description: string;
}

export const REWARD_TIERS: RewardTier[] = [
  {
    points: 100,
    label: "$5 store credit",
    description: "Redeem for a $5 store credit voucher at the register.",
  },
  {
    points: 250,
    label: "Free ARC + tote bag",
    description: "A free Advance Reader Copy from review stock, plus a branded tote bag.",
  },
  {
    points: 500,
    label: "20% off + VIP signing invite",
    description: "20% off a single purchase, and an invitation to the next VIP author signing.",
  },
  {
    points: 1000,
    label: "Private Reader Hour",
    description: "One hour of early access to the annual store sale, with refreshments.",
  },
];

// Points cost for "Blind Date with a Book" — pegged to the same tier that
// would otherwise unlock a free ARC + tote, since a mystery book is a
// comparable value.
export const BLIND_DATE_POINTS_COST = 250;

// ---------------------------------------------------------------------------
// Pickup scheduling — checkout's date + time-window selector.
// Windows are fixed, not derived per-day from STORE_HOURS
// (lib/store-info.ts) — the store's shortest open day (Sunday, 11am-5pm)
// still covers most of these, and exact per-day window validation isn't
// worth the complexity for a pay-in-person pickup slot that's a courtesy
// scheduling aid, not a hard commitment.
// ---------------------------------------------------------------------------

export const PICKUP_WINDOWS = [
  "10:00 AM – 1:00 PM",
  "1:00 PM – 4:00 PM",
  "4:00 PM – 6:30 PM",
] as const;
export type PickupWindow = (typeof PICKUP_WINDOWS)[number];
export const pickupWindowSchema = z.enum(PICKUP_WINDOWS);

export const PICKUP_LOCATION = {
  name: "Riverside Books",
  addressLine1: "47-10 Austell Place, 2nd Floor",
  addressLine2: "Long Island City, NY 11101",
} as const;

// The store is a single physical location in Long Island City. Every
// event time must render in store-local time no matter where the code
// runs — the Product C chatbot formats event times in a 'use server'
// action (server TZ = UTC on Vercel), and the Events tab formats them in
// the customer's browser TZ. Without a pinned zone the same event shows
// three different times. Seed rows store an explicit Eastern offset.
export const STORE_TIME_ZONE = "America/New_York";

// ---------------------------------------------------------------------------
// Order status — display label + StampBadge tone (UI layer only).
// ---------------------------------------------------------------------------

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  preorder: "Reserved for pickup",
  shipped: "Shipped",
  completed: "Picked up",
};

export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "positive" | "pending" | "negative" | "neutral"
> = {
  pending: "pending",
  preorder: "pending",
  shipped: "positive",
  completed: "positive",
};

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

// checkoutRequestSchema — the cart drawer's multi-item checkout
// (app/product-a/checkout/actions.ts's checkoutAction). Submits one
// create_preorder RPC call per line item (see that file's comment for why:
// each item's stock check stays atomically correct, and one sold-out item
// doesn't fail the whole cart) rather than a single multi-row RPC.
/** Today's date (YYYY-MM-DD) in the store's timezone — the reference
 *  point for "is this pickup date in the past". */
export function todayInStoreTimeZone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(new Date());
}

export const checkoutRequestSchema = z.object({
  customer_id: z.string().regex(CUSTOMER_ID_REGEX),
  items: z
    .array(
      z.object({
        isbn: z.string().regex(ISBN13_REGEX),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  pickup_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    // The form carries noValidate, so the <input min> isn't enforced on
    // submit — without this a customer could pick a past date and the
    // order (and Product B's pickup queue) would show it.
    .refine((d) => d >= todayInStoreTimeZone(), "Choose a pickup date today or later."),
  pickup_window: pickupWindowSchema,
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

// addBookRequestSchema — Product B's staff "add book" flow
// (app/product-b/actions.ts's addBookAction). stock_quantity is optional
// on purpose: leaving it blank stores null ("not yet inventoried"), the
// same valid state books can already be in — never coerce a blank field
// to 0 here.
export const priceSchema = z
  .number({ invalid_type_error: "Price must be a number." })
  .nonnegative("Price can't be negative.");

// description/cover_url are optional, staff-entered overrides — left
// blank, addBookAction falls back to its existing Google Books
// auto-lookup by ISBN. Given manually, that lookup is skipped entirely:
// this is the escape hatch for a title Google Books doesn't have, or
// (see TODOS.md's 2026-08-26 asset-fix entry) has under the wrong ISBN.
export const addBookRequestSchema = z.object({
  isbn: z.string().regex(ISBN13_REGEX, "ISBN must be a valid 13-digit ISBN starting with 978 or 979."),
  book_title: z.string().trim().min(1, "Title is required."),
  author_name: z.string().trim().min(1, "Author is required."),
  description: z.string().trim().min(1, "Description can't be blank — leave the field empty instead.").nullable(),
  cover_url: z.string().trim().url("Cover asset URL must be a valid URL.").nullable(),
  // Staff-only, no Google Books equivalent to auto-fetch from (unlike
  // description/cover_url) — always either what staff typed, or null.
  author_bio: z.string().trim().min(1, "Author bio can't be blank — leave the field empty instead.").nullable(),
  stock_quantity: stockQuantitySchema,
  price: priceSchema,
});
export type AddBookRequest = z.infer<typeof addBookRequestSchema>;

// addMerchandiseRequestSchema — Product B's staff "add merchandise" flow
// (app/product-b/actions.ts's addMerchandiseAction). No ISBN/Google Books
// lookup, unlike books — merchandise.item_name is the table's own unique
// key (0009_merchandise.sql), so a duplicate name fails atomically the
// same way a duplicate ISBN does for books.
export const addMerchandiseRequestSchema = z.object({
  item_name: z.string().trim().min(1, "Item name is required."),
  category: merchandiseCategorySchema,
  stock_quantity: stockQuantitySchema,
  price: priceSchema,
  // Optional, staff-entered — no auto-lookup source for generic
  // merchandise the way Google Books/Open Library exist for ISBNs.
  image_url: z.string().trim().url("Image URL must be a valid URL.").nullable(),
});
export type AddMerchandiseRequest = z.infer<typeof addMerchandiseRequestSchema>;

// ---------------------------------------------------------------------------
// Display formatting helpers (UI layer only — never used for storage)
// ---------------------------------------------------------------------------

/** "2026-09-05T18:30:00-04:00" -> "September 5, 2026 at 6:30 PM" (store-local, always). */
export function formatEventTimestamp(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: STORE_TIME_ZONE,
  }).format(d);
}

/** "2026-09-05T18:30:00-04:00" -> "September 5, 2026" — the Events page's separate Date column. */
export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(iso));
}

/** "2026-09-05T18:30:00-04:00" -> "6:30 PM" — the Events page's separate Time column. */
export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(iso));
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
