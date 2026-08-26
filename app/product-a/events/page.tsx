import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
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
        <ul className="mt-8 space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/product-a/events/${e.id}`}
                className="flex gap-4 rounded-lg border border-ink/10 bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {e.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt=""
                    loading="lazy"
                    className="hidden h-24 w-32 flex-none rounded object-cover sm:block"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="font-serif text-xl text-ink">{e.event_title}</h2>
                  {e.author_name && <p className="mt-1 text-ink/70">{e.author_name}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-ink/60">
                    <span>{formatEventDate(e.author_event_at)}</span>
                    <span>{formatEventTime(e.author_event_at)}</span>
                    <span>{e.location}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-lg border border-ink/10 bg-surface p-4 text-ink/70">
          No upcoming events on the calendar right now — check back soon.
        </p>
      )}
    </main>
  );
}
