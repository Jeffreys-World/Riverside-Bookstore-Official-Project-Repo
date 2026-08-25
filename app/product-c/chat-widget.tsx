"use client";

import { useState, type FormEvent } from "react";
import { askSupportChatbotAction } from "./actions";

interface Exchange {
  question: string;
  answer: string;
}

export function ChatWidget() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return; // guards against double-submit

    setPending(true);
    setQuestion("");
    try {
      const answer = await askSupportChatbotAction(q);
      setHistory((prev) => [...prev, { question: q, answer }]);
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
            <p className="rounded-lg border border-ink/10 bg-white p-3 text-ink/80">
              {ex.answer}
            </p>
          </div>
        ))}
        {pending && <p className="text-sm text-ink/50">Checking…</p>}
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
          className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
