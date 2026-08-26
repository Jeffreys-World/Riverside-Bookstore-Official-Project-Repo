import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { SupportTabs } from "./support-tabs";

// Reads live author_events for the "Upcoming events" tab — must never
// be statically prerendered/cached, same reasoning as every other
// live-data page (see app/product-a/page.tsx's comment).
export const dynamic = "force-dynamic";

export default async function ProductCPage() {
  const supabase = getServerClient();
  const { data: events, error: eventsError } = await supabase
    .from("author_events")
    .select("event_title, event_description, author_event_at")
    .gte("author_event_at", new Date().toISOString())
    .order("author_event_at", { ascending: true })
    .limit(5);

  if (eventsError) {
    console.error(`Product C events panel query failed: ${eventsError.message}`);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Support Center</h1>
      <p className="mt-2 text-ink/70">
        The most common questions are answered right here — ask the chatbot for anything else, like
        checking a specific title or an order. For anything else,{" "}
        <Link href="/product-c/contact" className="text-accent underline-offset-2 hover:underline">
          contact us
        </Link>
        .
      </p>

      <SupportTabs events={events ?? []} eventsError={eventsError ? eventsError.message : undefined} />
    </main>
  );
}
