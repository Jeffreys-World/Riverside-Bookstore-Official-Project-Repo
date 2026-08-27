import { describe, expect, it } from "vitest";
import { customerCredentialsSchema } from "./schema";

// Guards the sign-up / sign-in input gate added with real customer auth
// (0034_customer_auth.sql). Supabase Auth re-validates server-side, but
// this is the fast, friendly first check every Product A auth action runs.
describe("customerCredentialsSchema", () => {
  it("accepts a valid email + 8-char password", () => {
    const r = customerCredentialsSchema.safeParse({ email: "reader@example.com", password: "abcd1234" });
    expect(r.success).toBe(true);
  });

  it("trims the email", () => {
    const r = customerCredentialsSchema.safeParse({ email: "  reader@example.com  ", password: "abcd1234" });
    expect(r.success && r.data.email).toBe("reader@example.com");
  });

  it("rejects a malformed email with a field-level message", () => {
    const r = customerCredentialsSchema.safeParse({ email: "not-an-email", password: "abcd1234" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/valid email/i);
  });

  it("rejects a password shorter than 8 characters", () => {
    const r = customerCredentialsSchema.safeParse({ email: "reader@example.com", password: "short" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/at least 8/i);
  });
});
