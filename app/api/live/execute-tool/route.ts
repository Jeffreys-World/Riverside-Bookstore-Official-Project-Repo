/**
 * app/api/live/execute-tool/route.ts
 *
 * Shared across all products, but in practice only ever called for
 * MUTATING Live API tool calls — currently just create_preorder from
 * Product A's voice kiosk. Read-only tools (check_inventory,
 * evaluate_stock_status, get_upcoming_events, get_loyalty_balance,
 * fetch_pending_preorders) resolve directly client-side against Supabase
 * under RLS and never hit this route — see lib/live-tools.ts.
 *
 * Flow: browser holds the Gemini WebSocket directly (see
 * app/api/live/token/route.ts). When Gemini sends a `toolCall` frame for
 * a mutating tool, the browser POSTs here instead of touching the
 * database itself, then relays this route's result back into the Gemini
 * session as the toolResponse.
 *
 * [FIXED: this closes the ambiguity in the original Live API doc, which
 * left it unclear whether "the proxy or client" executes tool calls —
 * for anything that mutates stock_quantity or reward_points, it is
 * always this server route, never the browser directly.]
 */

import { NextResponse } from "next/server";
import { createPreorderRequestSchema, type OrderStatus } from "@/types/schema";
import { getServiceRoleClient } from "@/lib/supabase-server";
import { isMutatingTool, type MutatingToolName } from "@/lib/live-tools";
import { isSameOriginRequest } from "@/lib/same-origin";
import { friendlyDbError } from "@/lib/db-errors";

interface ExecuteToolRequestBody {
  tool: string;
  args: unknown;
}

export async function POST(request: Request) {
  // Server Actions get Next's same-origin enforcement for free; a route
  // handler does not. Without this, an unauthenticated cross-origin POST
  // reached create_preorder through the service-role client and could
  // drain stock_quantity for any known cust_XXXXX (found by /qa on
  // 2026-08-29).
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Not allowed from this origin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | ExecuteToolRequestBody
    | null;

  if (!body || typeof body.tool !== "string") {
    return NextResponse.json(
      { error: "Request body must include { tool, args }." },
      { status: 400 }
    );
  }

  if (!isMutatingTool(body.tool)) {
    // This route only ever handles mutating tools. Anything else
    // (accidentally routed here) is refused rather than silently run.
    return NextResponse.json(
      {
        error: `"${body.tool}" is not a mutating tool and must not be executed server-side via this route. Read-only tools resolve client-side.`,
      },
      { status: 400 }
    );
  }

  return executeMutatingTool(body.tool, body.args);
}

async function executeMutatingTool(tool: MutatingToolName, args: unknown) {
  switch (tool) {
    case "create_preorder":
      return createPreorder(args);
    default: {
      // Exhaustiveness check: if MUTATING_TOOLS ever grows, TypeScript
      // will fail the build here until this switch is updated too.
      const _exhaustive: never = tool;
      return NextResponse.json({ error: "Unhandled mutating tool." }, { status: 500 });
    }
  }
}

async function createPreorder(rawArgs: unknown) {
  const parsed = createPreorderRequestSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid create_preorder arguments.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { customer_id, isbn, quantity } = parsed.data;

  // Caller identity is the documented pre-auth kiosk model: knowing the
  // cust_XXXXX is the credential. The same-origin check on POST above is
  // what keeps that from being an open endpoint. Product A's own
  // (session-first) resolution lives in lib/customer-session.ts and
  // deliberately doesn't apply here — a kiosk has no browser session.

  const supabase = getServiceRoleClient();

  // Calls the atomic SECURITY DEFINER function defined in
  // supabase/migrations/0002_rls_and_functions.sql, which does the
  // SELECT FOR UPDATE stock check + decrement + order insert as one
  // transaction so concurrent kiosk/web orders can't oversell.
  const { data, error } = await supabase.rpc("create_preorder", {
    p_customer_id: customer_id,
    p_isbn: isbn,
    p_quantity: quantity,
  });

  if (error) {
    // The RPC raises a Postgres exception with a recognizable message
    // when stock is insufficient — surface that distinctly so the voice
    // UI can say "that title just sold out" instead of a generic error.
    const outOfStock = error.message?.includes("INSUFFICIENT_STOCK");
    if (outOfStock) {
      return NextResponse.json(
        { error: "insufficient_stock", message: "That title doesn't have enough copies left." },
        { status: 409 }
      );
    }

    // Anything else is mapped, not echoed. This used to return
    // error.message verbatim, which handed the caller the raw Postgres
    // text — table and constraint names included (found by /qa on
    // 2026-08-29). Every other surface in the app already routes DB
    // failures through friendlyDbError; the raw text stays in the
    // server log where it's useful.
    console.error(
      `create_preorder failed via execute-tool [${error.code ?? "?"}]: ${error.message}`
    );
    return NextResponse.json(
      {
        error: "create_preorder_failed",
        message: friendlyDbError(error, {
          "23503": "We couldn't find that customer ID.",
        }),
      },
      { status: 500 }
    );
  }

  const orderStatus: OrderStatus = "preorder";
  return NextResponse.json({
    order_id: data,
    order_status: orderStatus,
  });
}
