"use client";

/**
 * Dropdown nav trigger — "My Account" and "Support Center" each show two
 * entry points on interaction instead of linking directly, per the
 * Account Navigation Gateway / Support Center spec. Closes on outside
 * click, Escape, or picking an item.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface NavMenuItem {
  href: string;
  label: string;
}

export function NavMenu({
  label,
  active,
  items,
}: {
  label: string;
  active: boolean;
  items: NavMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
          active ? "border-accent text-ink" : "border-transparent text-ink/60 hover:text-ink"
        }`}
      >
        {label}
        <span aria-hidden className="ml-1 inline-block text-[10px] align-middle">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-1 min-w-[13rem] rounded-md border border-ink/10 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-ink hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
