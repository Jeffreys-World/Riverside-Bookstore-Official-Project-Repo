/**
 * lib/store-info.ts
 *
 * Static store hours and policies for Product C's chatbot. Not in the
 * database — types/schema.ts has no table for this (it rarely changes),
 * so it's plain fixture text rather than a query, same status as the
 * seeded demo catalog: fictional flavor for this coursework project's
 * made-up bookstore, not a real business's real hours.
 */

export const STORE_HOURS = `
Monday-Friday: 10am-7pm
Saturday: 10am-6pm
Sunday: 11am-5pm
`.trim();

export const STORE_POLICIES = `
- Pre-orders are held for pickup for 7 days before being released back to stock.
- Returns accepted within 14 days with receipt; store credit only on opened items.
- Author event tickets are non-refundable but transferable.
`.trim();
