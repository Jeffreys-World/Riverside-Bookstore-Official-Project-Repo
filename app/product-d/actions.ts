"use server";

/**
 * Product D — Marketing Content Generator. Plain creative generation,
 * no tools/function calling (unlike Product C) — matches
 * synthesize_marketing_prompt's description in lib/live-tools.ts:
 * "Feed a dictated transcript into generateContent() to produce
 * Instagram, Newsletter, and Staff Pick Card copy." No mutations, no
 * persistence — staff reviews the output on-screen and copies whatever
 * they want to actually publish elsewhere.
 */

import { getGeminiClient, TEXT_MODEL } from "@/lib/gemini";

export interface MarketingContentResult {
  instagram: string;
  newsletter: string;
  staffPickCard: string;
}

export type GenerateMarketingContentResult =
  | { ok: true; content: MarketingContentResult }
  | { ok: false; message: string };

const PROMPT_TEMPLATE = (transcript: string) => `You are writing marketing copy for Riverside Books, an independent bookstore. A staff member dictated this note about a title or event they want to promote:

"${transcript}"

Write three short pieces staff can review and publish as-is or lightly edit:
1. INSTAGRAM: a caption, under 150 words, warm and specific, 1-2 relevant hashtags.
2. NEWSLETTER: 2-3 sentences for an email newsletter blurb.
3. STAFF_PICK_CARD: a single punchy line, under 20 words, for an in-store shelf card.

Respond in exactly this format, nothing else:
INSTAGRAM: <text>
NEWSLETTER: <text>
STAFF_PICK_CARD: <text>`;

function parseSections(raw: string): MarketingContentResult {
  const get = (label: string) => {
    const match = raw.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`));
    return match ? match[1].trim() : "";
  };
  return {
    instagram: get("INSTAGRAM"),
    newsletter: get("NEWSLETTER"),
    staffPickCard: get("STAFF_PICK_CARD"),
  };
}

export async function generateMarketingContentAction(
  transcript: string
): Promise<GenerateMarketingContentResult> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return {
      ok: false,
      message: "Describe the book or event first — a sentence or two is enough.",
    };
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts: [{ text: PROMPT_TEMPLATE(trimmed) }] }],
    });

    const raw = response.text ?? "";
    const content = parseSections(raw);
    if (!content.instagram && !content.newsletter && !content.staffPickCard) {
      return { ok: false, message: "Didn't get usable content back — try rephrasing your note." };
    }
    return { ok: true, content };
  } catch (err) {
    console.error("Marketing content generation error:", err);
    return { ok: false, message: "Something went wrong generating content. Please try again." };
  }
}
