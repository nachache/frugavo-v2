import { describe, expect, it } from "vitest";
import { BASE_URL, smokeFetch } from "./_helpers";

// Smoke tests for the public marketing surface. These hit the LIVE
// deployed site (FRUGAVO_URL env var, defaults to frugavo.com). Run
// after every deploy with:
//
//   npm run test:smoke
//
// What they catch: broken deploys, missing routes, accidentally removed
// hero copy, dead /learn pages.

describe(`smoke: landing (${BASE_URL})`, () => {
  it("homepage returns 200 and contains the perception-gap hook", async () => {
    const res = await smokeFetch("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("$219");
    expect(html).toContain("$86");
    // The trust-line copy survives compression / minification:
    expect(html.toLowerCase()).toContain("plaid");
  });

  it("library index loads", async () => {
    const res = await smokeFetch("/learn");
    expect([200, 301, 302]).toContain(res.status);
  });

  it("privacy page exists (legal must be reachable)", async () => {
    const res = await smokeFetch("/privacy");
    expect(res.status).toBe(200);
  });

  it("about page exists", async () => {
    const res = await smokeFetch("/about");
    expect([200, 301]).toContain(res.status);
  });

  it("security headers are set", async () => {
    const res = await smokeFetch("/");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    // Permissions-Policy was loosened to allow Plaid Link's iframe needs.
    const pp = res.headers.get("permissions-policy") ?? "";
    expect(pp).toContain("camera=()");
    expect(pp).toContain("fullscreen=*");
  });
});
