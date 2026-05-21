import { describe, expect, it } from "vitest";
import { cancelMethodFor, hasAnyChannel } from "@/lib/cancel-providers";

// CancelMethod is now a record of optional channels (web/email/phone)
// — a single service can carry any combination of the three. Tests
// check the specific channel fields rather than a discriminated `type`.

describe("cancelMethodFor", () => {
  it("returns a web deep link for streaming brands", () => {
    const m = cancelMethodFor("Netflix");
    expect(m).not.toBeNull();
    expect(m?.web?.url).toContain("netflix.com");
  });

  it("returns an email template for services that need it", () => {
    const m = cancelMethodFor("Verizon");
    expect(m).not.toBeNull();
    expect(m?.email?.recipient).toContain("@");
    expect((m?.email?.body ?? "").length).toBeGreaterThan(50);
  });

  it("returns a phone number for AT&T", () => {
    const m = cancelMethodFor("AT&T");
    expect(m).not.toBeNull();
    expect(m?.phone?.number).toMatch(/[0-9]/);
  });

  it("services can carry multiple channels at once (Verizon: web + email + phone)", () => {
    const m = cancelMethodFor("Verizon");
    expect(m?.web).toBeDefined();
    expect(m?.email).toBeDefined();
    expect(m?.phone).toBeDefined();
  });

  it("is case-insensitive", () => {
    expect(cancelMethodFor("netflix")).toEqual(cancelMethodFor("Netflix"));
  });

  it("returns null for unknown brands so the UI shows the generic flow", () => {
    expect(cancelMethodFor("Definitely Not A Real Provider")).toBeNull();
  });

  it("hasAnyChannel reflects whether at least one channel exists", () => {
    expect(hasAnyChannel(cancelMethodFor("Netflix"))).toBe(true);
    expect(hasAnyChannel(null)).toBe(false);
    expect(hasAnyChannel({})).toBe(false);
  });
});
