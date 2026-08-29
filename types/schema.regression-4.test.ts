import { describe, expect, it } from "vitest";
import { MAX_ORDER_QUANTITY, checkoutRequestSchema, createPreorderRequestSchema } from "./schema";

// Regression: ISSUE-004 — quantity was `z.number().int().positive()` with no
// upper bound, so a tampered localStorage cart carrying 99999999999 sailed
// through validation, overflowed Postgres `integer`, and came back to the
// customer as "something went wrong placing this item. Please try again." —
// a retry that can never succeed.
// Found by /qa on 2026-08-29
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-08-29.md

const validLine = { isbn: "9780451524935", quantity: 1 };
const futureDate = "2099-01-01";

function checkout(quantity: number) {
  return checkoutRequestSchema.safeParse({
    customer_id: "cust_demo01",
    items: [{ ...validLine, quantity }],
    pickup_date: futureDate,
    pickup_window: "10:00 AM – 1:00 PM",
  });
}

describe("order quantity bounds", () => {
  it("accepts a normal line quantity", () => {
    expect(checkout(1).success).toBe(true);
    expect(checkout(MAX_ORDER_QUANTITY).success).toBe(true);
  });

  it("refuses a quantity past the cap with actionable copy", () => {
    const result = checkout(MAX_ORDER_QUANTITY + 1);
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.message).toMatch(
      /more copies than we can reserve/i
    );
  });

  it("refuses an int-overflowing quantity before it reaches Postgres", () => {
    const result = checkout(99999999999);
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.message).toMatch(
      /more copies than we can reserve/i
    );
    expect(MAX_ORDER_QUANTITY).toBeLessThan(2147483647);
  });

  it("still refuses zero, negative and fractional quantities", () => {
    expect(checkout(0).success).toBe(false);
    expect(checkout(-3).success).toBe(false);
    expect(checkout(1.5).success).toBe(false);
    expect(checkout(-3).success === false && checkout(-3).error.issues[0]?.message).toMatch(
      /at least 1/i
    );
  });

  it("applies the same bounds to the kiosk create_preorder route", () => {
    const base = { customer_id: "cust_demo01", isbn: "9780451524935" };
    expect(createPreorderRequestSchema.safeParse({ ...base, quantity: 1 }).success).toBe(true);
    expect(
      createPreorderRequestSchema.safeParse({ ...base, quantity: MAX_ORDER_QUANTITY + 1 }).success
    ).toBe(false);
    expect(createPreorderRequestSchema.safeParse({ ...base, quantity: 99999999999 }).success).toBe(
      false
    );
  });
});
