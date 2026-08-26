import { getServerClient } from "@/lib/supabase-server";
import { ContentForm } from "./content-form";

// Reads live catalog data for the optional title picker — see
// app/product-a/page.tsx's comment for why this needs to be explicit.
export const dynamic = "force-dynamic";

export default async function ProductDPage() {
  const supabase = getServerClient();
  const { data: books } = await supabase
    .from("books")
    .select("isbn, book_title, author_name, cover_url")
    .order("book_title");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Marketing Content Generator</h1>
      <p className="mt-2 text-ink/70">
        Dictate a quick note about a title or event — get an Instagram caption, newsletter
        blurb, and shelf-card line to review.
      </p>
      <ContentForm books={books ?? []} />
    </main>
  );
}
