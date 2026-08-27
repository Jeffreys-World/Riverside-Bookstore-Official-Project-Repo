"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { askSupportChatbotAction, type SupportChatBook } from "./actions";
import { useRotatingMessage } from "@/lib/use-rotating-message";

interface Exchange {
  question: string;
  answer: string;
  books: SupportChatBook[];
}

const CHECKING_MESSAGES = ["Checking…", "Looking that up…", "Almost there…"] as const;

// Long enough for any real question ("do you have <title> by <author> in
// stock, and is it good for a 10-year-old?") but short enough that a
// stray multi-KB paste is rejected here instead of failing opaquely
// against Gemini's token limit with the field already cleared.
const MAX_QUESTION_LENGTH = 500;

function CoverThumb({ book }: { book: SupportChatBook }) {
  const [errored, setErrored] = useState(false);
  const showImage = book.cover_url && !errored;
  return (
    <div className="w-14 flex-none">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover_url as string}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-20 w-14 rounded object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-20 w-14 items-center justify-center rounded bg-ink/5 text-[9px] text-ink/40"
        >
          No cover
        </div>
      )}
      <p className="mt-1 truncate text-[10px] text-ink/60">{book.book_title}</p>
    </div>
  );
}

export function ChatWidget() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const progressMessage = useRotatingMessage(CHECKING_MESSAGES, pending);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Bring the newest exchange (or the pending indicator) into view after
  // each change — the log is a fixed-height scroll area now, so without
  // this the latest answer can land below the fold.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [history, pending]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return; // guards against double-submit

    if (q.length > MAX_QUESTION_LENGTH) {
      setHistory((prev) => [
        ...prev,
        {
          question: q.slice(0, 80) + "…",
          answer: `That question is a bit long — keep it under ${MAX_QUESTION_LENGTH} characters and try again.`,
          books: [],
        },
      ]);
      return;
    }

    setPending(true);
    setQuestion("");
    try {
      const result = await askSupportChatbotAction(q);
      setHistory((prev) => [...prev, { question: q, answer: result.answer, books: result.books }]);
    } catch (err) {
      // The action handles model failures internally and returns a
      // friendly string — this catch is for a transport-level failure of
      // the Server Action itself (offline, a 500, a deploy/version skew).
      // Without it the typed question just vanished with no feedback.
      console.error(`Support chatbot transport failure: ${err}`);
      setHistory((prev) => [
        ...prev,
        {
          question: q,
          answer: "Something went wrong sending that — please check your connection and try again.",
          books: [],
        },
      ]);
      setQuestion(q);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      <div
        aria-live="polite"
        role="log"
        className="max-h-[60vh] space-y-4 overflow-y-auto"
      >
        {history.map((ex, i) => (
          <div key={i} className="space-y-1">
            <p className="font-medium text-ink">{ex.question}</p>
            <p className="rounded-lg border border-ink/10 bg-surface p-3 text-ink/80">
              {ex.answer}
            </p>
            {ex.books.length > 0 && (
              <div className="flex gap-3">
                {ex.books.map((b) => (
                  <CoverThumb key={b.isbn} book={b} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Its own polite region, outside role="log" — the message rotates
          every 4s during a 20-30s wait, and inside the log each rotation
          was re-announced to screen readers as new log content. */}
      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm text-ink/50">
        {pending ? progressMessage : ""}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <label htmlFor="question" className="sr-only">
          Ask a question
        </label>
        <input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="Is Atomic Habits in stock?"
          className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
