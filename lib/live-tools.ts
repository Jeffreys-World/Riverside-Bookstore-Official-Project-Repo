/**
 * lib/live-tools.ts
 *
 * SINGLE SOURCE OF TRUTH for Gemini Live API tool names across all four
 * products. [FIXED: the original Live API doc's own prose and its own
 * integration matrix disagreed on 3 of 4 products' tool names
 * (get_loyalty_points vs get_loyalty_balance, evaluate_stock_threshold vs
 * evaluate_stock_status, get_upcoming_events vs fetch_events). Declaring
 * the names here, once, and having every product import LIVE_TOOLS
 * instead of retyping tool declarations is what prevents that drift from
 * happening again.]
 *
 * Architecture note (corrected from the original plan — see
 * 3_Gemini_Live_API_Integration_Plan_REVISED.md's "Architecture
 * Correction" note): the browser connects DIRECTLY to Gemini's WebSocket
 * using an ephemeral token from /app/api/live/token. Next.js does not sit
 * in the audio path. When the browser receives a `toolCall` frame:
 *   - READ-ONLY tools resolve directly client-side against Supabase
 *     (RLS-scoped, anon key).
 *   - MUTATING tools (currently only create_preorder) must NOT be
 *     resolved client-side. The browser instead calls
 *     POST /app/api/live/execute-tool (server-side, validated) and
 *     relays that result back into the Gemini session as the toolResponse.
 */

import { Type, type FunctionDeclaration } from "@google/genai";

export const LIVE_TOOL_NAMES = [
  "create_preorder", // Product A — MUTATING
  "get_loyalty_balance", // Product A — read-only
  "evaluate_stock_status", // Product B — read-only
  "fetch_pending_preorders", // Product B — read-only
  "check_inventory", // Product C — read-only
  "check_order_status", // Product C — read-only
  "get_upcoming_events", // Product C — read-only
  "synthesize_marketing_prompt", // Product D — read-only / non-mutating
] as const;

export type LiveToolName = (typeof LIVE_TOOL_NAMES)[number];

/**
 * The only tool(s) that execute server-side via execute-tool. Every other
 * registered tool is read-only and safe to resolve client-side under RLS.
 * Kept as its own narrow type (rather than reusing the full LiveToolName
 * union) so the exhaustiveness check in execute-tool/route.ts actually
 * catches a missing case if this set ever grows.
 */
export const MUTATING_TOOL_NAMES = ["create_preorder"] as const;
export type MutatingToolName = (typeof MUTATING_TOOL_NAMES)[number];

const MUTATING_TOOL_SET: ReadonlySet<string> = new Set(MUTATING_TOOL_NAMES);

export function isMutatingTool(name: string): name is MutatingToolName {
  return MUTATING_TOOL_SET.has(name);
}

// ---------------------------------------------------------------------------
// Tool declarations, grouped per product. Each product's Live session
// config includes only the declarations it needs (see each product's own
// CLAUDE.md, "Voice Integration" section).
// ---------------------------------------------------------------------------

export const productAToolDeclarations: FunctionDeclaration[] = [
  {
    name: "create_preorder",
    description:
      "Place a pre-order for in-store pickup with atomic stock reservation. MUTATING — executes server-side only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer_id: { type: Type.STRING, description: "Format: cust_XXXXX" },
        isbn: { type: Type.STRING, description: "13-digit ISBN" },
        quantity: { type: Type.INTEGER },
      },
      required: ["customer_id", "isbn", "quantity"],
    },
  },
  {
    name: "get_loyalty_balance",
    description: "Read a customer's current loyalty reward points balance.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customer_id: { type: Type.STRING, description: "Format: cust_XXXXX" },
      },
      required: ["customer_id"],
    },
  },
];

export const productBToolDeclarations: FunctionDeclaration[] = [
  {
    name: "evaluate_stock_status",
    description:
      "Evaluate current stock status for a book by ISBN: out_of_stock, low_stock, needs_attention, or in_stock.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        isbn: { type: Type.STRING, description: "13-digit ISBN" },
      },
      required: ["isbn"],
    },
  },
  {
    name: "fetch_pending_preorders",
    description: "List all orders where order_status = 'preorder'.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

export const productCToolDeclarations: FunctionDeclaration[] = [
  {
    name: "check_inventory",
    description:
      "Search the live catalog for current stock status and price. Covers books (match by title, author name, or 13-digit ISBN) and gift shop merchandise (cards and gifts, match by item name). Returns price and stock status for every match.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "A book title, author name, ISBN, or the name of a card/gift item.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "check_order_status",
    description: "Look up an order's status. Requires the exact order_id.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        order_id: { type: Type.STRING, description: "Format: ord_XXXXX" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "get_upcoming_events",
    description: "List upcoming author events.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

export const productDToolDeclarations: FunctionDeclaration[] = [
  {
    name: "synthesize_marketing_prompt",
    description:
      "Feed a dictated transcript into generateContent() to produce Instagram, Newsletter, and Staff Pick Card copy. genre is optional — do not require it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        transcript: { type: Type.STRING },
      },
      required: ["transcript"],
    },
  },
];
