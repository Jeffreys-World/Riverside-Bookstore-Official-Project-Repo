import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { formatEventDate, formatEventTime } from "@/types/schema";
import { CardImage } from "@/components/card-image";
import { EventRsvp } from "./event-rsvp";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = getServerClient();
  const { data: event } = await supabase
    .from("author_events")
    .select("id, event_title, author_name, event_description, author_event_at, location, image_url")
    .eq("id", params.id)
    .maybeSingle();

  if (!event) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/product-a/events" className="text-sm text-accent underline-offset-2 hover:underline">
        ← All events
      </Link>

      <div className="mt-6 overflow-hidden rounded-lg shadow-md">
        <CardImage src={event.image_url} alt="" aspect="video" emptyLabel="Riverside Books event" />
      </div>

      <h1 className="mt-6 font-serif text-3xl text-ink sm:text-4xl">{event.event_title}</h1>
      {event.author_name && <p className="mt-2 text-lg text-ink/70">{event.author_name}</p>}

      <dl className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-ink/10 bg-surface p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">Date</dt>
          <dd className="mt-1 font-mono text-sm text-ink">{formatEventDate(event.author_event_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">Time</dt>
          <dd className="mt-1 font-mono text-sm text-ink">{formatEventTime(event.author_event_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">Location</dt>
          <dd className="mt-1 text-sm text-ink">{event.location}</dd>
        </div>
      </dl>

      <p className="mt-6 whitespace-pre-line leading-relaxed text-ink/80">{event.event_description}</p>

      <EventRsvp eventId={event.id} />
    </main>
  );
}
