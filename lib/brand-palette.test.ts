import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_HEX,
  POST_PALETTE,
  contrastRatio,
  paletteFor,
  relativeLuminance,
} from "./brand-palette";

/**
 * `<canvas>` cannot read CSS custom properties, so app/product-d's generated
 * social image needs the brand palette as literal hex. That duplication is
 * unavoidable; letting it drift is not. These tests read globals.css and
 * assert the two agree — the previous inline copy carried gold at the
 * pre-contrast-fix #B08D3F long after globals.css had darkened it.
 */

const GLOBALS_CSS = readFileSync(
  path.resolve(__dirname, "..", "app", "globals.css"),
  "utf8"
);

// Comments are stripped before slicing: globals.css's own commentary
// mentions ".dark" while explaining the gold fix, so slicing the raw text at
// the first literal ".dark" cut the :root block off mid-way and hid gold,
// claret and surface from these assertions.
const CSS_NO_COMMENTS = GLOBALS_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Pull `--color-<name>: R G B;` out of the `:root` block only, not `.dark`. */
function rootTokenHex(name: string): string {
  const root = CSS_NO_COMMENTS.slice(
    CSS_NO_COMMENTS.indexOf(":root"),
    CSS_NO_COMMENTS.indexOf(".dark")
  );
  const m = new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(root);
  if (!m) throw new Error(`--color-${name} not found in the :root block`);
  const hex = [m[1], m[2], m[3]]
    .map((c) => Number(c).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
}

describe("BRAND_HEX mirrors globals.css :root", () => {
  const cases: Array<[keyof typeof BRAND_HEX, string]> = [
    ["paper", "paper"],
    ["ink", "ink"],
    ["accent", "accent"],
    ["accentSoft", "accent-soft"],
    ["gold", "gold"],
    ["claret", "claret"],
    ["surface", "surface"],
  ];

  for (const [key, token] of cases) {
    it(`${key} matches --color-${token}`, () => {
      expect(BRAND_HEX[key].toUpperCase()).toBe(rootTokenHex(token));
    });
  }

  it("carries the AA-darkened gold, not the pre-fix #B08D3F", () => {
    // The regression this whole file exists to prevent.
    expect(BRAND_HEX.gold.toUpperCase()).toBe("#8A6D28");
  });
});

describe("POST_PALETTE", () => {
  it("never uses claret as a fill", () => {
    // Claret is the error/destructive colour. A marketing post rendered in
    // it says the opposite of what the post is for.
    const fills = POST_PALETTE.map((s) => s.bg.toUpperCase());
    expect(fills).not.toContain(BRAND_HEX.claret.toUpperCase());
  });

  it("offers four fills", () => {
    expect(POST_PALETTE).toHaveLength(4);
    expect(new Set(POST_PALETTE.map((s) => s.bg)).size).toBe(4);
  });

  it("every fill clears 4.5:1 against its own foreground", () => {
    for (const swatch of POST_PALETTE) {
      const ratio = contrastRatio(swatch.bg, swatch.fg);
      expect(
        ratio,
        `${swatch.fg} on ${swatch.bg} is only ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every footer colour clears 3:1 against its fill", () => {
    // The footer wordmark renders at 600 28px, which is WCAG large text.
    for (const swatch of POST_PALETTE) {
      const ratio = contrastRatio(swatch.bg, swatch.footer);
      expect(
        ratio,
        `footer ${swatch.footer} on ${swatch.bg} is only ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("paletteFor", () => {
  it("is deterministic — one headline always yields one card", () => {
    expect(paletteFor("Klara and the Sun")).toEqual(paletteFor("Klara and the Sun"));
  });

  it("returns a swatch from POST_PALETTE for any input", () => {
    for (const seed of ["", "1984", "a much longer staff pick line about autumn", "🙂"]) {
      expect(POST_PALETTE).toContainEqual(paletteFor(seed));
    }
  });

  it("spreads different seeds across more than one swatch", () => {
    const seeds = ["1984", "Circe", "Educated", "Sapiens", "Gone Girl", "The Alchemist"];
    expect(new Set(seeds.map((s) => paletteFor(s).bg)).size).toBeGreaterThan(1);
  });
});

describe("contrast helpers", () => {
  it("computes the known black/white extremes", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
  });

  it("is order-independent", () => {
    expect(contrastRatio(BRAND_HEX.ink, BRAND_HEX.paper)).toBeCloseTo(
      contrastRatio(BRAND_HEX.paper, BRAND_HEX.ink),
      10
    );
  });

  it("rejects a malformed colour rather than scoring it", () => {
    expect(() => relativeLuminance("not-a-colour")).toThrow();
  });
});
