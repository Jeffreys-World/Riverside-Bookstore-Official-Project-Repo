"use server";

/**
 * RSVP Server Action — wires up event_tickets (0015_events_details_and_rsvp.sql),
 * unused since the schema was first defined. Same service-role pattern as
 * checkoutAction: create_event_ticket isn't anon-grantable, so this must
 * run server-side.
 */

import { getServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import { rsvpRequestSchema } from "@/types/schema";

export type RsvpResult =
  | { ok: true; ticketId: string }
  | { ok: false; message: string };

export async function rsvpToEventAction(input: unknown): Promise<RsvpResult> {
  const parsed = rsvpRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid customer ID (cust_XXXXX) to RSVP." };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc("create_event_ticket", {
    p_customer_id: parsed.data.customer_id,
    p_event_id: parsed.data.event_id,
  });

  if (error) {
    // A well-formed but nonexistent customer_id violates the
    // event_tickets.customer_id FK (0001) — name the actual problem.
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        message: "We couldn't find that customer ID — check it, or create an account.",
      };
    }
    console.error(`rsvpToEventAction failed [${error.code ?? "?"}]: ${error.message}`);
    return { ok: false, message: "Something went wrong RSVPing. Please try again." };
  }
  if (!data) {
    return { ok: false, message: "Something went wrong RSVPing. Please try again." };
  }

  return { ok: true, ticketId: data as string };
}

export type ExistingTicketResult = { ticketId: string | null };

/**
 * Checked on page load (with a saved customer id) so a returning visitor
 * sees "You're going" instead of the RSVP form again. Anon-safe read —
 * get_event_ticket requires both the exact customer_id and event_id.
 */
export async function getExistingTicketAction(
  customerId: string,
  eventId: string
): Promise<ExistingTicketResult> {
  const supabase = getServerClient();
  const { data } = await supabase.rpc("get_event_ticket", {
    p_customer_id: customerId,
    p_event_id: eventId,
  });
  return { ticketId: (data as string | null) ?? null };
}
