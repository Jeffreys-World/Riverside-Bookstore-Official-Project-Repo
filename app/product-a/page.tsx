import { getServerClient } from "@/lib/supabase-server";
import { PreorderForm } from "./preorder-form";

// Always reads live catalog data (stock_quantity changes constantly) —
// must never be statically prerendered/cached. Explicit rather than
// relying on Next's automatic dynamic-API detection: getServerClient()
// throws before it reaches its cookies() call if env vars are missing,
// which stops Next from ever observing that call during prerender and
// makes it attempt (and fail) static generation instead of deferring to
// request time.
export const dynamic = "force-dynamic";

export default async function ProductAPage() {
  const supabase = getServerClient();
  const { data: books, error } = await supabase
    .from("books")
    .select("isbn, book_title, author_name, stock_quantity, cover_url, description")
    .order("book_title");

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
    </main>
  );
}
