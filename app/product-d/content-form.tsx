"use client";

import { useState, type FormEvent } from "react";
import { formatEventTimestamp } from "@/types/schema";
import { generateMarketingContentAction, type MarketingContentResult } from "./actions";
import { GeneratedImage } from "./generated-image";

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

export function ContentForm({ books, events }: { books: BookRow[]; events: EventRow[] }) {
  const [isbn, setIsbn] = useState("");
  const [eventId, setEventId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; content: MarketingContentResult }
    | { kind: "error"; message: string }
    | null
  >(null);

  const selectedBook = books.find((b) => b.isbn === isbn);
  const selectedEvent = events.find((e) => e.id === eventId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return; // guards against double-submit

    setPending(true);
    setResult(null);
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
        res.ok ? { kind: "success", content: res.content } : { kind: "error", message: res.message }
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
          placeholder="e.g. staff pick this week, perfect cozy autumn read"
          className="mt-1 block w-full rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={pending || (!note.trim() && !selectedBook && !selectedEvent)}
        className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate content"}
      </button>

      <div role="status" aria-live="polite" className="space-y-4">
        {result?.kind === "error" && (
          <p className="rounded-md border border-claret/30 bg-claret-soft p-3 text-claret">
            {result.message}
          </p>
        )}
        {result?.kind === "success" && (
          <>
            <div className="rounded-lg border border-ink/10 bg-surface p-4">
              <h3 className="font-serif text-lg text-ink">Instagram</h3>
              <p className="mt-1 whitespace-pre-wrap text-ink/80">{result.content.instagram}</p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-4">
              <h3 className="font-serif text-lg text-ink">Newsletter</h3>
              <p className="mt-1 whitespace-pre-wrap text-ink/80">{result.content.newsletter}</p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-surface p-4">
              <h3 className="font-serif text-lg text-ink">Staff pick card</h3>
              <p className="mt-1 font-mono text-ink/80">{result.content.staffPickCard}</p>
            </div>
            <GeneratedImage
              headline={result.content.staffPickCard || selectedBook?.book_title || selectedEvent?.event_title || "Riverside Books"}
              subtitle={
                selectedBook
                  ? `${selectedBook.book_title} — ${selectedBook.author_name}`
                  : selectedEvent
                    ? `${selectedEvent.event_title} — ${formatEventTimestamp(selectedEvent.author_event_at)}`
                    : ""
              }
            />
          </>
        )}
      </div>
    </form>
  );
}
