import { describe, expect, it } from "vitest";
import { upgradeCoverUrl } from "./google-books";

// A 2026-08-27 cover audit found every Google Books cover was the fixed
// 128px &zoom=1 thumbnail. upgradeCoverUrl swaps in a &w=800 render of the
// same volume so the catalog cards aren't soft.
describe("upgradeCoverUrl", () => {
  it("returns null for empty input", () => {
    expect(upgradeCoverUrl(null)).toBeNull();
    expect(upgradeCoverUrl(undefined)).toBeNull();
    expect(upgradeCoverUrl("")).toBeNull();
  });

  it("upgrades http to https", () => {
    expect(upgradeCoverUrl("http://covers.openlibrary.org/b/isbn/123-L.jpg")).toBe(
      "https://covers.openlibrary.org/b/isbn/123-L.jpg"
    );
  });

  it("leaves non-Google URLs otherwise untouched", () => {
    const ol = "https://covers.openlibrary.org/b/isbn/9780060850524-L.jpg?default=false";
    expect(upgradeCoverUrl(ol)).toBe(ol);
  });

  it("adds &w=800 and drops &edge=curl on a Google Books thumbnail", () => {
    const raw =
      "http://books.google.com/books/content?id=XfFvDwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api";
    expect(upgradeCoverUrl(raw)).toBe(
      "https://books.google.com/books/content?id=XfFvDwAAQBAJ&printsec=frontcover&img=1&zoom=1&w=800&source=gbs_api"
    );
  });

  it("handles a thumbnail with no &edge=curl", () => {
    const raw =
      "https://books.google.com/books/content?id=YqvezwEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api";
    expect(upgradeCoverUrl(raw)).toBe(
      "https://books.google.com/books/content?id=YqvezwEACAAJ&printsec=frontcover&img=1&zoom=1&w=800&source=gbs_api"
    );
  });

  it("is idempotent — a URL already sized is left alone", () => {
    const sized =
      "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&w=800&source=gbs_api";
    expect(upgradeCoverUrl(sized)).toBe(sized);
  });

  it("normalises a higher zoom level down to zoom=1 before sizing", () => {
    const raw = "https://books.google.com/books/content?id=abc&img=1&zoom=3&source=gbs_api";
    expect(upgradeCoverUrl(raw)).toBe(
      "https://books.google.com/books/content?id=abc&img=1&zoom=1&w=800&source=gbs_api"
    );
  });
});
