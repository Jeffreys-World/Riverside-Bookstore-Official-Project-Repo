"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { NavMenu } from "@/components/nav-menu";

// "My Account" gateway: Customer Account (order history + loyalty) vs.
// Staff Account (inventory + marketing workspace) — see
// app/product-b/staff-nav.tsx for the staff-side tabs between those two.
const ACCOUNT_ITEMS = [
  { href: "/product-a/account", label: "Customer Account" },
  { href: "/product-b", label: "Staff Account" },
] as const;

const SUPPORT_ITEMS = [
  { href: "/product-c", label: "Frequently Asked Questions" },
  { href: "/product-c/contact", label: "Contact Us" },
] as const;

export function SiteNav() {
  const pathname = usePathname() ?? "";
  const { count, toggle } = useCart();

  const accountActive =
    pathname.startsWith("/product-a/account") ||
    pathname.startsWith("/product-b") ||
    pathname.startsWith("/product-d");
  const supportActive = pathname.startsWith("/product-c");

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur">
      <div className="flex justify-center border-b border-ink/10 py-4">
        <Link href="/product-a" className="font-serif text-2xl tracking-wide text-ink">
          Riverside Books
        </Link>
      </div>
      <nav className="border-b border-ink/10">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-6">
          <div className="flex flex-1 items-center gap-1">
            <NavMenu label="My Account" active={accountActive} items={[...ACCOUNT_ITEMS]} />
            <NavMenu label="Support Center" active={supportActive} items={[...SUPPORT_ITEMS]} />
          </div>
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
    </header>
  );
}
