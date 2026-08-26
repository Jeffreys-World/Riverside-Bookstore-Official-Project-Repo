"use client";

/**
 * Dropdown nav triggers for the site header. Two shapes share one
 * open/close interaction (click to open, closes on outside click,
 * Escape, or picking an item):
 * - NavMenu: a short list of links (My Account -> Customer/Staff Account,
 *   Support Center -> FAQ/Contact Us).
 * - NavPreviewMenu: one description line + a single click-through CTA
 *   (Books/Gifts/Events' "overview description with click-through
 *   filter" pattern).
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function useDropdown() {
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

  return { open, setOpen, containerRef };
}

function TriggerButton({
  label,
  active,
  open,
}: {
  label: string;
  active: boolean;
  open: boolean;
}) {
  return (
    <>
      {label}
      <span aria-hidden className="ml-1 inline-block text-[10px] align-middle">
        {open ? "▲" : "▼"}
      </span>
    </>
  );
}

const TRIGGER_CLASS = (active: boolean) =>
  `inline-block whitespace-nowrap rounded-md border-b-2 border-accent px-3 py-3 text-sm font-medium transition-transform transition-colors duration-150 hover:scale-125 hover:shadow-sm ${
    active ? "text-ink" : "text-ink/60 hover:text-ink"
  }`;

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
  const { open, setOpen, containerRef } = useDropdown();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={TRIGGER_CLASS(active)}
      >
        <TriggerButton label={label} active={active} open={open} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-40 mt-1 min-w-[13rem] rounded-md border border-ink/10 bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block scale-100 px-4 py-2 text-sm text-ink transition-transform duration-150 hover:scale-105 hover:bg-ink/5"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function NavPreviewMenu({
  label,
  description,
  ctaHref,
  ctaLabel,
  active,
}: {
  label: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
  active: boolean;
}) {
  const { open, setOpen, containerRef } = useDropdown();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={TRIGGER_CLASS(active)}
      >
        <TriggerButton label={label} active={active} open={open} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-1 w-64 rounded-md border border-ink/10 bg-surface p-4 shadow-lg"
        >
          <p className="text-sm text-ink/70">{description}</p>
          <Link
            href={ctaHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-3 inline-block text-sm font-medium text-accent underline-offset-2 transition-transform duration-150 hover:scale-105 hover:underline"
          >
            {ctaLabel} →
          </Link>
        </div>
      )}
    </div>
  );
}
