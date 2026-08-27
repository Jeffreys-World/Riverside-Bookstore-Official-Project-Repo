import { getServerClient } from "@/lib/supabase-server";
import { requireStaffPage } from "@/lib/staff-auth";
import { ContentForm } from "./content-form";
import { StaffNav } from "../product-b/staff-nav";

// Auth-gated, same as Product B — the marketing generator is a staff
// tool, not a public one. Was reachable by anyone until the 2026-08-26
// pain-point review flagged it as the one staff surface with zero auth;
// this closes that gap. Also reads live catalog data for the optional
// title picker — see app/product-a/page.tsx's comment for why `dynamic`
// needs to be explicit.
export const dynamic = "force-dynamic";

export default async function ProductDPage() {
  // Was only `if (!session)` — a signed-in Product A customer (one shared
  // auth cookie) sailed straight through to the store's paid Gemini key.
  // requireStaffPage() runs the same is_staff() gate as Product B.
  await requireStaffPage();

  const supabase = getServerClient();

  const [booksRes, eventsRes] = await Promise.all([
    supabase.from("books").select("isbn, book_title, author_name, cover_url").order("book_title"),
    // Future events only — a marketing post about an event that already
    // happened isn't useful. Same "or upcoming event" grounding Product C
    // uses for get_upcoming_events (app/product-c/actions.ts).
    supabase
      .from("author_events")
      .select("id, event_title, event_description, author_event_at")
      .gte("author_event_at", new Date().toISOString())
      .order("author_event_at", { ascending: true }),
  ]);

  // Mirror product-b/page.tsx: a failed query must not render as an empty
  // picker that looks like "the catalog really is empty" — log it and
  // tell staff the picker is degraded (they can still submit a note).
  const pickerErrors = [booksRes.error, eventsRes.error].filter(Boolean);
  if (pickerErrors.length > 0) {
    console.error(
      `Product D picker query failure: ${pickerErrors.map((e) => e?.message).join("; ")}`
    );
  }
  const loadError =
    pickerErrors.length > 0
      ? "The title/event pickers failed to load — you can still generate from a typed note."
      : undefined;

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <StaffNav active="marketing" />
      <h1 className="font-serif text-3xl text-ink">Marketing Content Generator</h1>
      <p className="mt-2 text-ink/70">
        Dictate a quick note about a title or event — get an Instagram caption, newsletter
        blurb, and shelf-card line to review.
      </p>
      <ContentForm books={booksRes.data ?? []} events={eventsRes.data ?? []} loadError={loadError} />
    </main>
  );
}
