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
      <div className="flex gap-1">
        <Link
          href="/product-b"
          aria-current={active === "dashboard" ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
            active === "dashboard" ? "bg-surface text-ink" : "text-ink/60 hover:text-ink"
          }`}
        >
          Inventory
        </Link>
        <Link
          href="/product-d"
          aria-current={active === "marketing" ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
            active === "marketing" ? "bg-surface text-ink" : "text-ink/60 hover:text-ink"
          }`}
        >
          Marketing
        </Link>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-ink/60 hover:text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
