/**
 * lib/same-origin.ts
 *
 * The `/api/live/*` route handlers are the only server mutations in this
 * app that aren't Next.js Server Actions, and Server Actions are where
 * Next's built-in same-origin/CSRF enforcement lives. Without it these
 * routes answered any caller — `curl -X POST` with no cookies and
 * `Origin: https://evil.example.com` minted Gemini tokens against the
 * store's paid key and drove `create_preorder` through the service-role
 * client (found by /qa on 2026-08-29).
 *
 * This is the missing half of that check, not a full auth story: it
 * proves the request came from a page on our own origin, which is what
 * the voice kiosk actually is. Per-caller identity stays the documented
 * pre-auth model (knowing the cust_XXXXX is the credential), and rate
 * limiting is still open — see TODOS.md.
 */

/**
 * A browser sends `Origin` on every cross-origin request and on
 * same-origin POSTs, and `Sec-Fetch-Site: same-origin` on same-origin
 * fetches. A script that speaks HTTP directly (curl, a server-side
 * fetch) sends neither unless it forges them, and a forged `Origin` has
 * to name our own host to pass — which a cross-site page cannot do.
 * Requiring one of the two therefore keeps real first-party traffic and
 * turns away everything else.
 */
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      return Boolean(host) && new URL(origin).host === host;
    } catch {
      // Unparseable Origin — treat as hostile rather than guessing.
      return false;
    }
  }

  // No Origin at all: only trust the browser's own site signal. Anything
  // else (including a bare fetch with no fetch-metadata) is refused.
  return request.headers.get("sec-fetch-site") === "same-origin";
}
