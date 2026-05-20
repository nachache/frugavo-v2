/**
 * AI normalize unit tests — Vitest.
 *
 * Run with: pnpm vitest run tests/ai-normalize.spec.ts
 *
 * These tests pin the fallback chain and the timeout contract that the
 * stream depends on. If they pass, the stream cannot stall on a slow or
 * failing LLM call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  // The harness flips behavior via globalThis.__haikuBehavior so each
  // test can stage a different scenario without re-mocking.
  class FakeAnthropic {
    messages = {
      create: vi.fn(async (_args: unknown, opts?: { signal?: AbortSignal }) => {
        const behavior = (globalThis as unknown as {
          __haikuBehavior?: "ok" | "timeout" | "garbage";
        }).__haikuBehavior ?? "ok";

        if (behavior === "timeout") {
          await new Promise((res, rej) => {
            const t = setTimeout(res, 5_000);
            opts?.signal?.addEventListener("abort", () => {
              clearTimeout(t);
              rej(new DOMException("Aborted", "AbortError"));
            });
          });
        }

        if (behavior === "garbage") {
          return {
            content: [{ type: "text", text: "not json at all" }],
            usage: { input_tokens: 10, output_tokens: 5 },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: '{"merchant_name":"Netflix","category":"streaming"}',
            },
          ],
          usage: { input_tokens: 12, output_tokens: 8 },
        };
      }),
    };
  }
  return { default: FakeAnthropic };
});

vi.mock("@/lib/cache", async () => {
  const cache = new Map<string, unknown>();
  return {
    cacheGet: async (k: string) => cache.get(k) ?? null,
    cacheSet: async (k: string, v: unknown) => void cache.set(k, v),
    cacheKey: {
      aiMerchant: (k: string) => `ai:merchant:v1:${k}`,
    },
  };
});

vi.mock("@/lib/cost-meter", () => ({ logAiCost: vi.fn() }));

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  (globalThis as unknown as Record<string, unknown>).__haikuBehavior = "ok";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("normalizeMerchant", () => {
  it("returns LLM result on the happy path and caches it", async () => {
    const { normalizeMerchant } = await import("@/lib/ai/normalize");
    const r1 = await normalizeMerchant({
      raw_descriptor: "SP AFF*NETFLIX 866-5",
      plaid_merchant_name: "Netflix",
      amount_cents: 1599,
      frequency: "monthly",
    });
    expect(r1.merchant_name).toBe("Netflix");
    expect(r1.ai_source).toBe("llm");
    expect(r1.cache_hit).toBe(false);

    const r2 = await normalizeMerchant({
      raw_descriptor: "SP AFF*NETFLIX 866-5",
      plaid_merchant_name: "Netflix",
      amount_cents: 1599,
      frequency: "monthly",
    });
    expect(r2.cache_hit).toBe(true);
  });

  it("falls back to Plaid merchant_name on timeout (800ms ceiling)", async () => {
    (globalThis as unknown as Record<string, unknown>).__haikuBehavior =
      "timeout";

    const { normalizeMerchant } = await import("@/lib/ai/normalize");
    const t0 = Date.now();
    const r = await normalizeMerchant({
      raw_descriptor: "MYSTERY SUBSCRIPTION INC",
      plaid_merchant_name: "Mystery Sub",
      amount_cents: 999,
      frequency: "monthly",
    });
    const elapsed = Date.now() - t0;

    expect(r.ai_source).toBe("plaid");
    expect(r.merchant_name).toBe("Mystery Sub");
    expect(elapsed).toBeLessThan(1_000);
  });

  it("falls all the way to raw descriptor when Plaid name is missing", async () => {
    (globalThis as unknown as Record<string, unknown>).__haikuBehavior =
      "timeout";

    const { normalizeMerchant } = await import("@/lib/ai/normalize");
    const r = await normalizeMerchant({
      raw_descriptor: "SQ *WEIRD MERCH",
      plaid_merchant_name: null,
      amount_cents: 1299,
      frequency: "monthly",
    });
    expect(r.ai_source).toBe("raw");
    expect(r.merchant_name).toBe("SQ *WEIRD MERCH");
  });

  it("falls back when the LLM returns non-JSON garbage", async () => {
    (globalThis as unknown as Record<string, unknown>).__haikuBehavior =
      "garbage";

    const { normalizeMerchant } = await import("@/lib/ai/normalize");
    const r = await normalizeMerchant({
      raw_descriptor: "UTIL PAYMENT",
      plaid_merchant_name: "Utility Co",
      amount_cents: 4500,
      frequency: "monthly",
    });
    expect(r.ai_source).toBe("plaid");
    expect(r.merchant_name).toBe("Utility Co");
  });
});
