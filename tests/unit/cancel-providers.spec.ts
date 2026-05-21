import { describe, expect, it } from "vitest";
import { cancelMethodFor } from "@/lib/cancel-providers";

describe("cancelMethodFor", () => {
  it("returns a web deep link for streaming brands", () => {
    const m = cancelMethodFor("Netflix");
    expect(m?.type).toBe("web");
    if (m?.type === "web") {
      expect(m.url).toContain("netflix.com");
    }
  });

  it("returns an email template for telecoms that require it", () => {
    const m = cancelMethodFor("Verizon");
    expect(m?.type).toBe("email");
    if (m?.type === "email") {
      expect(m.recipient).toContain("@");
      expect(m.body.length).toBeGreaterThan(50);
    }
  });

  it("returns a phone number for AT&T", () => {
    const m = cancelMethodFor("AT&T");
    expect(m?.type).toBe("phone");
  });

  it("is case-insensitive", () => {
    expect(cancelMethodFor("netflix")).toEqual(cancelMethodFor("Netflix"));
  });

  it("returns null for unknown brands so the UI shows the generic flow", () => {
    expect(cancelMethodFor("Definitely Not A Real Provider")).toBeNull();
  });
});
