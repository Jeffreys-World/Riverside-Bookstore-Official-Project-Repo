import { getServerClient } from "@/lib/supabase-server";
import { requireStaffPage } from "@/lib/staff-auth";
import { StaffGateNotice } from "@/components/staff-gate-notice";
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
  // Redirects an unauthenticated visitor to sign-in and a signed-in
  // non-staff visitor (e.g. a Product A customer on the one shared auth
  // cookie) to the customer app. is_staff() (0018) is re-checked here on
  // every load, so a roster change takes effect without a forced
  // sign-out. Shared with Product D — see lib/staff-auth.ts.
  const gate = await requireStaffPage();
  if (!gate.ok) return <StaffGateNotice />;

  const supabase = getServerClient();

  const [ordersRes, booksRes, merchandiseRes] = await Promise.all([
    supabase
      .from("orders")
      .select("order_id, customer_id, isbn, quantity, order_status, created_at")
      .eq("order_status", "preorder")
      .order("created_at", { ascending: false }),
    supabase
      .from("books")
      .select("isbn, book_title, author_name, stock_quantity, cover_url, price"),
    supabase.from("merchandise").select("id, item_name, category, price, stock_quantity, image_url"),
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
