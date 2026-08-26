"use server";

/**
 * Product A's Server Actions. Mutations (createPreorderAction,
 * signUpCustomerAction) go through getServiceRoleClient() per
 * lib/supabase.ts's rule, since neither create_preorder nor
 * create_customer is anon-grantable — the browser never calls Supabase
 * directly for those, matching app/api/live/execute-tool/route.ts's
 * pattern for the same create_preorder RPC. Reads (getAccountAction) use
 * the regular server client instead, since the RPCs they call are already
 * anon-safe.
 */

import { getServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import { CUSTOMER_ID_REGEX, createPreorderRequestSchema } from "@/types/schema";

export type CreatePreorderResult =
  | { ok: true; orderId: string; rewardPoints: number | null }
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

  // Best-effort: surface the fresh stamp count alongside the confirmation.
  // create_preorder() (0011_loyalty_stamps.sql) already incremented it —
  // this is just a read, so a failure here must not undo or hide the
  // successful order.
  const { data: balance } = await supabase.rpc("get_loyalty_balance", {
    p_customer_id: customer_id,
  });

  return {
    ok: true,
    orderId: data as string,
    rewardPoints: typeof balance === "number" ? balance : null,
  };
}

export type SignUpCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; message: string };

/**
 * Mints a fresh cust_XXXXX id via create_customer() (0010_customer_signup.sql)
 * so a real visitor — not just the seeded cust_demo01 — can place a
 * pre-order and start earning stamps. Same server-only mutation pattern as
 * createPreorderAction: the RPC is not granted to anon, so this must run
 * through the service-role client, never called directly from the browser.
 */
export async function signUpCustomerAction(): Promise<SignUpCustomerResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("create_customer");

  if (error || !data) {
    return {
      ok: false,
      message: "Something went wrong creating your account. Please try again.",
    };
  }

  return { ok: true, customerId: data as string };
}

export interface AccountOrder {
  order_id: string;
  isbn: string;
  book_title: string;
  quantity: number;
  order_status: string;
  created_at: string;
}

export type GetAccountResult =
  | { ok: true; rewardPoints: number; orders: AccountOrder[] }
  | { ok: false; message: string };

/**
 * Product A's "My Account" page. Both RPCs (get_loyalty_balance,
 * get_customer_orders — 0013_customer_order_history.sql) are anon-grantable
 * reads gated on already knowing the exact customer_id, so this reads
 * through the regular server client, not the service-role one — same
 * access level a direct browser call would have, just kept server-side
 * for consistency with the rest of this file.
 */
export async function getAccountAction(customerId: string): Promise<GetAccountResult> {
  if (!CUSTOMER_ID_REGEX.test(customerId)) {
    return { ok: false, message: "Enter a valid customer ID (cust_XXXXX)." };
  }

  const supabase = getServerClient();
  const [{ data: balance, error: balanceError }, { data: rawOrders, error: ordersError }] =
    await Promise.all([
      supabase.rpc("get_loyalty_balance", { p_customer_id: customerId }),
      supabase.rpc("get_customer_orders", { p_customer_id: customerId }),
    ]);

  if (balanceError || ordersError) {
    console.error(
      `getAccountAction query failed: balance=${balanceError?.message ?? "ok"} orders=${ordersError?.message ?? "ok"}`
    );
    return { ok: false, message: "Something went wrong loading your account. Please try again." };
  }
  if (balance === null) {
    return { ok: false, message: "We couldn't find that customer ID." };
  }

  const orders =
    (rawOrders as Array<{
      order_id: string;
      isbn: string;
      quantity: number;
      order_status: string;
      created_at: string;
    }>) ?? [];

  const isbns = [...new Set(orders.map((o) => o.isbn))];
  let titleByIsbn: Record<string, string> = {};
  if (isbns.length > 0) {
    const { data: books } = await supabase.from("books").select("isbn, book_title").in("isbn", isbns);
    titleByIsbn = Object.fromEntries((books ?? []).map((b) => [b.isbn, b.book_title]));
  }

  return {
    ok: true,
    rewardPoints: balance as number,
    orders: orders.map((o) => ({ ...o, book_title: titleByIsbn[o.isbn] ?? o.isbn })),
  };
}
