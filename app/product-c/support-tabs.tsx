"use client";

import { useState } from "react";
import { STORE_HOURS, STORE_POLICIES, STORE_FAQS } from "@/lib/store-info";
import { formatEventTimestamp } from "@/types/schema";
import { ChatWidget } from "./chat-widget";

interface EventRow {
  event_title: string;
  event_description: string;
  author_event_at: string;
}

const TABS = [
  { key: "faq", label: "FAQ" },
  { key: "chat", label: "Chatbot" },
  { key: "events", label: "Upcoming Events" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function SupportTabs({ events, eventsError }: { events: EventRow[]; eventsError?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("faq");

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Support Center sections"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-[52px] flex-1 whitespace-nowrap border-b-2 px-4 py-4 text-base font-medium transition-transform duration-150 hover:scale-105 ${
              activeTab === tab.key
                ? "border-accent text-ink"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "faq" && (
        <section role="tabpanel" className="mt-8">
          {/* Pain point: "store hours, return policy, and the event schedule
              get asked repeatedly and pull staff away from the register."
              These are the actual repeat-question culprits, so they're
              always visible here — not hidden behind having to ask the
              chatbot. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Store hours</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink/70">{STORE_HOURS}</p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-4">
              <h2 className="font-serif text-lg text-ink">Policies</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink/70">{STORE_POLICIES}</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-serif text-lg text-ink">Common questions</h2>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {STORE_FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-lg border border-ink/10 bg-surface p-4"
                >
                  <summary className="-m-4 cursor-pointer list-none rounded-lg p-4 font-medium text-ink transition-colors duration-150 marker:content-none hover:bg-ink/5">
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
          </div>
        </section>
      )}

      {activeTab === "chat" && (
        <section role="tabpanel" className="mt-4">
          <ChatWidget />
        </section>
      )}

      {activeTab === "events" && (
        <section role="tabpanel" className="mt-4 rounded-lg border border-ink/10 bg-surface p-4">
          {eventsError ? (
            <p role="alert" className="text-sm text-claret">
              Couldn&apos;t load events right now. Please try again shortly.
            </p>
          ) : events.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {events.map((e, i) => (
                <li key={i} className="rounded-md border border-ink/10 bg-field p-3">
                  <p className="font-medium text-ink">{e.event_title}</p>
                  <p className="text-sm text-ink/60">{formatEventTimestamp(e.author_event_at)}</p>
                  {e.event_description && (
                    <p className="mt-1 text-sm text-ink/60">{e.event_description}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/60">No upcoming events on the calendar right now.</p>
          )}
        </section>
      )}
    </div>
  );
}
