"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/product-a", label: "Order & Loyalty" },
  { href: "/product-a/account", label: "My Account" },
  { href: "/product-c", label: "Support" },
  { href: "/product-d", label: "Marketing" },
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

  return (
    <nav className="border-b border-ink/10 bg-white">
      <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-6">
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
    </nav>
  );
}
