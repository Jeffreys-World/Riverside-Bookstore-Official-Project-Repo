"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { NavMenu, NavPreviewMenu } from "@/components/nav-menu";

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
  // Books/Gifts share one route (?category= distinguishes them) — reading
  // that here would need useSearchParams, which forces every static page
  // under this global header into a Suspense boundary. Not worth it for
  // cosmetic active-state precision: both light up together on /product-a.
  const eventsActive = pathname.startsWith("/product-a/events");
  const shopActive = pathname === "/product-a" && !eventsActive;

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur">
      <div className="flex justify-center border-b border-ink/10 py-4">
        <Link href="/product-a" className="font-serif text-2xl tracking-wide text-ink">
          Riverside Books
        </Link>
      </div>
      <nav className="border-b border-ink/10">
        <div className="mx-auto flex max-w-4xl items-center gap-1 px-6">
          <div className="flex flex-1 items-center gap-1">
            <NavPreviewMenu
              label="Books"
              active={shopActive}
              description="Reserve a title now, pay in person at pickup — the full catalog, from bestsellers to backlist."
              ctaHref="/product-a?category=books"
              ctaLabel="Browse Books"
            />
            <NavPreviewMenu
              label="Gifts"
              active={shopActive}
              description="Cards and small gifts on the shelf now — browse in-store only, not part of pre-order."
              ctaHref="/product-a?category=gifts"
              ctaLabel="Browse Gifts"
            />
            <NavPreviewMenu
              label="Events"
              active={eventsActive}
              description="Author readings and signings hosted in-store — see who's coming up."
              ctaHref="/product-a/events"
              ctaLabel="View Events"
            />
          </div>
          <div className="flex items-center gap-1">
            <NavMenu label="My Account" active={accountActive} items={[...ACCOUNT_ITEMS]} />
            <NavMenu label="Support Center" active={supportActive} items={[...SUPPORT_ITEMS]} />
            <button
              type="button"
              onClick={toggle}
              aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
              className="relative flex min-h-[48px] min-w-[48px] flex-none items-center justify-center rounded-md text-ink/70 hover:bg-white hover:text-ink"
            >
              <span aria-hidden className="text-xl">
                🛒
              </span>
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 min-w-[1.1rem] rounded-full bg-accent px-1 py-0.5 text-center font-mono text-[10px] font-semibold leading-none text-paper">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
