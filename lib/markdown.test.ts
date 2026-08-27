import { describe, expect, it } from "vitest";
import { stripMarkdownEmphasis } from "./markdown";

// Regression: ISSUE-002 — Gemini-generated marketing captions wrapped book
// titles in markdown emphasis (*Klara and the Sun*), which showed up as
// literal asterisks once pasted into an Instagram caption instead of italics.
// Found by /qa on 2026-08-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-26.md
describe("stripMarkdownEmphasis", () => {
  it("strips single-asterisk emphasis around a title", () => {
    expect(stripMarkdownEmphasis("Ishiguro's *Klara and the Sun* explores love.")).toBe(
      "Ishiguro's Klara and the Sun explores love."
    );
  });

  it("strips double-asterisk (bold) emphasis", () => {
    expect(stripMarkdownEmphasis("Don't miss **Atomic Habits** this week.")).toBe(
      "Don't miss Atomic Habits this week."
    );
  });

  it("strips underscore emphasis", () => {
    expect(stripMarkdownEmphasis("A staff pick: _The Song of Achilles_.")).toBe(
      "A staff pick: The Song of Achilles."
    );
  });

  it("strips multiple emphasized spans in the same string", () => {
    expect(stripMarkdownEmphasis("*Sapiens* meets **Klara and the Sun** this fall.")).toBe(
      "Sapiens meets Klara and the Sun this fall."
    );
  });

  it("leaves plain text with no emphasis markers unchanged", () => {
    const plain = "Stop by Riverside Books this week to grab your copy.";
    expect(stripMarkdownEmphasis(plain)).toBe(plain);
  });

  // Regression: the underscore rule was unbounded (/_(.+?)_/) and also
  // collapsed multi-underscore hashtags/handles that Instagram captions
  // carry verbatim. Found by the 2026-08-27 full-app audit.
  it("leaves multi-underscore hashtags and handles intact", () => {
    expect(stripMarkdownEmphasis("New arrivals #cozy_autumn_reads @river_side_books")).toBe(
      "New arrivals #cozy_autumn_reads @river_side_books"
    );
    expect(stripMarkdownEmphasis("snake_case_identifier stays")).toBe(
      "snake_case_identifier stays"
    );
  });

  it("still strips a genuine _italic phrase_ at word boundaries", () => {
    expect(stripMarkdownEmphasis("A staff pick: _The Song of Achilles_ this month.")).toBe(
      "A staff pick: The Song of Achilles this month."
    );
  });
});
