"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";

// Product D (Marketing) isn't listed here — it's a staff tool (now
// auth-gated the same as Product B), reached from the Staff workspace's
// own StaffNav, not the public site-wide nav.
const TABS = [
  { href: "/product-a", label: "Order & Loyalty" },
  { href: "/product-a/account", label: "My Account" },
  { href: "/product-c", label: "Support" },
  { href: "/product-b", label: "Staff" },
] as const;

// "/product-a" must only be active on the exact order/pre-order page, not
// on "/product-a/account" too — every other tab is fine matching by prefix
// (e.g. "/product-b" also covers "/product-b/sign-in").
function isActive(pathname: string, href: string): boolean {
  if (href === "/product-a") return pathname === "/product-a";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const { count, toggle } = useCart();

  return (
    <nav className="sticky top-0 z-30 border-b border-ink/10 bg-surface/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-3xl items-center gap-1 px-6">
        <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const active = isActive(pathname ?? "", tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-accent text-ink"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {/* Scroll hint for the overflowing tab strip on narrow viewports — a
            plain scrollbar-less overflow gave no visual cue it was
            scrollable (flagged in the 2026-08-26 /qa pass). */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-14 top-0 h-full w-8 bg-gradient-to-l from-surface to-transparent sm:hidden"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
          className="relative flex min-h-[44px] flex-none items-center px-3 text-ink/70 hover:text-ink"
        >
          <span aria-hidden>🛒</span>
          {count > 0 && (
            <span className="ml-1 min-w-[1.25rem] rounded-full bg-accent px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none text-paper">
              {count}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
