import { describe, expect, it } from "vitest";
import { authErrorMessage, validatePassedId } from "./customer-auth";

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
