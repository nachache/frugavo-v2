import { describe, expect, it } from "vitest";
import {
  domainFor,
  logoUrl,
  monogram,
  monogramColor,
} from "@/lib/logos";

describe("domainFor", () => {
  it("looks up exact merchant names", () => {
    expect(domainFor("Netflix")).toBe("netflix.com");
    expect(domainFor("Spotify")).toBe("spotify.com");
  });

  it("is case-insensitive", () => {
    expect(domainFor("NETFLIX")).toBe(domainFor("netflix"));
    expect(domainFor("Adobe Creative Cloud")).toBe("adobe.com");
  });

  it("strips legal/marketing suffixes for fuzzy match", () => {
    expect(domainFor("Apple Music Premium")).toBe("apple.com");
    expect(domainFor("LinkedIn Premium")).toBe("linkedin.com");
  });

  it("returns null for unknown brands", () => {
    expect(domainFor("Definitely Not A Real Sub")).toBeNull();
  });
});

describe("logoUrl", () => {
  it("builds a Google favicon URL with size", () => {
    expect(logoUrl("netflix.com", 128)).toBe(
      "https://www.google.com/s2/favicons?domain=netflix.com&sz=128"
    );
  });

  it("defaults size to 128", () => {
    expect(logoUrl("spotify.com")).toContain("sz=128");
  });
});

describe("monogram", () => {
  it("uses two letters when there are two+ words", () => {
    expect(monogram("Madison Bicycle Shop")).toBe("MB");
    expect(monogram("The New York Times")).toBe("TN");
  });

  it("uses one letter for one-word merchants", () => {
    expect(monogram("Netflix")).toBe("N");
    expect(monogram("Spotify")).toBe("S");
  });

  it("returns '?' for empty input", () => {
    expect(monogram("")).toBe("?");
    expect(monogram("   ")).toBe("?");
  });
});

describe("monogramColor", () => {
  it("returns the category color when known", () => {
    expect(monogramColor("streaming")).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("falls back to the 'other' color for unknown / null", () => {
    expect(monogramColor(null)).toBe(monogramColor("other"));
    expect(monogramColor("not-real")).toBe(monogramColor("other"));
  });
});
