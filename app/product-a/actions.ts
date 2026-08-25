"use server";

/**
 * Server Action wrapping create_preorder(). Per lib/supabase.ts's rule,
 * this is the only place Product A's mutation touches getServiceRoleClient
 * — the browser never calls Supabase directly for this, matching
 * app/api/live/execute-tool/route.ts's existing pattern for the same RPC.
 */

import { getServiceRoleClient } from "@/lib/supabase-server";
import { createPreorderRequestSchema } from "@/types/schema";

export type CreatePreorderResult =
  | { ok: true; orderId: string }
  | { ok: false; message: string };

export async function createPreorderAction(
  input: unknown
): Promise<CreatePreorderResult> {
  const parsed = createPreorderRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the customer ID, title, and quantity, then try again.",
    };
  }
  const { customer_id, isbn, quantity } = parsed.data;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("create_preorder", {
    p_customer_id: customer_id,
    p_isbn: isbn,
    p_quantity: quantity,
  });

  if (error) {
    // create_preorder raises two distinct INSUFFICIENT_STOCK messages
    // (see supabase/migrations/0002_rls_and_functions.sql) — surface each
    // as its own copy rather than one generic "order failed" message.
    if (error.message.includes("has not been inventoried yet")) {
      return {
        ok: false,
        message:
          "This title hasn't been inventoried yet — a bookseller can check current stock in person.",
      };
    }
    const shortage = error.message.match(/only (\d+) of/);
    if (shortage) {
      return { ok: false, message: `Only ${shortage[1]} left in stock.` };
    }
    return {
      ok: false,
      message: "Something went wrong placing your pre-order. Please try again.",
    };
  }

  return { ok: true, orderId: data as string };
}
