"use client";

import { useState, type FormEvent } from "react";
import { formatEventTimestamp } from "@/types/schema";
import { generateMarketingContentAction, type MarketingContentResult } from "./actions";
import { GeneratedImage } from "./generated-image";
import { CopyButton } from "@/components/copy-button";
import { useRotatingMessage } from "@/lib/use-rotating-message";

const GENERATING_MESSAGES = ["Generating…", "Drafting your caption…", "Almost ready…"] as const;

// Instagram truncates a caption past 2,200 characters. Shown as a count
// rather than enforced: the model's captions land far under it, and silently
// clipping staff's text would be worse than letting them see the number.
const INSTAGRAM_CAPTION_LIMIT = 2200;

interface BookRow {
  isbn: string;
  book_title: string;
  author_name: string;
  cover_url: string | null;
}

interface EventRow {
  id: string;
  event_title: string;
  event_description: string;
  author_event_at: string; // ISO 8601
}

export function ContentForm({
  books,
  events,
  loadError,
}: {
  books: BookRow[];
  events: EventRow[];
  loadError?: string;
}) {
  const [isbn, setIsbn] = useState("");
  const [eventId, setEventId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    | {
        kind: "success";
        content: MarketingContentResult;
        imageHeadlineFallback: string;
        imageSubtitle: string;
      }
    | { kind: "error"; message: string }
    | null
  >(null);
  const progressMessage = useRotatingMessage(GENERATING_MESSAGES, pending);

  const selectedBook = books.find((b) => b.isbn === isbn);
  const selectedEvent = events.find((e) => e.id === eventId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return; // guards against double-submit

    setPending(true);
    setResult(null);
    // Snapshot the book/event identity used for THIS generation. The
    // dropdowns stay enabled while results are shown, so reading
    // selectedBook/selectedEvent live in the render would let the social
    // image drift to a different title while the captions still describe
    // the original.
    const imageHeadlineFallback =
      selectedBook?.book_title || selectedEvent?.event_title || "Riverside Books";
    const imageSubtitle = selectedBook
      ? `${selectedBook.book_title} — ${selectedBook.author_name}`
      : selectedEvent
        ? `${selectedEvent.event_title} — ${formatEventTimestamp(selectedEvent.author_event_at)}`
        : "";
    try {
      const facts: string[] = [];
      if (selectedBook) facts.push(`about the book "${selectedBook.book_title}" by ${selectedBook.author_name}`);
      if (selectedEvent) {
        facts.push(
          `about the upcoming event "${selectedEvent.event_title}" on ${formatEventTimestamp(selectedEvent.author_event_at)}: ${selectedEvent.event_description}`
        );
      }
      const transcript = [note.trim(), ...facts].filter(Boolean).join(" — ");
      const res = await generateMarketingContentAction(transcript);
      setResult(
        res.ok
          ? { kind: "success", content: res.content, imageHeadlineFallback, imageSubtitle }
          : { kind: "error", message: res.message }
      );
    } catch (err) {
      // generateMarketingContentAction handles model failures internally
      // and returns { ok: false }. This catch is for a transport-level
      // failure of the action itself (network drop, a serverless
      // function timeout mid-fallback-chain) — without it the button
      // just silently reverts with no output and no error.
      console.error(`Marketing action transport failure: ${err}`);
      setResult({
        kind: "error",
        message: "Something went wrong reaching the server — please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {loadError && (
        <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-ink/80">
          {loadError}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <label htmlFor="isbn" className="block text-sm font-medium text-ink">
            Title (optional)
          </label>
          <select
            id="isbn"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          >
            <option value="">— None, just use my note —</option>
            {books.map((b) => (
              <option key={b.isbn} value={b.isbn}>
                {b.book_title} — {b.author_name}
              </option>
            ))}
          </select>

          {selectedBook && (
            <div className="mt-3 flex items-center gap-3">
              {selectedBook.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedBook.cover_url}
                  alt=""
                  loading="lazy"
                  className="h-20 w-14 flex-none rounded object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-20 w-14 flex-none items-center justify-center rounded bg-ink/5 text-[10px] text-ink/40"
                >
                  No cover
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{selectedBook.book_title}</p>
                <p className="truncate text-sm text-ink/60">{selectedBook.author_name}</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="event_id" className="block text-sm font-medium text-ink">
            Upcoming event (optional)
          </label>
          <select
            id="event_id"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          >
            <option value="">— None —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.event_title} — {formatEventTimestamp(ev.author_event_at)}
              </option>
            ))}
          </select>
          {events.length === 0 && (
            <p className="mt-1 text-xs text-ink/50">No upcoming events on the calendar right now.</p>
          )}
          {selectedEvent && (
            <p className="mt-2 text-sm text-ink/60">{selectedEvent.event_description}</p>
          )}
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-ink">
            Anything else to add? {selectedBook || selectedEvent ? "(optional)" : ""}
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. staff pick this week, perfect cozy autumn read"
            className="mt-1 block w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || (!note.trim() && !selectedBook && !selectedEvent)}
        className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {pending ? progressMessage : "Generate content"}
      </button>

      <div role="status" aria-live="polite">
        {result?.kind === "error" && (
          <p className="rounded-md border border-claret/30 bg-claret-soft p-3 text-claret">
            {result.message}
          </p>
        )}
        {result?.kind === "success" && (
          // DESIGN.md "Product D / D2". These four were one 4-up grid of
          // identical bg-surface cards, which is why the newsletter blurb
          // read as cramped — long-form prose in a quarter-width column.
          // Each is now shaped like where it is going.
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex flex-col rounded-lg border border-ink/10 bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg text-ink">Instagram</h3>
                  <CopyButton text={result.content.instagram} label="Instagram caption" />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">
                  {result.content.instagram}
                </p>
                <p className="mt-auto pt-3 font-mono text-xs text-ink/50">
                  {result.content.instagram.length.toLocaleString()} /{" "}
                  {INSTAGRAM_CAPTION_LIMIT.toLocaleString()}
                </p>
              </div>

              {/* D's signature moment: the thing it is actually writing.
                  bg-paper rather than bg-surface and dashed gold rules so it
                  reads as a card you would slot under a book on the shelf,
                  not another panel in a dashboard. This is the one place in
                  a dense staff tool where breaking the grid is earned, and
                  the one screen where gold is spent. */}
              <div className="flex flex-col rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg text-ink">Staff pick card</h3>
                  <CopyButton text={result.content.staffPickCard} label="staff pick card" />
                </div>
                <div className="mt-3 flex flex-1 flex-col justify-center border-y-2 border-dashed border-gold py-5 text-center">
                  <p className="font-serif text-lg leading-snug text-ink">
                    {result.content.staffPickCard}
                  </p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                    Riverside Books
                  </p>
                </div>
              </div>

              <GeneratedImage
                headline={result.content.staffPickCard || result.imageHeadlineFallback}
                subtitle={result.imageSubtitle}
              />
            </div>

            {/* Full width: it is the only long-form prose of the four, and a
                quarter-width column was the reason it read as cramped. */}
            <div className="rounded-lg border border-ink/10 bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-lg text-ink">Newsletter</h3>
                <CopyButton text={result.content.newsletter} label="newsletter blurb" />
              </div>
              <p className="mt-2 max-w-prose whitespace-pre-wrap text-ink/80">
                {result.content.newsletter}
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
