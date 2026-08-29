import { describe, expect, it } from "vitest";
import { callerKey, createRateLimiter } from "./rate-limit";

// Follow-up to ISSUE-001 (/qa, 2026-08-29): the same-origin guard stopped
// external callers reaching /api/live/*, but a first-party page could still
// loop — minting Gemini Live tokens against the store's paid key, or driving
// create_preorder. These pin the throttle that closes that.

describe("createRateLimiter", () => {
  it("allows up to the limit inside one window", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("a", 1000).allowed).toBe(true);
    expect(limiter.check("a", 1100).allowed).toBe(true);
    expect(limiter.check("a", 1200).allowed).toBe(true);
  });

  it("refuses the hit past the limit and says when to retry", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("a", 1000);
    limiter.check("a", 2000);

    const blocked = limiter.check("a", 3000);
    expect(blocked.allowed).toBe(false);
    // Oldest hit was at 1000, so the window frees up at 61000 — 58s away.
    expect(blocked.retryAfterSeconds).toBe(58);
  });

  it("never reports a retry of 0 seconds while blocked", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("a", 1000);
    const blocked = limiter.check("a", 60_999);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("lets the caller back in once the window slides past", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    limiter.check("a", 1000);
    limiter.check("a", 2000);
    expect(limiter.check("a", 3000).allowed).toBe(false);
    // 61001 is past the first hit's window; one slot frees up.
    expect(limiter.check("a", 61_001).allowed).toBe(true);
    expect(limiter.check("a", 61_002).allowed).toBe(false);
  });

  it("does not let repeated knocking extend the caller's own lockout", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 });
    expect(limiter.check("a", 1000).allowed).toBe(true);
    // Hammer through the window — rejected hits must not be recorded.
    for (let t = 2000; t < 11_000; t += 1000) {
      expect(limiter.check("a", t).allowed).toBe(false);
    }
    expect(limiter.check("a", 11_001).allowed).toBe(true);
  });

  it("keeps callers in separate buckets", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a", 1000).allowed).toBe(true);
    expect(limiter.check("b", 1000).allowed).toBe(true);
    expect(limiter.check("a", 1001).allowed).toBe(false);
  });

  it("sheds stale keys instead of growing without bound", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000, maxKeys: 10 });
    for (let i = 0; i < 50; i++) limiter.check(`ip-${i}`, 1000);
    // Well past every window: new callers are still served, and the old
    // keys are gone rather than accumulating.
    expect(limiter.check("fresh", 100_000).allowed).toBe(true);
    expect(limiter.check("ip-0", 100_000).allowed).toBe(true);
  });
});

describe("callerKey", () => {
  function req(headers: Record<string, string>): Request {
    return new Request("http://localhost:3000/api/live/token", { method: "POST", headers });
  }

  it("takes the client address from x-forwarded-for", () => {
    expect(callerKey(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
    expect(callerKey(req({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(callerKey(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("shares one bucket when no address header is present", () => {
    // Throttles rather than exempts — the safe direction to fail.
    expect(callerKey(req({}))).toBe("local");
  });
});
