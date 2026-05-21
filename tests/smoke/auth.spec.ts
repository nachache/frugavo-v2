import { describe, expect, it } from "vitest";
import { BASE_URL, smokeFetch } from "./_helpers";

// Auth + protected-route smoke. We don't sign in here — we just verify
// the gates work correctly: unauthenticated hits to /app should
// redirect or 401, the sign-in page should render.

describe(`smoke: auth gates (${BASE_URL})`, () => {
  it("sign-in page renders", async () => {
    const res = await smokeFetch("/sign-in");
    expect(res.status).toBe(200);
    const html = await res.text();
    // Clerk renders the sign-in widget — the page should at least load
    // text indicating a sign-in surface.
    expect(html.toLowerCase()).toMatch(/sign|continue|email/);
  });

  it("/app is not visible to unauthenticated users", async () => {
    const res = await smokeFetch("/app");
    // Clerk middleware can do one of three things for an anonymous
    // visitor: redirect to /sign-in (3xx), render a 200 with the Clerk
    // sign-in widget, or return a 404 / 401 to hide the route entirely.
    // All three are acceptable. What's NOT acceptable is the dashboard
    // rendering with subscription data exposed.
    expect([200, 301, 302, 307, 308, 401, 404]).toContain(res.status);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location") ?? "";
      expect(loc.toLowerCase()).toMatch(/sign[-_]?in|clerk/);
    } else if (res.status === 200) {
      const html = await res.text();
      // The dashboard's "Your subscriptions" headline must not appear
      // when no Clerk session is attached.
      expect(html).not.toContain("Your subscriptions");
    }
  });
});
