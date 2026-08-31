"use client";

import { useRef, useState, type KeyboardEvent } from "react";
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

const tabId = (key: TabKey) => `support-tab-${key}`;
const panelId = (key: TabKey) => `support-panel-${key}`;

export function SupportTabs({ events, eventsError }: { events: EventRow[]; eventsError?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("faq");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Arrow-key navigation is the expected interaction for role="tablist".
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((t) => t.key === activeTab);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const nextTab = TABS[next];
    if (!nextTab) return;
    setActiveTab(nextTab.key);
    tabRefs.current[nextTab.key]?.focus();
  }

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Support Center sections"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.key)}
              aria-selected={selected}
              aria-controls={panelId(tab.key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={onTabKeyDown}
              className={`min-h-[52px] flex-1 whitespace-nowrap border-b-2 px-4 py-4 text-base font-medium transition-transform duration-150 hover:scale-105 ${
                selected
                  ? "border-accent text-ink"
                  : "border-transparent text-ink/60 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* All three panels stay mounted and toggle with `hidden` — the
          Chatbot panel holds conversation state and an in-flight answer
          that a 20-30s wait makes easy to lose, so unmounting it on a tab
          switch would silently discard both. */}
      <section
        role="tabpanel"
        id={panelId("faq")}
        aria-labelledby={tabId("faq")}
        tabIndex={0}
        hidden={activeTab !== "faq"}
        className="mt-8"
      >
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
            {/* A real <ul>. This was one <p> with whitespace-pre-line, so
                three policies rendered as a paragraph with literal "- "
                hyphens standing in for bullets and no list semantics. The
                STORE_POLICIES constant keeps its "- " prefixes because
                app/product-c/actions.ts:50 feeds it to the model verbatim as
                grounding — the markers are stripped here at the render site
                instead. */}
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/70 marker:text-accent">
              {STORE_POLICIES.split("\n")
                .map((line) => line.replace(/^-\s*/, "").trim())
                .filter(Boolean)
                .map((policy) => (
                  <li key={policy}>{policy}</li>
                ))}
            </ul>
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

      <section
        role="tabpanel"
        id={panelId("chat")}
        aria-labelledby={tabId("chat")}
        tabIndex={0}
        hidden={activeTab !== "chat"}
        className="mt-4"
      >
        <ChatWidget />
      </section>

      <section
        role="tabpanel"
        id={panelId("events")}
        aria-labelledby={tabId("events")}
        tabIndex={0}
        hidden={activeTab !== "events"}
        className="mt-4 rounded-lg border border-ink/10 bg-surface p-4"
      >
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
    </div>
  );
}
