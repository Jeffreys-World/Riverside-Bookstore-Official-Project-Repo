import { describe, expect, it } from "vitest";
import { evaluateStockStatus, sortBySeverity } from "./inventory";

describe("evaluateStockStatus", () => {
  it('flags 0 as "out_of_stock"', () => {
    const [result] = evaluateStockStatus([{ isbn: "a", stockQuantity: 0 }]);
    expect(result?.status).toBe("out_of_stock");
  });

  it('flags 1 as "low_stock" (lower boundary)', () => {
    const [result] = evaluateStockStatus([{ isbn: "a", stockQuantity: 1 }]);
    expect(result?.status).toBe("low_stock");
  });

  it('flags 5 as "low_stock" (upper boundary)', () => {
    const [result] = evaluateStockStatus([{ isbn: "a", stockQuantity: 5 }]);
    expect(result?.status).toBe("low_stock");
  });

  it('flags 6 as "in_stock" (just above the low-stock boundary)', () => {
    const [result] = evaluateStockStatus([{ isbn: "a", stockQuantity: 6 }]);
    expect(result?.status).toBe("in_stock");
  });

  it('flags 40 as "in_stock"', () => {
    const [result] = evaluateStockStatus([{ isbn: "a", stockQuantity: 40 }]);
    expect(result?.status).toBe("in_stock");
  });

  it('flags null as "needs_attention" and never coerces it to 0', () => {
    const [result] = evaluateStockStatus([{ isbn: "a", stockQuantity: null }]);
    expect(result?.status).toBe("needs_attention");
    expect(result?.stockQuantity).toBeNull(); // not 0
  });

  it("preserves isbn and stockQuantity fields unchanged", () => {
    const [result] = evaluateStockStatus([{ isbn: "978-1", stockQuantity: 3 }]);
    expect(result).toEqual({ isbn: "978-1", stockQuantity: 3, status: "low_stock" });
  });
});

describe("sortBySeverity", () => {
  it("orders out_of_stock, needs_attention, low_stock, in_stock", () => {
    const input = evaluateStockStatus([
      { isbn: "in-stock-book", stockQuantity: 40 },
      { isbn: "low-stock-book", stockQuantity: 3 },
      { isbn: "oos-book", stockQuantity: 0 },
      { isbn: "null-book", stockQuantity: null },
    ]);

    const sorted = sortBySeverity(input).map((r) => r.isbn);

    expect(sorted).toEqual([
      "oos-book",
      "null-book",
      "low-stock-book",
      "in-stock-book",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = evaluateStockStatus([
      { isbn: "a", stockQuantity: 40 },
      { isbn: "b", stockQuantity: 0 },
    ]);
    const inputCopy = [...input];
    sortBySeverity(input);
    expect(input).toEqual(inputCopy);
  });
});
