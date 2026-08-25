import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { Dashboard } from "./dashboard";

// Auth-gated and always reads live orders/stock — must never be
// statically prerendered/cached. See app/product-a/page.tsx's comment on
// why this needs to be explicit rather than auto-detected.
export const dynamic = "force-dynamic";

export default async function ProductBPage() {
  const supabase = getServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // orders has no anon SELECT policy (0003_orders_staff_select.sql) — an
  // unauthenticated visitor must never reach the pending-preorder queue.
  if (!session) {
    redirect("/product-b/sign-in");
  }

  const [{ data: orders }, { data: books }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_id, customer_id, isbn, quantity, order_status, created_at")
      .eq("order_status", "preorder")
      .order("created_at", { ascending: false }),
    supabase.from("books").select("isbn, book_title, author_name, stock_quantity"),
  ]);

  return (
    <Dashboard
      initialOrders={orders ?? []}
      initialBooksByIsbn={Object.fromEntries((books ?? []).map((b) => [b.isbn, b]))}
    />
  );
}
