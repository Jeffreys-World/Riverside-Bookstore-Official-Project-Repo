/**
 * lib/realtime.ts
 *
 * Product B's live-update subscription. Wraps a Supabase Realtime
 * postgres_changes channel with an explicit reconnect backoff (1s -> 30s,
 * doubling on each failed attempt, reset to 1s on success) and a
 * connection-status flag the dashboard renders as a "reconnecting…"
 * indicator — per the design doc's requirement that a dropped connection
 * recover without a manual page refresh.
 *
 * Requires the `orders` and `books` tables to be added to the
 * supabase_realtime publication (see
 * supabase/migrations/0003_orders_staff_select.sql) — without that, this
 * subscribes successfully but never receives any change events.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Deliberately untyped by row shape — callers cast `payload.new`/`payload.old`
 * to their own row type inside onChange. Parameterizing this over T ran into
 * @supabase/supabase-js's RealtimePostgresChangesPayload<T> requiring T to
 * satisfy an index-signature constraint that plain row interfaces
 * (OrderRow, BookRow) don't have, without adding one just to satisfy it.
 */
export interface RealtimeChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export type RealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export interface RealtimeChangesConfig {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema: string;
  table: string;
  filter?: string;
}

export function useRealtimeSubscription(
  client: SupabaseClient,
  channelName: string,
  config: RealtimeChangesConfig,
  onChange: (payload: RealtimeChangePayload) => void
): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { event, schema, table, filter } = config;

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    function connect() {
      if (cancelled) return;
      channel = client
        .channel(channelName)
        .on(
          "postgres_changes" as never,
          { event, schema, table, filter } as never,
          (payload: RealtimeChangePayload) => onChangeRef.current(payload)
        )
        .subscribe((subStatus) => {
          if (cancelled) return;
          if (subStatus === "SUBSCRIBED") {
            backoffRef.current = INITIAL_BACKOFF_MS;
            setStatus("connected");
            return;
          }
          if (
            subStatus === "TIMED_OUT" ||
            subStatus === "CHANNEL_ERROR" ||
            subStatus === "CLOSED"
          ) {
            setStatus("reconnecting");
            scheduleReconnect();
          }
        });
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (channel) client.removeChannel(channel);
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, backoffRef.current);
    }

    connect();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channel) client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channelName, event, schema, table, filter]);

  return status;
}
