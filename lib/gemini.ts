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

import { GoogleGenAI } from "@google/genai";

export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.0-flash";

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
