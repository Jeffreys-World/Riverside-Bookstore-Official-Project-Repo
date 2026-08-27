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
      <span aria-hidden className="text-xl">
        <span className="inline dark:hidden">🌙</span>
        <span className="hidden dark:inline">☀️</span>
      </span>
    </button>
  );
}
