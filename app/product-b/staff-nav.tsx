import Link from "next/link";
import { signOutAction } from "./actions";

/**
 * Shared chrome for the staff workspace — Product B's inventory dashboard
 * and Product D's marketing generator are separate routes but one
 * authenticated "employee workspace" per the spec, so both pages render
 * this instead of duplicating the tab/sign-out markup.
 */
export function StaffNav({ active }: { active: "dashboard" | "marketing" }) {
  return (
    <div className="mb-8 flex items-center justify-between border-b border-ink/10 pb-4">
      <div className="flex gap-2">
        <Link
          href="/product-b"
          aria-current={active === "dashboard" ? "page" : undefined}
          className={`min-h-[48px] whitespace-nowrap rounded-md px-5 py-3 text-base font-medium transition-transform duration-150 hover:scale-105 ${
            active === "dashboard" ? "bg-surface text-ink" : "text-ink/60 hover:text-ink"
          }`}
        >
          Inventory
        </Link>
        <Link
          href="/product-d"
          aria-current={active === "marketing" ? "page" : undefined}
          className={`min-h-[48px] whitespace-nowrap rounded-md px-5 py-3 text-base font-medium transition-transform duration-150 hover:scale-105 ${
            active === "marketing" ? "bg-surface text-ink" : "text-ink/60 hover:text-ink"
          }`}
        >
          Marketing
        </Link>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="min-h-[48px] rounded-md px-5 py-3 text-base text-ink/60 transition-transform duration-150 hover:scale-105 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
