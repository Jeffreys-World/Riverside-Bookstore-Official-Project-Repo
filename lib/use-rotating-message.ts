import { useEffect, useState } from "react";

// Gemini calls here are a single request/response with no real progress
// events to report (see TODOS.md's 2026-08-26 QA entry, ISSUE-006) — this
// rotates through a fixed message list on a timer so a 19-32s wait shows
// *something* changing instead of one static label the whole time.
export function useRotatingMessage(messages: readonly string[], active: boolean, intervalMs = 4000): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  return messages[index] ?? messages[0] ?? "";
}
