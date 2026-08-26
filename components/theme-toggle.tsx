"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "riverside-theme";

// Mirrors the inline blocking script in app/layout.tsx that already set
// the `dark` class before paint (avoiding a flash of the wrong theme) —
// this just reads back what that script decided so the button's icon
// matches on first render instead of assuming light.
function readInitialIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(readInitialIsDark);

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
