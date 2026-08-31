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

// Shown only on the empty state. Each one is answerable from the grounding
// the action already has (catalogue, upcoming events, store info), so a
// first-time visitor's first question cannot miss.
const EXAMPLE_QUESTIONS = [
  "Is Atomic Habits in stock?",
  "What are your store hours?",
  "What author events are coming up?",
  "I liked Circe — what should I read next?",
] as const;

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
  // The question currently in flight. Held separately from `history` so it
  // can be echoed the instant it is submitted: an exchange only enters
  // `history` once the answer returns, so without this the typed question
  // vanished for the whole 20-30s lookup and the log sat empty.
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const progressMessage = useRotatingMessage(CHECKING_MESSAGES, pending);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setPendingQuestion(q);
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
      setPendingQuestion(null);
    }
  }

  function askExample(example: string) {
    setQuestion(example);
    inputRef.current?.focus();
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
            {/* whitespace-pre-line because the model answers list-shaped
                questions ("what are your hours?") with real newlines and
                `* ` bullets. stripMarkdownEmphasis deliberately leaves those
                bullets alone — Product D's captions need them verbatim — so
                collapsing the newlines here rendered a three-line list as
                one run-on sentence littered with asterisks. */}
            <p className="whitespace-pre-line rounded-lg border border-ink/10 bg-surface p-3 text-ink/80">
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

        {/* Echoed the moment the question is submitted, with a placeholder
            in the answer's own geometry so the stamp-shaped gap the answer
            will fill is already reserved — nothing shifts when it lands. */}
        {pendingQuestion !== null && (
          <div className="space-y-1">
            <p className="font-medium text-ink">{pendingQuestion}</p>
            <p
              aria-hidden="true"
              className="animate-pulse rounded-lg border border-dashed border-ink/25 bg-surface/50 p-3 text-ink/40"
            >
              {progressMessage}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Without this the tab opened onto an input and 500px of nothing —
          no indication of what the bookseller can actually be asked. */}
      {history.length === 0 && pendingQuestion === null && (
        <div className="rounded-lg border border-dashed border-ink/20 p-5">
          <p className="font-serif text-lg text-ink">Ask the bookseller</p>
          <p className="mt-1 text-sm text-ink/60">
            Stock, prices, store hours, upcoming events, or a recommendation — answers come
            straight from the catalogue. Looking something up takes a few seconds.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => askExample(example)}
                  className="min-h-[44px] rounded-md border border-ink/20 bg-surface px-3 py-2 text-left text-sm text-ink transition-transform duration-150 hover:scale-105 hover:border-accent"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The rotating copy is decorative — it changes every 4s purely so
          a 20-30s wait looks alive, and any live region it sat in
          (role="log" before, its own polite region after) re-announced
          every rotation. It now rides on the aria-hidden placeholder above,
          inside the answer's own shape, rather than as a loose line of grey
          text under the log. This sr-only region still says it once when the
          wait starts, and the answer arriving in role="log" announces the
          end. */}
      <p aria-live="polite" className="sr-only">
        {pending ? "Checking the catalogue — this can take a few seconds." : ""}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <label htmlFor="question" className="sr-only">
          Ask a question
        </label>
        <input
          id="question"
          ref={inputRef}
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
