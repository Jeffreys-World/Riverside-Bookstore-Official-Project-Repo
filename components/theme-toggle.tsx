"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "riverside-theme";

export function ThemeToggle() {
  // The inline blocking script in app/layout.tsx sets the real `dark`
  // class on <html> before paint. `isDark` is only used to pick the
  // directional aria-label, and only *after* mount — before that the
  // button carries a state-independent name so a slow hydration never
  // leaves a screen reader with the wrong label ("Switch to dark mode"
  // while already dark). The glyph itself is driven by CSS (dark: variant
  // keys off the class the script already set), so it's correct at first
  // paint with zero JS.
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private browsing / storage blocked — theme still applies for this
      // page view, it just won't be remembered next visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted
          ? isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
          : "Toggle light or dark theme"
      }
      className="flex min-h-[48px] min-w-[48px] flex-none items-center justify-center rounded-md text-ink/70 transition-transform duration-150 hover:scale-125 hover:bg-field hover:text-ink"
    >
      {/* Inline SVG rather than 🌙/☀️ emoji: an emoji renders in whatever
          colour and shape the viewer's OS emoji font ships, so it ignored
          the ink token entirely and looked different on every platform.
          These inherit currentColor and sit in the same `inline dark:hidden`
          / `hidden dark:inline` pair, so the CSS-at-first-paint behaviour
          described above is unchanged. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="inline h-5 w-5 dark:hidden"
      >
        <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5Z" />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden h-5 w-5 dark:inline"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
