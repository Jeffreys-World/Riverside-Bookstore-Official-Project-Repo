import { describe, expect, it } from "vitest";
import {
  bookSearchOrFilter,
  evaluateStockStatus,
  merchSearchOrFilter,
  sortBySeverity,
} from "./inventory";

describe("evaluateStockStatus", () => {
  it('flags 0 as "out_of_stock"', () => {
    const [result] = evaluateStockStatus([{ id: "a", stockQuantity: 0 }]);
    expect(result?.status).toBe("out_of_stock");
  });

  it('flags 1 as "low_stock" (lower boundary)', () => {
    const [result] = evaluateStockStatus([{ id: "a", stockQuantity: 1 }]);
    expect(result?.status).toBe("low_stock");
  });

  it('flags 5 as "low_stock" (upper boundary)', () => {
    const [result] = evaluateStockStatus([{ id: "a", stockQuantity: 5 }]);
    expect(result?.status).toBe("low_stock");
  });

  it('flags 6 as "in_stock" (just above the low-stock boundary)', () => {
    const [result] = evaluateStockStatus([{ id: "a", stockQuantity: 6 }]);
    expect(result?.status).toBe("in_stock");
  });

  it('flags 40 as "in_stock"', () => {
    const [result] = evaluateStockStatus([{ id: "a", stockQuantity: 40 }]);
    expect(result?.status).toBe("in_stock");
  });

  it('flags null as "needs_attention" and never coerces it to 0', () => {
    const [result] = evaluateStockStatus([{ id: "a", stockQuantity: null }]);
    expect(result?.status).toBe("needs_attention");
    expect(result?.stockQuantity).toBeNull(); // not 0
  });

  it("preserves id and stockQuantity fields unchanged", () => {
    const [result] = evaluateStockStatus([{ id: "978-1", stockQuantity: 3 }]);
    expect(result).toEqual({ id: "978-1", stockQuantity: 3, status: "low_stock" });
  });
});

describe("sortBySeverity", () => {
  it("orders out_of_stock, needs_attention, low_stock, in_stock", () => {
    const input = evaluateStockStatus([
      { id: "in-stock-book", stockQuantity: 40 },
      { id: "low-stock-book", stockQuantity: 3 },
      { id: "oos-book", stockQuantity: 0 },
      { id: "null-book", stockQuantity: null },
    ]);

    const sorted = sortBySeverity(input).map((r) => r.id);

    expect(sorted).toEqual([
      "oos-book",
      "null-book",
      "low-stock-book",
      "in-stock-book",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = evaluateStockStatus([
      { id: "a", stockQuantity: 40 },
      { id: "b", stockQuantity: 0 },
    ]);
    const inputCopy = [...input];
    sortBySeverity(input);
    expect(input).toEqual(inputCopy);
  });
});

describe("bookSearchOrFilter", () => {
  // The support chatbot (app/product-c/actions.ts) answered "we don't
  // carry that" for in-stock books when asked by author, because its
  // PostgREST .or() filter only matched ISBN + title. This guards the fix.
  it("matches on ISBN, title, AND author", () => {
    const f = bookSearchOrFilter("George Orwell");
    expect(f).toContain("isbn.eq.George Orwell");
    expect(f).toContain("book_title.ilike.%George Orwell%");
    expect(f).toContain("author_name.ilike.%George Orwell%");
  });

  it("is a single comma-joined .or() argument list", () => {
    expect(bookSearchOrFilter("1984").split(",")).toHaveLength(3);
  });
});

describe("merchSearchOrFilter", () => {
  it('de-pluralises words so "greeting cards" matches "...Greeting Card..."', () => {
    const f = merchSearchOrFilter("greeting cards");
    expect(f).toContain("item_name.ilike.%greeting%");
    expect(f).toContain("item_name.ilike.%card%"); // "cards" -> "card"
  });

  it('maps the word "card" / "gift" to the category', () => {
    expect(merchSearchOrFilter("do you sell cards")).toContain("category.eq.card");
    expect(merchSearchOrFilter("any gifts?".replace(/[,()?]/g, ""))).toContain("category.eq.gift");
  });

  it("keeps the whole-phrase match and skips short filler words", () => {
    const f = merchSearchOrFilter("a tote bag");
    expect(f).toContain("item_name.ilike.%a tote bag%");
    expect(f).toContain("item_name.ilike.%tote%");
    expect(f).not.toContain("ilike.%a%"); // "a" is too short to add as its own clause
  });
});
