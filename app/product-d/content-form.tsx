"use client";

import { useState, type FormEvent } from "react";
import { generateMarketingContentAction, type MarketingContentResult } from "./actions";

interface BookRow {
  isbn: string;
  book_title: string;
  author_name: string;
  cover_url: string | null;
}

export function ContentForm({ books }: { books: BookRow[] }) {
  const [isbn, setIsbn] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; content: MarketingContentResult }
    | { kind: "error"; message: string }
    | null
  >(null);

  const selectedBook = books.find((b) => b.isbn === isbn);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return; // guards against double-submit

    setPending(true);
    setResult(null);
    try {
      const transcript = selectedBook
        ? `${note.trim()} (about "${selectedBook.book_title}" by ${selectedBook.author_name})`
        : note.trim();
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
          className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
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
        <label htmlFor="note" className="block text-sm font-medium text-ink">
          What should we say about it?
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="e.g. staff pick this week, perfect cozy autumn read, event Thursday at 7pm"
          className="mt-1 block w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={pending || !note.trim()}
        className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate content"}
      </button>

      <div role="status" aria-live="polite" className="space-y-4">
        {result?.kind === "error" && (
          <p className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
            {result.message}
          </p>
        )}
        {result?.kind === "success" && (
          <>
            <div className="rounded-lg border border-ink/10 bg-white p-4">
              <h3 className="font-serif text-lg text-ink">Instagram</h3>
              <p className="mt-1 whitespace-pre-wrap text-ink/80">{result.content.instagram}</p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-4">
              <h3 className="font-serif text-lg text-ink">Newsletter</h3>
              <p className="mt-1 whitespace-pre-wrap text-ink/80">{result.content.newsletter}</p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-4">
              <h3 className="font-serif text-lg text-ink">Staff pick card</h3>
              <p className="mt-1 font-mono text-ink/80">{result.content.staffPickCard}</p>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
