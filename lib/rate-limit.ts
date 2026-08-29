/**
 * lib/rate-limit.ts
 *
 * Per-caller throttling for the `/api/live/*` route handlers. The
 * same-origin guard (lib/same-origin.ts) closed the "anyone on the
 * internet" hole those routes shipped with; this closes the rest of it —
 * a first-party page can still sit in a loop minting Gemini Live tokens
 * against the store's paid key, or hammering create_preorder.
 *
 * Sliding window, held in process memory. That is the right shape for how
 * this app actually runs (one `next dev` / `next start` Node process), and
 * it is honest about its limit: on a multi-instance or serverless deploy
 * each instance keeps its own counters, so the effective ceiling is
 * limit × instances. Moving to a shared counter (a Supabase table with an
 * atomic increment RPC, or Upstash) is the upgrade path when this app
 * gets deployed that way — see TODOS.md.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller's oldest hit falls out of the window. 0 when allowed. */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Hits allowed per key per window. */
  limit: number;
  windowMs: number;
  /**
   * Ceiling on tracked keys, so a flood of distinct IPs can't grow the
   * map without bound. Once past it, keys whose window has fully expired
   * are dropped; if that isn't enough the map is cleared outright —
   * losing counters fails open, which is the right trade for a limiter
   * that must never become the thing that takes the server down.
   */
  maxKeys?: number;
}

export interface RateLimiter {
  /** `now` is injectable so the behaviour is testable without fake timers. */
  check(key: string, now?: number): RateLimitResult;
}

const DEFAULT_MAX_KEYS = 5000;

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
}: RateLimiterOptions): RateLimiter {
  // key -> ascending timestamps of the hits still inside the window.
  const hits = new Map<string, number[]>();

  function sweep(now: number) {
    for (const [key, times] of hits) {
      if (times.length === 0 || times[times.length - 1]! <= now - windowMs) {
        hits.delete(key);
      }
    }
    if (hits.size > maxKeys) hits.clear();
  }

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      if (hits.size >= maxKeys) sweep(now);

      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        // Don't record the rejected hit: a caller who keeps knocking
        // would otherwise push their own window forward forever and stay
        // locked out well past the intended cooldown.
        hits.set(key, recent);
        const oldest = recent[0]!;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
        };
      }

      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/**
 * Best-effort caller identity for a limiter key. Behind a proxy the real
 * address is in `x-forwarded-for` (first entry is the client); locally
 * neither header is set, so everything shares one bucket — which throttles
 * rather than exempts, the safe direction to fail.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}
