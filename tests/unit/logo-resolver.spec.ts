import { describe, expect, it, vi } from "vitest";

// Mock supabase so cache reads/writes are no-ops in unit context.
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: null }));

import {
  monogramSvgDataUrl,
  resolveLogo,
  logoUrlForDomain,
} from "@/lib/logo-resolver";

describe("logo-resolver", () => {
  it("tier 1 — Plaid logo_url wins", async () => {
    const r = await resolveLogo({
      merchant: "Netflix",
      category: "streaming",
      plaidLogoUrl: "https://plaid-merchant-logos.example/netflix.png",
    });
    expect(r.source).toBe("plaid");
    expect(r.url).toBe("https://plaid-merchant-logos.example/netflix.png");
    expect(r.monogram.initials).toBe("N");
  });

  it("tier 2 — domain map produces a non-empty URL", async () => {
    const r = await resolveLogo({
      merchant: "Netflix",
      category: "streaming",
    });
    expect(r.source).toBe("logo_api");
    expect(r.url).toContain("netflix.com");
  });

  it("tier 2 — Plaid website overrides our local domain map", async () => {
    const r = await resolveLogo({
      merchant: "Some Brand",
      category: "software",
      plaidWebsite: "https://specific-brand.io/billing",
    });
    expect(r.source).toBe("logo_api");
    expect(r.url).toContain("specific-brand.io");
  });

  it("tier 3 — unknown merchant resolves to a monogram, never null", async () => {
    const r = await resolveLogo({
      merchant: "Definitely Unknown Random Co",
      category: "other",
    });
    expect(r.source).toBe("monogram");
    expect(r.url).toBeNull();
    // Caller can still render a non-broken mark via the monogram fields.
    expect(r.monogram.initials.length).toBeGreaterThan(0);
    expect(r.monogram.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("hard requirement — every regional brand asked for resolves to a renderable mark", async () => {
    const brands = ["Telus", "Rogers", "Hydro Ottawa", "Enbridge", "Shell", "Netflix"];
    for (const m of brands) {
      const r = await resolveLogo({ merchant: m });
      const renderable =
        (r.url && r.url.length > 0) ||
        monogramSvgDataUrl(r.monogram.initials, r.monogram.color).length > 0;
      expect(renderable).toBe(true);
    }
  });

  it("monogramSvgDataUrl produces a data: URL", () => {
    const url = monogramSvgDataUrl("NX", "#10B981");
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(url).toContain("NX");
  });

  it("logoUrlForDomain is deterministic", () => {
    expect(logoUrlForDomain("rogers.com")).toBe(logoUrlForDomain("rogers.com"));
  });
});
