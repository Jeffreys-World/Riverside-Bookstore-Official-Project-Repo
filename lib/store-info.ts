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

// Same fictional-flavor status as STORE_HOURS/STORE_POLICIES above — the
// .example domain and 555 exchange are the standard reserved-for-fiction
// placeholders (RFC 2606 / NANP), not a real address to route mail/calls to.
export const STORE_CONTACT = {
  email: "hello@riversidebooks.example",
  phone: "(718) 555-0142",
} as const;

// Pre-written Q&A for the FAQ page (app/product-c/page.tsx) — the pain
// point this whole product exists for is "common questions get asked
// repeatedly and pull staff away from the register," so the most-asked
// ones should be answerable without typing anything into the chatbot at
// all. Answers stay consistent with STORE_HOURS/STORE_POLICIES above and
// the features actually built (loyalty points, pre-order, RSVP tickets).
export interface StoreFaq {
  question: string;
  answer: string;
}

export const STORE_FAQS: StoreFaq[] = [
  {
    question: "Do you take pre-orders online?",
    answer:
      "Yes — search the catalog, add a title to your cart, and reserve it for in-store pickup. There's no online payment; you pay in person when you pick it up.",
  },
  {
    question: "How long will you hold a pre-order for me?",
    answer: "Pre-orders are held for pickup for 7 days before being released back to stock.",
  },
  {
    question: "What's your return policy?",
    answer:
      "Returns are accepted within 14 days with a receipt. Opened items are eligible for store credit only.",
  },
  {
    question: "Do you have a loyalty or rewards program?",
    answer:
      "Yes — create a free account and every purchase earns loyalty points, tracked under My Account.",
  },
  {
    question: "How do I check if a specific book is in stock?",
    answer:
      "Search for it in the catalog — stock status shows right on the title. You can also just ask here in the chat by title or ISBN.",
  },
  {
    question: "Do you sell gift cards?",
    answer:
      "We don't sell stored-value gift cards, but we do carry greeting cards and small gifts — browse the Gifts section. They're in-store only and aren't part of online pre-order.",
  },
  {
    question: "Are author event tickets refundable?",
    answer: "Event tickets are non-refundable, but they are transferable to someone else.",
  },
  {
    question: "What are your store hours?",
    answer: STORE_HOURS.replace(/\n/g, " · "),
  },
];
