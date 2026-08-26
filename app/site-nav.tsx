"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { NavMenu, NavPreviewMenu } from "@/components/nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";

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

  const shopLinks = (
    <>
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
    </>
  );

  const utilityLinks = (
    <>
      <NavMenu label="My Account" active={accountActive} items={[...ACCOUNT_ITEMS]} />
      <NavMenu label="Support Center" active={supportActive} items={[...SUPPORT_ITEMS]} />
      <ThemeToggle />
      <button
        type="button"
        onClick={toggle}
        aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
        className="relative flex min-h-[48px] min-w-[48px] flex-none items-center justify-center rounded-md text-ink/70 transition-transform duration-150 hover:scale-110 hover:bg-field hover:text-ink"
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
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-surface/95 backdrop-blur">
      {/* Below sm: the balanced single row has nowhere to give — three
          preview menus, the wordmark, and My Account/Support/cart don't
          fit one line under ~640px without pushing the cart button
          off-screen. Stack instead: centered logo row, then a wrapping
          link row, same shape this header used before the single-row
          layout. At sm and up, a 3-column grid (not flex — a flex center
          child drifts off true-center the moment the left/right clusters
          differ in width) keeps the logo centered on one row. */}
      <div className="flex flex-col items-center gap-2 px-6 py-3 sm:hidden">
        <Link href="/product-a" className="font-serif text-2xl tracking-wide text-ink">
          Riverside Books
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-1">
          {shopLinks}
          {utilityLinks}
        </nav>
      </div>

      <nav className="mx-auto hidden max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-6 py-3 sm:grid">
        <div className="flex items-center gap-1 justify-self-start">{shopLinks}</div>

        <Link
          href="/product-a"
          className="justify-self-center whitespace-nowrap font-serif text-2xl tracking-wide text-ink"
        >
          Riverside Books
        </Link>

        <div className="flex items-center gap-1 justify-self-end">{utilityLinks}</div>
      </nav>
    </header>
  );
}
