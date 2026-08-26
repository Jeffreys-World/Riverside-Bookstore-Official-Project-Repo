import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import { STORE_HOURS, STORE_POLICIES, STORE_FAQS } from "@/lib/store-info";
import { formatEventTimestamp } from "@/types/schema";
import { ChatWidget } from "./chat-widget";

// Reads live author_events for the "Upcoming events" panel — must never
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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Frequently Asked Questions</h1>
      <p className="mt-2 text-ink/70">
        The most common questions are answered right here — ask below for anything else, like
        checking a specific title or an order. For anything else,{" "}
        <Link href="/product-c/contact" className="text-accent underline-offset-2 hover:underline">
          contact us
        </Link>
        .
      </p>

      {/* Pain point: "store hours, return policy, and the event schedule get
          asked repeatedly and pull staff away from the register." These
          three are the actual repeat-question culprits, so they're always
          visible here — not hidden behind having to ask the chatbot. */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-surface p-4">
          <h2 className="font-serif text-lg text-ink">Store hours</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-ink/70">{STORE_HOURS}</p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-surface p-4">
          <h2 className="font-serif text-lg text-ink">Policies</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-ink/70">{STORE_POLICIES}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-ink">Common questions</h2>
        <div className="mt-2 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-surface">
          {STORE_FAQS.map((faq) => (
            <details key={faq.question} className="group p-4 open:pb-4">
              <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {faq.question}
                  <span aria-hidden className="text-ink/40 transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm text-ink/70">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-ink/10 bg-surface p-4">
        <h2 className="font-serif text-lg text-ink">Upcoming events</h2>
        {events && events.length > 0 ? (
          <ul className="mt-2 space-y-3">
            {events.map((e, i) => (
              <li key={i}>
                <p className="font-medium text-ink">{e.event_title}</p>
                <p className="text-sm text-ink/60">{formatEventTimestamp(e.author_event_at)}</p>
                {e.event_description && (
                  <p className="mt-1 text-sm text-ink/60">{e.event_description}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink/60">No upcoming events on the calendar right now.</p>
        )}
      </section>

      <ChatWidget />
    </main>
  );
}
