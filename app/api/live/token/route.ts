/**
 * app/api/live/token/route.ts
 *
 * Shared across all four products' voice features. Mints a short-lived
 * Gemini Live API ephemeral token server-side and returns ONLY the token
 * to the browser — GOOGLE_API_KEY itself never leaves the server.
 *
 * The browser then connects DIRECTLY to Gemini's WebSocket using this
 * token (either via the @google/genai SDK's `ai.live.connect` with
 * `apiKey: token.name`, or a raw wss:// connection passing the token as
 * an `access_token` query param on the v1alpha endpoint). Next.js does
 * NOT proxy audio frames — see the architecture note in lib/live-tools.ts
 * and 3_Gemini_Live_API_Integration_Plan_REVISED.md.
 *
 * Each product calls this route from its own voice UI component
 * (KioskVoice.tsx, ChatWidget.tsx, etc.) — that client-side connection
 * code is product-specific and not part of this shared scaffold.
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/same-origin";
import { callerKey, createRateLimiter } from "@/lib/rate-limit";

// TODO: verify against https://ai.google.dev/gemini-api/docs/live-api
// before shipping — Live API model names change frequently. Confirm the
// current native-audio-capable Live model name and set it here or via env.
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025";

// A real voice session needs one token. Ten a minute leaves room for
// retries and a couple of tabs while still stopping a loop from running up
// the Gemini bill on the store's key.
const tokenRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const TOKEN_EXPIRE_MINUTES = 30; // how long the token can be used to send messages
const NEW_SESSION_EXPIRE_MINUTES = 1; // how long the token can be used to START a session

export async function POST(request: Request) {
  // This route spends the store's paid GOOGLE_API_KEY, so it must only
  // answer our own pages. Without this it minted Live tokens for any
  // caller on the internet (found by /qa on 2026-08-29).
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Not allowed from this origin." }, { status: 403 });
  }

  const limit = tokenRateLimiter.check(callerKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many voice sessions started just now. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  // Same-origin and per-IP rate limiting are both enforced above. Каller
  // identity stays the documented pre-auth kiosk model — a kiosk has no
  // browser session to check.
  let responseModalities: Modality[] = [Modality.AUDIO];
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.responseModalities)) {
      const requested: Modality[] = body.responseModalities.filter(
        (m: unknown): m is Modality =>
          typeof m === "string" && (Object.values(Modality) as string[]).includes(m)
      );
      if (requested.length > 0) responseModalities = requested;
    }
  } catch {
    // no body provided — use default AUDIO modality
  }

  const client = new GoogleGenAI({ apiKey });
  const expireTime = new Date(
    Date.now() + TOKEN_EXPIRE_MINUTES * 60 * 1000
  ).toISOString();
  const newSessionExpireTime = new Date(
    Date.now() + NEW_SESSION_EXPIRE_MINUTES * 60 * 1000
  ).toISOString();

  try {
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities,
          },
        },
      },
    });

    return NextResponse.json({
      token: token.name,
      expireTime,
      model: LIVE_MODEL,
    });
  } catch (err) {
    console.error(`Failed to mint Gemini Live ephemeral token: ${err}`);
    return NextResponse.json(
      { error: "Failed to create voice session token." },
      { status: 502 }
    );
  }
}
