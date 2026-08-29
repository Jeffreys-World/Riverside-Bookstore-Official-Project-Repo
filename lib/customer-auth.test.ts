import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  decideMutationCustomerId,
  isExistingUserSignUp,
  validatePassedId,
} from "./customer-auth";

describe("validatePassedId", () => {
  it("accepts a well-formed cust_XXXXX", () => {
    expect(validatePassedId("cust_demo01")).toBe("cust_demo01");
    expect(validatePassedId("cust_ab12cd34")).toBe("cust_ab12cd34");
  });

  it("rejects a malformed id", () => {
    expect(validatePassedId("demo01")).toBeNull();
    expect(validatePassedId("cust_")).toBeNull();
    expect(validatePassedId("cust_ab")).toBeNull(); // fewer than 5 chars after the prefix
    expect(validatePassedId("ord_ab12cd34")).toBeNull();
  });

  it("rejects null / undefined / empty", () => {
    expect(validatePassedId(null)).toBeNull();
    expect(validatePassedId(undefined)).toBeNull();
    expect(validatePassedId("")).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("maps a known error code to friendly copy", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toMatch(/already registered/i);
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(/don't match/i);
    expect(authErrorMessage({ code: "weak_password" })).toMatch(/at least 8/i);
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(/too many/i);
  });

  it("falls back to message-substring matching when there's no code", () => {
    expect(authErrorMessage({ message: "User already registered" })).toMatch(/already registered/i);
    expect(authErrorMessage({ message: "Invalid login credentials" })).toMatch(/don't match/i);
  });

  it("returns a generic message for an unknown error", () => {
    expect(authErrorMessage({ code: "something_new", message: "kaboom" })).toBe(
      "Something went wrong. Please try again."
    );
    expect(authErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});

describe("decideMutationCustomerId", () => {
  it("uses the session's customer when the passed id agrees or is absent", () => {
    expect(decideMutationCustomerId("cust_ab12cd34", "cust_ab12cd34")).toEqual({
      ok: true,
      customerId: "cust_ab12cd34",
    });
    expect(decideMutationCustomerId("cust_ab12cd34", null)).toEqual({
      ok: true,
      customerId: "cust_ab12cd34",
    });
    expect(decideMutationCustomerId("cust_ab12cd34", "")).toEqual({
      ok: true,
      customerId: "cust_ab12cd34",
    });
  });

  it("refuses a passed id that disagrees with the session", () => {
    const decision = decideMutationCustomerId("cust_ab12cd34", "cust_demo01");
    expect(decision.ok).toBe(false);
    expect(decision.ok === false && decision.message).toMatch(/different account/i);
  });

  it("ignores a malformed passed id rather than treating it as a mismatch", () => {
    expect(decideMutationCustomerId("cust_ab12cd34", "not-an-id")).toEqual({
      ok: true,
      customerId: "cust_ab12cd34",
    });
  });

  it("falls back to the passed id when there is no session", () => {
    expect(decideMutationCustomerId(null, "cust_demo01")).toEqual({
      ok: true,
      customerId: "cust_demo01",
    });
  });

  it("refuses when there is neither a session nor a valid passed id", () => {
    const decision = decideMutationCustomerId(null, "demo01");
    expect(decision.ok).toBe(false);
    expect(decision.ok === false && decision.message).toMatch(/cust_XXXXX/);
  });
});

describe("isExistingUserSignUp", () => {
  it("flags the obfuscated duplicate (no session, empty identities)", () => {
    expect(isExistingUserSignUp({ user: { identities: [] }, session: null })).toBe(true);
  });

  it("flags a session-less user whose email is already confirmed", () => {
    expect(
      isExistingUserSignUp({ user: { email_confirmed_at: "2026-01-01T00:00:00Z" }, session: null })
    ).toBe(true);
  });

  it("passes a genuine new sign-up through", () => {
    expect(isExistingUserSignUp({ user: { identities: [{ id: "1" }] }, session: null })).toBe(false);
    expect(
      isExistingUserSignUp({ user: { identities: [], email_confirmed_at: null }, session: { access_token: "t" } })
    ).toBe(false);
  });

  it("is false for an empty / errored response", () => {
    expect(isExistingUserSignUp(null)).toBe(false);
    expect(isExistingUserSignUp({ user: null, session: null })).toBe(false);
  });
});
