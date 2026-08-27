import { describe, expect, it } from "vitest";
import { formatEventDate, formatEventTime, formatEventTimestamp } from "./schema";

// Regression: the support chatbot (get_upcoming_events, a 'use server'
// action) and the Events tab both formatted author_event_at with no fixed
// timeZone. On a UTC server the seeded Eastern events rendered 4–5h late
// with a date rollover; in a non-Eastern browser the Events tab and the
// chatbot disagreed. formatEvent* now pins America/New_York everywhere.
// Found by the 2026-08-27 full-app audit.
describe("formatEvent* — store-local timezone is pinned", () => {
  // James Clear "Atomic Habits" Q&A — seeded as 7:00 PM ET on 2026-12-12.
  const jamesClear = "2026-12-12T19:00:00-05:00";
  // Kazuo Ishiguro — seeded as 7:00 PM ET on 2026-09-12 (EDT, -04:00).
  const ishiguro = "2026-09-12T19:00:00-04:00";

  it("renders the stored Eastern wall-clock time regardless of runtime TZ", () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      expect(formatEventTimestamp(jamesClear)).toBe("December 12, 2026 at 7:00 PM");
      expect(formatEventTimestamp(ishiguro)).toBe("September 12, 2026 at 7:00 PM");

      process.env.TZ = "America/Los_Angeles";
      expect(formatEventTimestamp(jamesClear)).toBe("December 12, 2026 at 7:00 PM");
      expect(formatEventTimestamp(ishiguro)).toBe("September 12, 2026 at 7:00 PM");
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("never rolls the date forward on a UTC runtime", () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      expect(formatEventDate(jamesClear)).toBe("December 12, 2026");
      expect(formatEventTime(jamesClear)).toBe("7:00 PM");
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("keeps the timestamp, date, and time helpers mutually consistent", () => {
    const stamp = formatEventTimestamp(ishiguro);
    expect(stamp).toContain(formatEventDate(ishiguro));
    expect(stamp).toContain(formatEventTime(ishiguro));
  });
});
