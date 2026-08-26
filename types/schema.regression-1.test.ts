import { describe, expect, it } from "vitest";
import { addBookRequestSchema, addMerchandiseRequestSchema } from "./schema";

// Regression: ISSUE-008 — Add a Book/Merchandise validation failures showed
// only the bare word "Invalid" with no field-level detail (Zod's default
// message for a failed .regex()/.url()/number type check).
// Found by /qa on 2026-08-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-26-pm.md
describe("addBookRequestSchema error messages", () => {
  const validBook = {
    isbn: "9780143127550",
    book_title: "The Song of Achilles",
    author_name: "Madeline Miller",
    description: null,
    cover_url: null,
    author_bio: null,
    stock_quantity: 1,
    price: 12,
  };

  it("names the ISBN format on a bad prefix", () => {
    const result = addBookRequestSchema.safeParse({ ...validBook, isbn: "9999999999999" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "ISBN must be a valid 13-digit ISBN starting with 978 or 979."
      );
    }
  });

  it("names the field on a missing title", () => {
    const result = addBookRequestSchema.safeParse({ ...validBook, book_title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Title is required.");
    }
  });

  it("names the field on a missing author", () => {
    const result = addBookRequestSchema.safeParse({ ...validBook, author_name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Author is required.");
    }
  });

  it("names the field on a malformed cover URL", () => {
    const result = addBookRequestSchema.safeParse({ ...validBook, cover_url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Cover asset URL must be a valid URL.");
    }
  });

  it("names the field on a negative price", () => {
    const result = addBookRequestSchema.safeParse({ ...validBook, price: -5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Price can't be negative.");
    }
  });

  it("still accepts a valid book with null optional fields", () => {
    expect(addBookRequestSchema.safeParse(validBook).success).toBe(true);
  });
});

describe("addMerchandiseRequestSchema error messages", () => {
  const validItem = {
    item_name: "Riverside Books Tote Bag",
    category: "gift",
    stock_quantity: 10,
    price: 14,
    image_url: null,
  };

  it("names the field on a missing item name", () => {
    const result = addMerchandiseRequestSchema.safeParse({ ...validItem, item_name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Item name is required.");
    }
  });

  it("names the field on a malformed image URL", () => {
    const result = addMerchandiseRequestSchema.safeParse({ ...validItem, image_url: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Image URL must be a valid URL.");
    }
  });
});
