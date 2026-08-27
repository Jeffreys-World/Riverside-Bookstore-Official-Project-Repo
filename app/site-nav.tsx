"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { NavMenu, NavPreviewMenu, type NavMenuItem } from "@/components/nav-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { getBrowserClient } from "@/lib/supabase-browser";
import { customerSignOutAction } from "./product-a/actions";

const SUPPORT_ITEMS = [
  { href: "/product-c", label: "FAQ & Chatbot" },
  { href: "/product-c/contact", label: "Contact Us" },
] as const;

// Lightweight "is a customer signed in, and what's their email" for the
// header only — a plain auth-state listener, no realtime socket. The
// customer_id itself is resolved server-side where it's needed
// (getMyCustomerIdAction); the nav only needs the email for the label.
function useCustomerEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  return email;
}

export function SiteNav() {
  const pathname = usePathname() ?? "";
  const { count, toggle } = useCart();
  const customerEmail = useCustomerEmail();

  // "My Account" gateway. Staff Account (inventory + marketing workspace)
  // is always listed; the customer side flips between sign-in/sign-up and
  // account/log-out on the session.
  const accountItems: NavMenuItem[] = customerEmail
    ? [
        { href: "/product-a/account", label: "Your account" },
        { label: "Log out", action: customerSignOutAction },
        { href: "/product-b", label: "Staff Account" },
      ]
    : [
        { href: "/product-a/login", label: "Sign in" },
        { href: "/product-a/signup", label: "Create account" },
        { href: "/product-b", label: "Staff Account" },
      ];

  const accountActive =
    pathname.startsWith("/product-a/account") ||
    pathname.startsWith("/product-a/login") ||
    pathname.startsWith("/product-a/signup") ||
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
      <NavMenu
        label="My Account"
        active={accountActive}
        header={customerEmail ?? undefined}
        items={accountItems}
      />
      <NavMenu label="Support Center" active={supportActive} items={[...SUPPORT_ITEMS]} />
      <ThemeToggle />
      <button
        type="button"
        onClick={toggle}
        aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
        className="relative flex min-h-[48px] min-w-[48px] flex-none items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-ink transition-transform duration-150 hover:scale-125 hover:border-accent hover:bg-accent hover:text-paper"
      >
        <span aria-hidden className="text-2xl">
          🛒
        </span>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full border-2 border-surface bg-claret px-1 py-0.5 text-center font-mono text-[11px] font-bold leading-none text-paper">
            {count}
          </span>
        )}
      </button>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-surface/95 backdrop-blur">
      {/* The balanced single row needs ~1000px to fit — three preview
          menus, the wordmark, and My Account/Support/cart. Below lg it
          has nowhere to give (every trigger and the wordmark are
          whitespace-nowrap), so it would overflow the viewport from
          ~640px up to that fit width — every tablet-portrait and
          split-screen size. Hold the stacked layout until lg: centered
          logo row, then a wrapping link row. At lg and up, a 3-column
          grid (not flex — a flex center child drifts off true-center the
          moment the left/right clusters differ in width) keeps the logo
          centered on one row. */}
      <div className="flex flex-col items-center gap-2 px-6 py-3 lg:hidden">
        <Link href="/product-a" className="font-serif text-2xl tracking-wide text-ink">
          Riverside Books
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-1">
          {shopLinks}
          {utilityLinks}
        </nav>
      </div>

      {/* Both side columns are minmax(0,1fr) (equal width, allowed to
          shrink below content) and stretch full-width, then spread their
          own items with justify-between — the outermost item lands at the
          page edge (px-6) and the innermost item lands right against the
          title, so the gap to the title is the same fixed grid `gap` on
          both sides no matter how many items are in each cluster. */}
      <nav className="mx-auto hidden max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 px-6 py-3 lg:grid">
        <div className="flex min-w-0 items-center justify-between gap-4 justify-self-stretch">{shopLinks}</div>

        <Link
          href="/product-a"
          className="justify-self-center whitespace-nowrap font-serif text-2xl tracking-wide text-ink"
        >
          Riverside Books
        </Link>

        <div className="flex min-w-0 items-center justify-between gap-4 justify-self-stretch">{utilityLinks}</div>
      </nav>
    </header>
  );
}
