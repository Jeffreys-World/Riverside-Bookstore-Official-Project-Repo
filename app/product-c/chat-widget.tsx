"use client";

import { useState, type FormEvent } from "react";
import { askSupportChatbotAction, type SupportChatBook } from "./actions";
import { useRotatingMessage } from "@/lib/use-rotating-message";

interface Exchange {
  question: string;
  answer: string;
  books: SupportChatBook[];
}

const CHECKING_MESSAGES = ["Checking…", "Looking that up…", "Almost there…"] as const;

export function ChatWidget() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const progressMessage = useRotatingMessage(CHECKING_MESSAGES, pending);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return; // guards against double-submit

    setPending(true);
    setQuestion("");
    try {
      const result = await askSupportChatbotAction(q);
      setHistory((prev) => [...prev, { question: q, answer: result.answer, books: result.books }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      <div aria-live="polite" role="log" className="space-y-4">
        {history.map((ex, i) => (
          <div key={i} className="space-y-1">
            <p className="font-medium text-ink">{ex.question}</p>
            <p className="rounded-lg border border-ink/10 bg-surface p-3 text-ink/80">
              {ex.answer}
            </p>
            {ex.books.length > 0 && (
              <div className="flex gap-3">
                {ex.books.map((b) => (
                  <div key={b.isbn} className="w-14 flex-none">
                    {b.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.cover_url}
                        alt=""
                        loading="lazy"
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
                    <p className="mt-1 truncate text-[10px] text-ink/60">{b.book_title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && <p className="text-sm text-ink/50">{progressMessage}</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <label htmlFor="question" className="sr-only">
          Ask a question
        </label>
        <input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Is Atomic Habits in stock?"
          className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
