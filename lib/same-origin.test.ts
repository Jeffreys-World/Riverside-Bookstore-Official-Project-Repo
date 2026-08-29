import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

// Regression: ISSUE-001 — /api/live/token and /api/live/execute-tool answered
// any caller. `curl -X POST` with no cookies (and with a forged evil Origin)
// minted Gemini Live tokens against the store's paid key and drove
// create_preorder through the service-role client.
// Found by /qa on 2026-08-29
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-08-29.md

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/live/token", { method: "POST", headers });
}

describe("isSameOriginRequest", () => {
  it("accepts a browser POST whose Origin matches the host", () => {
    expect(isSameOriginRequest(req({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(
      true
    );
    expect(
      isSameOriginRequest(req({ host: "riverside.example", origin: "https://riverside.example" }))
    ).toBe(true);
  });

  it("rejects a cross-origin POST", () => {
    expect(
      isSameOriginRequest(req({ host: "localhost:3000", origin: "https://evil.example.com" }))
    ).toBe(false);
  });

  it("rejects an Origin that only looks like ours", () => {
    expect(
      isSameOriginRequest(
        req({ host: "riverside.example", origin: "https://riverside.example.evil.com" })
      )
    ).toBe(false);
    // Same host, different port is a different origin.
    expect(
      isSameOriginRequest(req({ host: "localhost:3000", origin: "http://localhost:4000" }))
    ).toBe(false);
  });

  it("rejects a bare scripted POST that sends no Origin and no fetch metadata", () => {
    expect(isSameOriginRequest(req({ host: "localhost:3000" }))).toBe(false);
  });

  it("falls back to Sec-Fetch-Site when Origin is absent", () => {
    expect(
      isSameOriginRequest(req({ host: "localhost:3000", "sec-fetch-site": "same-origin" }))
    ).toBe(true);
    expect(
      isSameOriginRequest(req({ host: "localhost:3000", "sec-fetch-site": "cross-site" }))
    ).toBe(false);
    expect(isSameOriginRequest(req({ host: "localhost:3000", "sec-fetch-site": "none" }))).toBe(
      false
    );
  });

  it("rejects an unparseable Origin rather than guessing", () => {
    expect(isSameOriginRequest(req({ host: "localhost:3000", origin: "not a url" }))).toBe(false);
  });
});
