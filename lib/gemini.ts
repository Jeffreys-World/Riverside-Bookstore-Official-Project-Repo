/**
 * lib/gemini.ts
 *
 * Server-only Gemini text-generation client, shared by Product C's
 * support chatbot (function-calling against live Supabase reads) and
 * Product D's marketing content generator (plain creative generation,
 * no tools). Distinct from the Live API token route
 * (app/api/live/token/route.ts) — that mints ephemeral tokens for the
 * browser's direct WebSocket connection; this calls generateContent()
 * directly server-side for products that don't need the audio path.
 */

import { ApiError, GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";

// [FIXED: gemini-2.0-flash was deprecated — verified live against Google's
// API (404 "no longer available") on 2026-08-25. gemini-3.6-flash is the
// confirmed-working replacement as of this build; Gemini model names
// change frequently, so re-verify before assuming this is still current.
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash";

// Demo-day backup chain for generateTextWithFallback(). Google doesn't
// publish per-model free-tier numbers (they're only visible per-account in
// the AI Studio dashboard), but the 429 payload itself confirms the quota
// is scoped as GenerateRequestsPerDayPerProjectPerModel-FreeTier — i.e.
// every distinct model name has its own separate daily bucket. So once
// TEXT_MODEL's quota is burned out (easy to hit at 20 req/day while
// testing), one of these should still have a fresh quota of its own.
//
// The full model list from GET /v1beta/models is NOT a reliable source
// for this — it still lists retired models (gemini-2.5-flash,
// gemini-2.5-flash-lite, gemini-2.5-pro all 404 with "no longer available
// to new users" despite appearing there). This list was instead verified
// by actually calling :generateContent on each candidate directly
// (2026-08-26); re-verify the same way before trusting it again, same as
// TEXT_MODEL above. Order is "closest replacement first," not a ranking
// of capability. gemini-flash-latest is last: it 503'd (transient/high
// demand) during that check rather than confirming clean, but a 503 is
// itself retryable, so it's still worth trying after the confirmed-clean
// options.
const FALLBACK_TEXT_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (typeof window !== "undefined") {
    throw new Error(
      "getGeminiClient() was called from browser code. This is a " +
        "server-only client and must never run in the browser."
    );
  }
  if (!client) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GOOGLE_API_KEY.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// Retryable: quota exhaustion (429), a model retired out from under us
// (404 — this list has already gone stale once, see the comment above),
// and transient server-side trouble (500/503) — trying a different model
// can plausibly succeed for all of these. Anything else (400 bad
// request, auth errors, etc.) is a real problem that switching models
// won't fix, so it's rethrown immediately rather than silently burning
// through the whole fallback chain.
function isRetryableAcrossModels(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 429 || err.status === 404 || err.status >= 500);
}

/**
 * Same call as ai.models.generateContent(), but walks TEXT_MODEL then
 * FALLBACK_TEXT_MODELS in order, using the first one that doesn't fail
 * with a retryable error. Both call sites in one multi-turn exchange
 * (Product C's function-calling round trip) naturally land on the same
 * model, since the quota state that picked the fallback doesn't change
 * between those calls milliseconds apart.
 */
export async function generateTextWithFallback(
  params: Omit<GenerateContentParameters, "model">
): Promise<GenerateContentResponse> {
  const ai = getGeminiClient();
  const models = [TEXT_MODEL, ...FALLBACK_TEXT_MODELS];

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (err) {
      const next = models[i + 1];
      if (!next || !isRetryableAcrossModels(err)) throw err;
      console.warn(`Gemini model ${model} unavailable (${(err as ApiError).status}), falling back to ${next}`);
    }
  }
  // Unreachable — models is never empty — but keeps TypeScript satisfied.
  throw new Error("generateTextWithFallback: exhausted model list");
}
