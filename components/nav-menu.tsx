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

// rounded-b-none: the underline is `border-b-2`, and a rounded bottom corner
// bends that 2px line up into a little cup at each end (looked like a
// hand-drawn smile under every tab). Square the bottom so the underline reads
// as a flat tab rule; keep the top corners rounded for the hover shadow.
//
// The underline now carries the current-section state instead of painting
// accent under every trigger at rest. Before, all five triggers held
// `border-accent` permanently and "you are here" was signalled only by text
// opacity (ink vs ink/60) — a 40% alpha shift on 14px text, which is close
// to invisible next to five identical accent rules competing for the same
// attention. Selected keeps the accent rule; the rest get a quiet neutral
// one. Same selected/unselected treatment the Support Center tablist uses
// (app/product-c/support-tabs.tsx), so the app's two tab-shaped navigations
// finally agree.
const TRIGGER_CLASS = (active: boolean) =>
  `inline-block whitespace-nowrap rounded-md rounded-b-none border-b-2 px-3 py-3 text-sm transition-transform transition-colors duration-150 hover:scale-125 hover:shadow-sm ${
    active
      ? "border-accent font-semibold text-ink"
      : "border-ink/15 font-medium text-ink/60 hover:border-ink/30 hover:text-ink"
  }`;

export interface NavMenuItem {
  label: string;
  /** A link destination, OR... */
  href?: string;
  /** ...a server action to run (e.g. sign out). Rendered as a form/button menu item. */
  action?: () => void | Promise<void>;
}

const MENU_ITEM_CLASS =
  "block min-h-[44px] w-full scale-100 px-4 py-3 text-left text-sm text-ink transition-transform duration-150 hover:scale-105 hover:bg-ink/5";

// Shared panel chrome. Below lg the header is the stacked, centre-wrapped
// layout, so an edge-anchored `absolute` panel (256px, anchored to a
// shrink-wrapped trigger) runs off the viewport and its labels get
// clipped past x=0. Below lg the panel is instead pinned to the viewport
// edges (`fixed inset-x-3`, vertical position left at its in-flow spot
// via top-auto) so it always fits; at lg it returns to `absolute` and
// the per-menu edge anchoring. border-ink/30 in dark mode because the
// drop shadow is invisible on the near-black surface.
const PANEL_BASE =
  "fixed inset-x-3 top-auto z-40 mt-1 rounded-md border border-ink/15 bg-surface shadow-lg dark:border-ink/30 lg:absolute lg:inset-x-auto lg:top-full";

export function NavMenu({
  label,
  active,
  items,
  header,
}: {
  label: string;
  active: boolean;
  items: NavMenuItem[];
  /** Optional non-interactive line at the top of the menu (e.g. the signed-in email). */
  header?: string;
}) {
  const { open, setOpen, containerRef } = useDropdown();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={active ? "page" : undefined}
        className={TRIGGER_CLASS(active)}
      >
        <TriggerButton label={label} active={active} open={open} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`${PANEL_BASE} py-1 lg:right-0 lg:w-auto lg:min-w-[13rem]`}
        >
          {header && (
            <p className="truncate border-b border-ink/10 px-4 py-2 text-xs text-ink/60">{header}</p>
          )}
          {items.map((item) =>
            item.action ? (
              <form key={item.label} action={item.action} onSubmit={() => setOpen(false)}>
                <button type="submit" role="menuitem" className={MENU_ITEM_CLASS}>
                  {item.label}
                </button>
              </form>
            ) : (
              <Link
                key={item.href ?? item.label}
                href={item.href ?? "#"}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={MENU_ITEM_CLASS}
              >
                {item.label}
              </Link>
            )
          )}
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
        aria-current={active ? "page" : undefined}
        className={TRIGGER_CLASS(active)}
      >
        <TriggerButton label={label} active={active} open={open} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`${PANEL_BASE} p-4 lg:left-0 lg:w-64`}
        >
          <p className="text-sm text-ink/70">{description}</p>
          <Link
            href={ctaHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-accent underline-offset-2 transition-transform duration-150 hover:scale-105 hover:underline"
          >
            {ctaLabel} →
          </Link>
        </div>
      )}
    </div>
  );
}
