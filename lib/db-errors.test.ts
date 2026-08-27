import { describe, expect, it } from "vitest";
import { friendlyDbError, isMappedDbError } from "./db-errors";

// Several Product B actions redirected with error.message verbatim, so a
// staff member re-adding an already-listed ISBN saw
// `duplicate key value violates unique constraint "books_pkey"`.
// Found by the 2026-08-27 full-app audit.
describe("friendlyDbError", () => {
  it("maps a unique violation to plain copy", () => {
    expect(friendlyDbError({ code: "23505", message: "duplicate key ..." })).toBe(
      "That entry already exists."
    );
  });

  it("prefers a caller-supplied context-specific override", () => {
    expect(
      friendlyDbError(
        { code: "23505", message: "duplicate key ..." },
        { "23505": "A book with that ISBN is already listed." }
      )
    ).toBe("A book with that ISBN is already listed.");
  });

  it("maps numeric overflow", () => {
    expect(friendlyDbError({ code: "22003", message: "numeric field overflow" })).toBe(
      "That number is outside the allowed range."
    );
  });

  it("falls back to a generic message for an unmapped code", () => {
    expect(friendlyDbError({ code: "XX999", message: "internal" })).toBe(
      "Something went wrong saving that. Please try again."
    );
    expect(friendlyDbError({ message: "no code at all" })).toBe(
      "Something went wrong saving that. Please try again."
    );
  });

  it("never returns the raw Postgres message", () => {
    const raw = 'duplicate key value violates unique constraint "books_pkey"';
    expect(friendlyDbError({ code: "23505", message: raw })).not.toContain("constraint");
  });
});

describe("isMappedDbError", () => {
  it("is true for a known code and false for an unknown one", () => {
    expect(isMappedDbError({ code: "23505", message: "" })).toBe(true);
    expect(isMappedDbError({ code: "XX999", message: "" })).toBe(false);
  });

  it("counts an override as mapped", () => {
    expect(isMappedDbError({ code: "40001", message: "" }, { "40001": "Busy — retry." })).toBe(true);
  });
});
