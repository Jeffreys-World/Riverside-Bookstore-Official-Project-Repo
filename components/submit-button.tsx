"use client";

/**
 * Submit button for server-action <form action={...}> flows. Shows a
 * pending label while the action runs, via useFormStatus (which only
 * reports the status of the nearest enclosing <form>). Matches the
 * primary-button styling used across the app.
 */

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={
        className ??
        "min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      }
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
