import { describe, expect, it } from "vitest";
import { parseMarketingSections } from "./marketing-parse";

// Regression: parseSections' boundary lookahead was `\n[A-Z_]+:`, which a
// markdown-decorated next label (**NEWSLETTER:**) never matched — so the
// INSTAGRAM capture ran to end-of-string and the Instagram card came back
// containing all three sections with literal "NEWSLETTER:" text in it.
// Found by the 2026-08-27 full-app audit.
describe("parseMarketingSections", () => {
  it("parses the clean, undecorated format", () => {
    const raw = [
      "INSTAGRAM: A cozy autumn read. #books",
      "NEWSLETTER: Stop by this week for our staff pick.",
      "STAFF_PICK_CARD: The one you'll finish in a weekend.",
    ].join("\n");
    expect(parseMarketingSections(raw)).toEqual({
      instagram: "A cozy autumn read. #books",
      newsletter: "Stop by this week for our staff pick.",
      staffPickCard: "The one you'll finish in a weekend.",
    });
  });

  it("splits correctly when the model bolds the labels", () => {
    const raw = [
      "**INSTAGRAM:** A cozy autumn read. #books",
      "**NEWSLETTER:** Stop by this week for our staff pick.",
      "**STAFF_PICK_CARD:** The one you'll finish in a weekend.",
    ].join("\n");
    const out = parseMarketingSections(raw);
    expect(out.instagram).toBe("A cozy autumn read. #books");
    expect(out.newsletter).toBe("Stop by this week for our staff pick.");
    expect(out.staffPickCard).toBe("The one you'll finish in a weekend.");
    // The old bug: these leaked into the instagram field.
    expect(out.instagram).not.toMatch(/NEWSLETTER:|STAFF_PICK_CARD:/);
  });

  it("handles markdown heading and list-bullet decoration", () => {
    const raw = [
      "### INSTAGRAM: first",
      "- NEWSLETTER: second",
      "> STAFF_PICK_CARD: third",
    ].join("\n");
    expect(parseMarketingSections(raw)).toEqual({
      instagram: "first",
      newsletter: "second",
      staffPickCard: "third",
    });
  });

  it("keeps multi-line section bodies together", () => {
    const raw = "INSTAGRAM: line one\nline two\n\nNEWSLETTER: n\nSTAFF_PICK_CARD: s";
    const out = parseMarketingSections(raw);
    expect(out.instagram).toBe("line one\nline two");
    expect(out.newsletter).toBe("n");
  });

  it("returns empty strings when nothing matches", () => {
    expect(parseMarketingSections("total garbage with no labels")).toEqual({
      instagram: "",
      newsletter: "",
      staffPickCard: "",
    });
  });
});
