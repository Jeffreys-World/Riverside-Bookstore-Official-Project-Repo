"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { loadCustomerId, saveCustomerId } from "@/lib/customer-id-storage";
import { getBrowserClient } from "@/lib/supabase-browser";
import { CUSTOMER_ID_REGEX } from "@/types/schema";
import { getExistingTicketAction, rsvpToEventAction } from "../actions";
import { getMyCustomerIdAction } from "../../actions";

export function EventRsvp({ eventId }: { eventId: string }) {
  const [customerId, setCustomerId] = useState(() => loadCustomerId());
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [checkedExisting, setCheckedExisting] = useState(false);
  const [error, setError] = useState("");

  // Resolve who this is (session first — 0034_customer_auth.sql — then the
  // saved cust_XXXXX), then check whether they already have a ticket so a
  // return visit shows "You're going" instead of the form again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = loadCustomerId();
      const { data } = await getBrowserClient().auth.getSession();
      const email = data.session?.user.email ?? null;
      if (email) {
        const sessionId = await getMyCustomerIdAction();
        if (cancelled) return;
        if (sessionId) {
          id = sessionId;
          saveCustomerId(sessionId);
          setCustomerId(sessionId);
          setSignedInEmail(email);
        }
      }
      if (!id) {
        if (!cancelled) setCheckedExisting(true);
        return;
      }
      const res = await getExistingTicketAction(id, eventId);
      if (cancelled) return;
      if (res.ticketId) setTicketId(res.ticketId);
      setCheckedExisting(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!CUSTOMER_ID_REGEX.test(customerId)) {
      setError("Enter a valid customer ID (cust_XXXXX), or create an account first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await rsvpToEventAction({ customer_id: customerId, event_id: eventId });
      if (res.ok) {
        saveCustomerId(customerId);
        setTicketId(res.ticketId);
      } else {
        setError(res.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!checkedExisting) return null;

  if (ticketId) {
    return (
      <section className="mt-8 rounded-lg border border-accent/30 bg-accent-soft p-5">
        <h2 className="font-serif text-lg text-ink">You&apos;re going</h2>
        <p className="mt-1 text-sm text-ink/70">
          Confirmation <span className="font-mono">{ticketId}</span>. See you there.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-ink/10 bg-surface p-5">
      <h2 className="font-serif text-lg text-ink">RSVP</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-wrap gap-2">
        {!signedInEmail && (
          <>
            <label htmlFor="rsvp_customer_id" className="sr-only">
              Customer ID
            </label>
            <input
              id="rsvp_customer_id"
              type="text"
              placeholder="cust_XXXXX"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="min-h-[44px] flex-1 rounded-md border border-ink/20 bg-field px-3 py-2 text-ink"
            />
          </>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] flex-none rounded-md bg-accent px-6 py-2 font-medium text-paper transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? "RSVPing…" : "RSVP"}
        </button>
      </form>
      <p className="mt-2 text-sm text-ink/60">
        {signedInEmail ? (
          <>
            RSVPing as <span className="text-ink">{signedInEmail}</span>.
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href={`/product-a/signup?next=${encodeURIComponent(`/product-a/events/${eventId}`)}`}
              className="text-accent underline-offset-2 hover:underline"
            >
              Create an account
            </Link>{" "}
            to get a customer ID.
          </>
        )}
      </p>
      <div role="status" aria-live="polite" className="mt-2 min-h-[1.25rem]">
        {error && <p className="text-sm text-claret">{error}</p>}
      </div>
    </section>
  );
}
