import { describe, it, expect } from "vitest";
import { recurringStreamsFromRaw } from "@/lib/raw-data-ingest";
import { normalizeDescriptor } from "@/lib/merchant-normalize";

// Determinism contract: same stored input → byte-identical detection
// output. Two invocations of the pure pipeline must return deep-equal
// arrays. If this fails, something inside the recurrence + normalize
// path is reading the wall clock, iterating over an unordered set, or
// non-deterministically resolving ties.

describe("Determinism — recurringStreamsFromRaw", () => {
  it("returns deep-equal output across two runs on the same fixture", () => {
    const a = recurringStreamsFromRaw();
    const b = recurringStreamsFromRaw();
    expect(b).toEqual(a);
  });

  it("preserves stream order across runs", () => {
    const a = recurringStreamsFromRaw().map((s) => s.stream_id);
    const b = recurringStreamsFromRaw().map((s) => s.stream_id);
    expect(b).toEqual(a);
  });
});

describe("Determinism — normalizeDescriptor", () => {
  // Spot-check the catalog-driven path: same descriptor → same output.
  const cases = [
    "NETFLIX.COM",
    "SQ *NETFLIX.COM 12345",
    "PAYPAL *SPOTIFY USA",
    "APPLE.COM/BILL",
    "OVERDRAFT FEE",
    "UNKNOWN-SVC.IO ID:XYZ",
    "ADOBE SYSTEMS #4421",
    "MICROSOFT*365 SUBSCRIPTION",
  ];
  it.each(cases)("idempotent for %s", (desc) => {
    expect(normalizeDescriptor(desc)).toEqual(normalizeDescriptor(desc));
  });
});
