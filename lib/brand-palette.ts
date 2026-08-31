/**
 * The brand palette as literal hex, for the one consumer that cannot read
 * CSS custom properties: `<canvas>` (app/product-d/generated-image.tsx).
 *
 * Everything else in the app must keep using the Tailwind tokens backed by
 * `--color-*` in app/globals.css — this module is not a second palette to
 * pick from, it is the canvas escape hatch. It previously lived inline in
 * generated-image.tsx with a comment admitting the duplication, and it had
 * already drifted: it still carried gold at the pre-contrast-fix `#B08D3F`
 * for text-coloured roles months after globals.css darkened it.
 *
 * `lib/brand-palette.test.ts` parses globals.css and asserts every value
 * below matches the `:root` block, so the two cannot drift again silently.
 */

/** Text/surface tokens, mirroring the `:root` block in app/globals.css. */
export const BRAND_HEX = {
  paper: "#F6F1E4",
  ink: "#1B2E28",
  accent: "#3F6C51",
  accentSoft: "#E4EDE7",
  /** The AA-darkened value. Correct for gold as *text* on a light surface. */
  gold: "#8A6D28",
  claret: "#7A2E2E",
  surface: "#EFE7D3",
} as const;

/**
 * Gold as a large *background* field, which is a different problem from gold
 * as text. globals.css darkened `--color-gold` to #8A6D28 so gold *text*
 * clears 4.5:1 on light surfaces; using that same darkened value as a
 * background behind dark ink text pushes the pair the wrong way. This is the
 * lighter display gold, kept deliberately for fills only, and the contrast
 * test below holds it to the same 4.5:1 bar as every other pair.
 */
const GOLD_FIELD = "#B08D3F";

export interface PostSwatch {
  bg: string;
  fg: string;
  footer: string;
}

/**
 * Backgrounds for the generated social post. Each pairs a fill with the
 * foreground that reads on it.
 *
 * Claret is deliberately absent. It is the error and destructive colour
 * (out of stock, failed validation, cancelled orders), so a marketing post
 * rendered in it says the opposite of what a marketing post is for — a
 * semantic mismatch, not a taste call. Four fills is ample variety.
 */
export const POST_PALETTE: readonly PostSwatch[] = [
  { bg: BRAND_HEX.accent, fg: BRAND_HEX.paper, footer: BRAND_HEX.accentSoft },
  { bg: BRAND_HEX.ink, fg: BRAND_HEX.paper, footer: GOLD_FIELD },
  // Footer is ink, not paper. The inline palette this replaced paired a
  // paper footer with the gold fill at 2.77:1 — under the 3:1 large-text
  // floor, and invisible in a thumbnail. Caught by the contrast test below.
  { bg: GOLD_FIELD, fg: BRAND_HEX.ink, footer: BRAND_HEX.ink },
  { bg: BRAND_HEX.surface, fg: BRAND_HEX.ink, footer: BRAND_HEX.accent },
] as const;

/**
 * Deterministic, not random — the same headline always produces the same
 * card, so regenerating content for one book looks consistent rather than
 * shuffling colours on every render.
 */
export function paletteFor(seed: string): PostSwatch {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return POST_PALETTE[Math.abs(hash) % POST_PALETTE.length]!;
}

/** WCAG 2.1 relative luminance for an `#rrggbb` string. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const int = parseInt(m[1]!, 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
