import { getServerClient } from "@/lib/supabase-server";
import { evaluateStockStatus, type FlaggedInventoryRecord } from "@/lib/inventory";
import { PreorderForm } from "./preorder-form";

// Always reads live catalog data (stock_quantity changes constantly) —
// must never be statically prerendered/cached. Explicit rather than
// relying on Next's automatic dynamic-API detection: getServerClient()
// throws before it reaches its cookies() call if env vars are missing,
// which stops Next from ever observing that call during prerender and
// makes it attempt (and fail) static generation instead of deferring to
// request time.
export const dynamic = "force-dynamic";

const STOCK_LABEL: Record<FlaggedInventoryRecord["status"], string> = {
  out_of_stock: "Out of stock",
  low_stock: "Low stock",
  needs_attention: "Not yet inventoried",
  in_stock: "In stock",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function ProductAPage() {
  const supabase = getServerClient();
  const [{ data: books, error }, { data: merchandise }] = await Promise.all([
    supabase
      .from("books")
      .select("isbn, book_title, author_name, stock_quantity, cover_url, description, price")
      .order("book_title"),
    supabase
      .from("merchandise")
      .select("id, item_name, category, price, stock_quantity")
      .order("item_name"),
  ]);

  const flaggedMerchandise = evaluateStockStatus(
    (merchandise ?? []).map((m) => ({ id: m.id, stockQuantity: m.stock_quantity }))
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Order &amp; Loyalty</h1>
      <p className="mt-2 text-ink/70">Pick a title to reserve for in-store pickup.</p>

      {error ? (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
        >
          Couldn&apos;t load the catalog right now. Please try again shortly.
        </p>
      ) : (
        <PreorderForm books={books ?? []} />
      )}

      {merchandise && merchandise.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-xl text-ink">Cards &amp; Gifts</h2>
          <p className="mt-1 text-sm text-ink/60">
            In-store only — browse what&apos;s currently on the shelf.
          </p>
          <ul className="mt-4 space-y-2">
            {merchandise.map((m) => {
              const status = flaggedMerchandise.find((f) => f.id === m.id)?.status;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-4"
                >
                  <span className="min-w-0">
                    <p className="truncate text-ink">{m.item_name}</p>
                    <p className="text-xs capitalize text-ink/50">{m.category}</p>
                  </span>
                  <span className="flex flex-none items-center gap-3">
                    <span className="font-mono text-sm text-ink/70">
                      {currencyFormatter.format(m.price)}
                    </span>
                    {status && <span className="text-sm text-ink/60">{STOCK_LABEL[status]}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
