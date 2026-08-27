import { stripMarkdownEmphasis } from "@/lib/markdown";

/**
 * Parses Gemini's three-section marketing response (Product D) into
 * structured fields. Kept out of the "use server" actions file so it can
 * be unit-tested directly.
 */

export interface MarketingContentResult {
  instagram: string;
  newsletter: string;
  staffPickCard: string;
}

const SECTION_LABELS = ["INSTAGRAM", "NEWSLETTER", "STAFF_PICK_CARD"] as const;

export function parseMarketingSections(raw: string): MarketingContentResult {
  // Flash models routinely decorate the section labels — **INSTAGRAM:**,
  // ### NEWSLETTER:, - STAFF_PICK_CARD: — and the old boundary lookahead
  // (`\n[A-Z_]+:`) never matched a decorated next label, so the INSTAGRAM
  // capture ran to end-of-string and swallowed the other two sections.
  // Normalise every label line to a bare "LABEL:" first, then split.
  let text = `\n${raw}`;
  for (const label of SECTION_LABELS) {
    // Tolerate markdown/list decoration before the label, around it, and
    // right after the colon (**INSTAGRAM:** / ### NEWSLETTER: / - _STAFF_PICK_CARD_:).
    text = text.replace(
      new RegExp(
        `\\n[ \\t>#-]*[*_]{0,3}[ \\t]*(${label})[ \\t]*[*_]{0,3}[ \\t]*:[ \\t]*[*_]{0,3}[ \\t]*`,
        "gi"
      ),
      `\n${label}: `
    );
  }
  const boundary = `(?=\\n(?:${SECTION_LABELS.join("|")}):|$)`;
  const get = (label: string) => {
    const match = text.match(new RegExp(`\\n${label}:\\s*([\\s\\S]*?)${boundary}`));
    return stripMarkdownEmphasis(match?.[1]?.trim() ?? "");
  };
  return {
    instagram: get("INSTAGRAM"),
    newsletter: get("NEWSLETTER"),
    staffPickCard: get("STAFF_PICK_CARD"),
  };
}
