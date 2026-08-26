import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { Dashboard } from "./dashboard";

// Auth-gated and always reads live orders/stock — must never be
// statically prerendered/cached. See app/product-a/page.tsx's comment on
// why this needs to be explicit rather than auto-detected.
export const dynamic = "force-dynamic";

export default async function ProductBPage({
  searchParams,
}: {
  searchParams: {
    addBookError?: string;
    bookAdded?: string;
    addMerchError?: string;
    merchAdded?: string;
  };
}) {
  const supabase = getServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // orders has no anon SELECT policy (0003_orders_staff_select.sql) — an
  // unauthenticated visitor must never reach the pending-preorder queue.
  if (!session) {
    redirect("/product-b/sign-in");
  }

  // Session alone isn't staff (0018_staff_rbac.sql) — signInAction already
  // rejects a non-staff sign-in, but a session can also arrive here from
  // an existing cookie (e.g. after a roster change revokes access), so
  // this page re-checks rather than trusting sign-in time alone.
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    redirect("/product-b/sign-in?error=" + encodeURIComponent("This account isn't a staff account."));
  }

  const [ordersRes, booksRes, merchandiseRes] = await Promise.all([
    supabase
      .from("orders")
      .select("order_id, customer_id, isbn, quantity, order_status, created_at")
      .eq("order_status", "preorder")
      .order("created_at", { ascending: false }),
    supabase
      .from("books")
      .select("isbn, book_title, author_name, stock_quantity, cover_url, price"),
    supabase.from("merchandise").select("id, item_name, category, price, stock_quantity"),
  ]);

  // A failed query here must not silently render as "nothing pending" /
  // "no titles" — that's the exact "nobody notices" failure mode this
  // dashboard exists to prevent, just moved up a layer (see
  // 0006_authenticated_books_select.sql's own comment on this happening
  // once already). Log server-side and tell staff something's wrong
  // rather than showing empty lists as if the catalog really were empty.
  const queryErrors = [ordersRes.error, booksRes.error, merchandiseRes.error].filter(Boolean);
  if (queryErrors.length > 0) {
    console.error(
      `Product B dashboard query failure: ${queryErrors.map((e) => e?.message).join("; ")}`
    );
  }
  const loadError =
    queryErrors.length > 0
      ? "Some dashboard data failed to load — the lists below may be incomplete. Refresh, or contact a developer if this persists."
      : undefined;

  return (
    <Dashboard
      initialOrders={ordersRes.data ?? []}
      initialBooksByIsbn={Object.fromEntries((booksRes.data ?? []).map((b) => [b.isbn, b]))}
      initialMerchandiseById={Object.fromEntries((merchandiseRes.data ?? []).map((m) => [m.id, m]))}
      addBookError={searchParams.addBookError}
      bookAdded={searchParams.bookAdded}
      addMerchError={searchParams.addMerchError}
      merchAdded={searchParams.merchAdded}
      loadError={loadError}
    />
  );
}
