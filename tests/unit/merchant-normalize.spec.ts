import { describe, it, expect } from "vitest";
import { normalizeDescriptor } from "@/lib/merchant-normalize";

// Synthetic test strings. None of these come from real user data —
// they are constructed to exercise each documented normalization
// pattern. If the agent changes the engine, these tests stay fixed.

describe("normalizeDescriptor — processor prefix stripping", () => {
  it("strips SQ * (Square prefix)", () => {
    const r = normalizeDescriptor("SQ *NETFLIX.COM");
    expect(r.merchant_name).toBe("Netflix");
    expect(r.signals.stripped_prefix).not.toBeNull();
  });

  it("strips PAYPAL * prefix and exposes the wrapped merchant key", () => {
    const r = normalizeDescriptor("PAYPAL *SPOTIFY USA");
    // PayPal-wrapped merchants resolve to the inner merchant, not PayPal.
    expect(r.merchant_name).toBe("Spotify");
    expect(r.biller).toBe("paypal");
    expect(r.biller_passthrough).toBe(true);
  });

  it("strips TST* (Toast prefix)", () => {
    const r = normalizeDescriptor("TST*MAILERLITE.COM");
    expect(r.signals.stripped_prefix).not.toBeNull();
    // Falls back to domain heuristic since not in catalog.
    expect(r.domain).toBe("mailerlite.com");
  });

  it("handles a known merchant with no prefix", () => {
    const r = normalizeDescriptor("NETFLIX.COM");
    expect(r.merchant_name).toBe("Netflix");
    expect(r.catalog_key).toBe("netflix");
  });
});

describe("normalizeDescriptor — biller intermediaries", () => {
  it("resolves apple.com/bill as a biller passthrough", () => {
    const r = normalizeDescriptor("APPLE.COM/BILL");
    expect(r.biller).toBe("apple");
    expect(r.biller_passthrough).toBe(true);
  });

  it("resolves google * play subscription as a biller", () => {
    const r = normalizeDescriptor("GOOGLE *PLAY SUBSCRIPTION");
    expect(r.biller).toBe("google_play");
    expect(r.biller_passthrough).toBe(true);
  });
});

describe("normalizeDescriptor — trailing noise", () => {
  it("strips trailing account numbers", () => {
    const r = normalizeDescriptor("NETFLIX.COM 12345");
    expect(r.merchant_name).toBe("Netflix");
    expect(r.signals.stripped_trailing).not.toBeNull();
  });

  it("strips trailing store/location codes", () => {
    const r = normalizeDescriptor("NETFLIX.COM STORE 0042");
    expect(r.merchant_name).toBe("Netflix");
  });

  it("strips trailing US state code", () => {
    const r = normalizeDescriptor("NETFLIX.COM CA");
    expect(r.merchant_name).toBe("Netflix");
  });

  it("strips ID:/REF: tracking suffixes", () => {
    const r = normalizeDescriptor("NETFLIX.COM ID:ABC123");
    expect(r.merchant_name).toBe("Netflix");
  });
});

describe("normalizeDescriptor — bank fees", () => {
  it("routes overdraft fee to bank_fees category", () => {
    const r = normalizeDescriptor("OVERDRAFT FEE");
    expect(r.category).toBe("bank_fees");
    expect(r.signals.bank_fee_indicator).toBe("overdraft fee");
  });

  it("routes monthly maintenance fee to bank_fees", () => {
    const r = normalizeDescriptor("MONTHLY MAINTENANCE FEE - REGULAR ACCT");
    expect(r.category).toBe("bank_fees");
  });

  it("routes foreign transaction fee to bank_fees", () => {
    const r = normalizeDescriptor("FOREIGN TRANSACTION FEE");
    expect(r.category).toBe("bank_fees");
  });

  it("does NOT route ordinary Netflix charge to bank_fees", () => {
    const r = normalizeDescriptor("NETFLIX.COM");
    expect(r.category).not.toBe("bank_fees");
  });
});

describe("normalizeDescriptor — domain-style fallback", () => {
  it("extracts an unknown domain as the merchant", () => {
    const r = normalizeDescriptor("UNKNOWN-SVC.IO 9999");
    expect(r.domain).toBe("unknown-svc.io");
    expect(r.merchant_name).toBe("Unknown-Svc");
  });
});

describe("normalizeDescriptor — determinism", () => {
  it("returns identical output across repeated calls on the same input", () => {
    const inputs = [
      "SQ *NETFLIX.COM 12345",
      "PAYPAL *SPOTIFY USA",
      "APPLE.COM/BILL",
      "OVERDRAFT FEE",
      "UNKNOWN-SVC.IO ID:XYZ",
    ];
    for (const input of inputs) {
      const a = normalizeDescriptor(input);
      const b = normalizeDescriptor(input);
      expect(b).toEqual(a);
    }
  });
});
