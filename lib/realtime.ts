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
  onChange: (payload: RealtimeChangePayload) => void,
  /**
   * Called every time the channel transitions back to connected *after*
   * the first connect — i.e. after a dropped connection recovers.
   * postgres_changes never replays events missed while offline, so the
   * dashboard uses this to re-query the affected table and merge. Not
   * called on the initial subscribe (the caller's SSR snapshot is current
   * at that point).
   */
  onReconnect?: () => void
): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const { event, schema, table, filter } = config;

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    // Bumped on every connect(). A channel we tear down still emits a
    // trailing CLOSED asynchronously (realtime-js resolves unsubscribe()
    // on the server ack); its subscribe callback captures the attempt it
    // was opened under and bails when that's stale. Without this, the
    // CLOSED from our own removeChannel() re-entered the error branch and
    // scheduled another reconnect, which tore down the channel connect()
    // had just created — an endless reconnect<->connected oscillation
    // after the first real drop.
    let attempt = 0;
    let connectedOnce = false;

    function clearTimer() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function connect() {
      if (cancelled) return;
      const myAttempt = ++attempt;
      channel = client
        .channel(channelName)
        .on(
          "postgres_changes" as never,
          { event, schema, table, filter } as never,
          (payload: RealtimeChangePayload) => onChangeRef.current(payload)
        )
        .subscribe((subStatus) => {
          if (cancelled || myAttempt !== attempt) return;
          if (subStatus === "SUBSCRIBED") {
            backoffRef.current = INITIAL_BACKOFF_MS;
            clearTimer();
            setStatus("connected");
            if (connectedOnce) onReconnectRef.current?.();
            connectedOnce = true;
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
      // A pending timer already owns the next attempt — don't stack.
      if (cancelled || timeoutRef.current) return;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        const stale = channel;
        channel = null;
        if (stale) client.removeChannel(stale);
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, backoffRef.current);
    }

    connect();

    return () => {
      cancelled = true;
      clearTimer();
      if (channel) client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channelName, event, schema, table, filter]);

  return status;
}
