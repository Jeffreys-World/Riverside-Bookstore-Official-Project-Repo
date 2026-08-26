import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { CardImage } from "@/components/card-image";
import { formatEventDate, formatEventTime } from "@/types/schema";

// Live event data (and each event's own pickup-style scheduling) —
// same "must never be statically prerendered" reasoning as every other
// live-data page (see app/product-a/page.tsx's comment).
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = getServerClient();
  const { data: events, error } = await supabase
    .from("author_events")
    .select("id, event_title, author_name, event_description, author_event_at, location, image_url")
    .gte("author_event_at", new Date().toISOString())
    .order("author_event_at", { ascending: true });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink sm:text-4xl">Events</h1>
      <p className="mt-2 text-ink/70">Author readings and signings hosted in-store.</p>

      {error ? (
        <p role="alert" className="mt-8 rounded-lg border border-claret/30 bg-claret-soft p-4 text-claret">
          Couldn&apos;t load events right now. Please try again shortly.
        </p>
      ) : events && events.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/product-a/events/${e.id}`}
              className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardImage src={e.image_url} alt="" aspect="video" emptyLabel="No banner available" />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="font-serif text-xl text-ink">{e.event_title}</h2>
                {e.author_name && <p className="text-ink/70">{e.author_name}</p>}
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 font-mono text-xs text-ink/60">
                  <span>{formatEventDate(e.author_event_at)}</span>
                  <span>{formatEventTime(e.author_event_at)}</span>
                  <span className="w-full truncate sm:w-auto">{e.location}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
          No upcoming events on the calendar right now — check back soon.
        </p>
      )}
    </main>
  );
}
