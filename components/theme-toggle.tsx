"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "riverside-theme";

export function ThemeToggle() {
  // Always starts false so the client's first render matches the
  // server's (which has no access to the browser's dark-mode class or
  // localStorage) — the inline blocking script in app/layout.tsx already
  // set the real `dark` class on <html> before paint, this just corrects
  // the icon to match right after hydration, in the same tick a user
  // can't perceive as a flash.
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
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
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex min-h-[48px] min-w-[48px] flex-none items-center justify-center rounded-md text-ink/70 transition-transform duration-150 hover:scale-110 hover:bg-field hover:text-ink"
    >
      <span aria-hidden className="text-xl">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
