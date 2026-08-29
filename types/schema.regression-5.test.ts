import { describe, expect, it } from "vitest";
import { REWARD_TIERS, pointsToGoLabel } from "./schema";

// Regression: ISSUE-002 — the account page's Reward Tiers panel rendered a bare
// " points to go" on every locked tier. The expression that produced the number
// had been deleted from the JSX, leaving the label with nothing in front of it,
// so a customer with 133 points saw "points to go" three times instead of
// "117 points to go" / "367 points to go" / "867 points to go".
// Found by /qa on 2026-08-29
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-08-29-pm.md

describe("pointsToGoLabel", () => {
  it("reports the gap to a tier the customer hasn't reached", () => {
    // The exact case seen in the browser: cust_demo01 at 133 points.
    expect(pointsToGoLabel(250, 133)).toBe("117 points to go");
    expect(pointsToGoLabel(500, 133)).toBe("367 points to go");
    expect(pointsToGoLabel(1000, 133)).toBe("867 points to go");
  });

  it("always names a number, never a bare label", () => {
    for (const tier of REWARD_TIERS) {
      expect(pointsToGoLabel(tier.points, 0)).toMatch(/^\d+ points? to go$/);
    }
  });

  it("uses the singular for exactly one point", () => {
    expect(pointsToGoLabel(100, 99)).toBe("1 point to go");
  });

  it("floors at zero rather than going negative once the tier is reached", () => {
    // The panel hides this label for unlocked tiers, but the helper must not
    // produce "-33 points to go" if that guard ever changes.
    expect(pointsToGoLabel(100, 133)).toBe("0 points to go");
    expect(pointsToGoLabel(100, 100)).toBe("0 points to go");
  });

  it("rounds a fractional balance up to whole points", () => {
    expect(pointsToGoLabel(250, 133.4)).toBe("117 points to go");
  });
});
