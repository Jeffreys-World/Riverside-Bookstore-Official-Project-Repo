"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard affordance for generated content.
 *
 * Product D exists to produce text that gets pasted somewhere else — an
 * Instagram caption, a newsletter blurb, a shelf card — and until now the
 * only way to get any of it out was dragging a selection by hand. See
 * DESIGN.md, "Product D / D1".
 */

type CopyState = "idle" | "copied" | "failed";

// Long enough to read, short enough that the button is back to "Copy"
// before staff reach for the next one.
const RESET_MS = 1500;

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, copying and then navigating away sets state on an
  // unmounted component, and a pending timer keeps the old text alive.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      // Undefined on an insecure origin (plain http on a LAN address, which
      // is exactly how staff might reach a dev box), so this is a real
      // branch rather than defensive noise.
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch (err) {
      // Denied permission, insecure context, or a browser that refuses a
      // programmatic copy. Say so instead of showing a success that did not
      // happen — staff would paste stale content and not know why.
      console.error(`Copy failed for ${label}: ${err}`);
      setState("failed");
    }
    timerRef.current = setTimeout(() => setState("idle"), RESET_MS);
  }

  const text_ = {
    idle: "Copy",
    copied: "Copied",
    failed: "Press Ctrl+C",
  }[state];

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className={`min-h-[44px] whitespace-nowrap rounded-md border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-transform duration-150 hover:scale-105 ${
          state === "copied"
            ? "border-accent text-accent"
            : state === "failed"
              ? "border-claret text-claret"
              : "border-ink/20 text-ink/60 hover:border-ink/40 hover:text-ink"
        }`}
      >
        {text_}
      </button>
      {/* The label swap alone is silent to a screen reader, since the button
          is not a live region and focus stays put across the change. */}
      <span aria-live="polite" className="sr-only">
        {state === "copied"
          ? `${label} copied to clipboard`
          : state === "failed"
            ? `Could not copy ${label}. Select the text and press Control C.`
            : ""}
      </span>
    </>
  );
}
