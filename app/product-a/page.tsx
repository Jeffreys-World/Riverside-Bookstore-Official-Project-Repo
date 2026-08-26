import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { evaluateStockStatus } from "@/lib/inventory";
import { BookCard } from "./book-card";
import { GiftCard } from "./gift-card";

// Always reads live catalog data (stock_quantity changes constantly) —
// must never be statically prerendered/cached. Explicit rather than
// relying on Next's automatic dynamic-API detection: getServerClient()
// throws before it reaches its cookies() call if env vars are missing,
// which stops Next from ever observing that call during prerender and
// makes it attempt (and fail) static generation instead of deferring to
// request time.
export const dynamic = "force-dynamic";

export default async function ProductAPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  // The header's Books/Gifts preview menus link here with ?category= —
  // no param (e.g. clicking the logo) shows everything, same as before.
  const category = searchParams.category;
  const showBooks = category !== "gifts";
  const showGifts = category !== "books";

  const supabase = getServerClient();
  const [{ data: books, error }, { data: merchandise }] = await Promise.all([
    supabase
      .from("books")
      .select(
        "isbn, book_title, author_name, stock_quantity, cover_url, description, author_bio, price"
      )
      .order("book_title"),
    supabase
      .from("merchandise")
      .select("id, item_name, category, price, stock_quantity, image_url")
      .order("item_name"),
  ]);

  const flaggedBooks = evaluateStockStatus(
    (books ?? []).map((b) => ({ id: b.isbn, stockQuantity: b.stock_quantity }))
  );
  const flaggedMerchandise = evaluateStockStatus(
    (merchandise ?? []).map((m) => ({ id: m.id, stockQuantity: m.stock_quantity }))
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">
            {category === "gifts" ? "Gifts" : category === "books" ? "Books" : "Shop the Catalog"}
          </h1>
          <p className="mt-2 text-ink/70">
            Add a title to your cart to reserve it for in-store pickup. Order history and loyalty
            points live under{" "}
            <Link href="/product-a/account" className="text-accent underline-offset-2 hover:underline">
              My Account
            </Link>
            .
          </p>
        </div>
        <Link
          href="/product-a/signup"
          className="min-h-[44px] rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink hover:border-ink/40"
        >
          New customer? Create an account
        </Link>
      </div>

      {showBooks &&
        (error ? (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-claret/30 bg-claret-soft p-4 text-claret"
          >
            Couldn&apos;t load the catalog right now. Please try again shortly.
          </p>
        ) : books && books.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((b) => (
              <BookCard
                key={b.isbn}
                isbn={b.isbn}
                book_title={b.book_title}
                author_name={b.author_name}
                cover_url={b.cover_url}
                description={b.description}
                author_bio={b.author_bio}
                price={b.price}
                stockQuantity={b.stock_quantity}
                status={flaggedBooks.find((f) => f.id === b.isbn)?.status ?? "needs_attention"}
              />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
            No titles are in the catalog yet — check back soon.
          </p>
        ))}

      {showGifts && merchandise && merchandise.length > 0 && (
        <section className={showBooks ? "mt-16" : "mt-8"}>
          <h2 className="font-serif text-xl text-ink">Cards &amp; Gifts</h2>
          <p className="mt-1 text-sm text-ink/60">
            In-store only — browse what&apos;s currently on the shelf.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {merchandise.map((m) => (
              <GiftCard
                key={m.id}
                id={m.id}
                item_name={m.item_name}
                category={m.category}
                price={m.price}
                stockQuantity={m.stock_quantity}
                image_url={m.image_url}
                status={flaggedMerchandise.find((f) => f.id === m.id)?.status ?? "needs_attention"}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
