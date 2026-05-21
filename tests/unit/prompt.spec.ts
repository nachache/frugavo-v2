import { describe, expect, it } from "vitest";
import {
  descriptorKey,
  parseNormalizeResponse,
} from "@/lib/ai/prompt";

// The descriptor key is the cache-hit lever. Two real-world bank
// descriptors with different transaction ids or store numbers must
// collapse to the same key so we only pay for one LLM call across the
// entire user base.
describe("descriptorKey", () => {
  it("collapses transaction ids and phone numbers", () => {
    const a = descriptorKey("SP AFF*NETFLIX 866-579-7172 CA");
    const b = descriptorKey("SP AFF*NETFLIX 800-111-2222 NY");
    expect(a).toBe(b);
  });

  it("collapses case + punctuation noise", () => {
    expect(descriptorKey("Netflix.com  ")).toBe(
      descriptorKey("NETFLIX COM")
    );
  });

  it("preserves the brand stem when nothing else matches", () => {
    expect(descriptorKey("STRAVA INC SAN FRANCIS")).toContain("STRAVA");
  });

  it("handles empty input safely", () => {
    expect(descriptorKey("")).toBe("");
  });
});

describe("parseNormalizeResponse", () => {
  it("parses well-formed JSON", () => {
    const r = parseNormalizeResponse(
      '{"merchant_name":"Netflix","category":"streaming"}'
    );
    expect(r).toEqual({ merchant_name: "Netflix", category: "streaming" });
  });

  it("strips markdown code fences around JSON", () => {
    const r = parseNormalizeResponse(
      '```json\n{"merchant_name":"Spotify","category":"streaming"}\n```'
    );
    expect(r?.merchant_name).toBe("Spotify");
  });

  it("returns null on garbage", () => {
    expect(parseNormalizeResponse("not json at all")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseNormalizeResponse('{"only_name":"foo"}')).toBeNull();
  });
});
