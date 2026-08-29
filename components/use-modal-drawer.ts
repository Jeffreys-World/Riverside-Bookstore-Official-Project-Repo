"use client";

import { useEffect, useRef } from "react";

/**
 * The keyboard half of the two slide-over drawers (cart, product details).
 *
 * Both declare role="dialog" aria-modal="true" but implemented none of what
 * that promises (found by /qa on 2026-08-29): Escape did nothing, opening one
 * left focus behind on the page body, Tab walked straight out of the "modal"
 * into the nav behind it, and while closed each drawer kept its own controls
 * in the tab order inside an aria-hidden="true" container — so a keyboard
 * user could land on an invisible "Go to checkout" that screen readers
 * refuse to announce. The nav dropdowns in this same app already close on
 * Escape, so the drawers were the odd ones out.
 *
 * Attach the returned ref to the panel element. Both drawers stay mounted
 * and slide via transform, so `inert` (not unmounting) is what takes the
 * closed panel out of the tab order and the accessibility tree.
 */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalDrawer<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  // Held in a ref so the effect below keys on `isOpen` alone. Keying it on
  // the callback too would re-run (and re-steal focus) on every parent
  // render that hands us a fresh closure.
  const onCloseRef = useRef(onClose);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    if (!isOpen) {
      panel.inert = true;
      return;
    }

    panel.inert = false;
    // Remember who opened it so focus can go back there on close.
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (focusables()[0] ?? panel).focus();

    // An arrow function, not a declaration: TypeScript keeps the non-null
    // narrowing of `panel` across an arrow closure but not a hoisted one.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !panel.contains(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const restore = restoreRef.current;
      restoreRef.current = null;
      // Pull focus back to whatever opened the drawer, but only when focus
      // still belongs to the drawer — either it's literally inside the
      // panel, or the browser already dropped it to <body> on the way out
      // (which is what actually happens when the focused control becomes
      // inert). A click elsewhere on the page leaves focus there instead
      // of yanking it back to the trigger.
      const active = document.activeElement;
      const focusWasOurs =
        (active instanceof Node && panel.contains(active)) || active === document.body || active === null;
      if (restore && restore !== document.body && restore.isConnected && focusWasOurs) {
        restore.focus();
      }
    };
  }, [isOpen]);

  return panelRef;
}
