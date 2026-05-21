import Anthropic from "@anthropic-ai/sdk";
import { cacheGet, cacheSet, cacheKey } from "@/lib/cache";
import { logAiCost } from "@/lib/cost-meter";
import { SCAN_BUDGET_MS, type AiSource } from "@/lib/types/scan";
import {
  NORMALIZE_SYSTEM,
  normalizeUser,
  descriptorKey,
  parseNormalizeResponse,
} from "./prompt";

// Null-safe Anthropic client. Same pattern as plaidClient / supabaseAdmin:
// missing key disables the LLM path, fallback chain still works.
const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

if (!anthropic) {
  // eslint-disable-next-line no-console
  console.warn(
    "[ai] ANTHROPIC_API_KEY missing — merchant normalization disabled, fallback chain only"
  );
}

const MODEL = "claude-haiku-4-5-20251001";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type NormalizeInput = {
  raw_descriptor: string;
  plaid_merchant_name?: string | null;
  amount_cents: number;
  frequency: string;
};

export type NormalizeResult = {
  merchant_name: string;
  category: string | null;
  ai_source: AiSource;
  cache_hit: boolean;
};

type CachedShape = { merchant_name: string; category: string };

function fallback(
  input: NormalizeInput,
  reason: "no_client" | "timeout" | "parse" | "error"
): NormalizeResult {
  // The fallback chain from the spec: LLM → Plaid → raw → "Unknown".
  // We never throw — the scan stream must keep flowing.
  if (input.plaid_merchant_name) {
    return {
      merchant_name: input.plaid_merchant_name,
      category: null,
      ai_source: "plaid",
      cache_hit: false,
    };
  }
  if (input.raw_descriptor) {
    return {
      merchant_name: input.raw_descriptor,
      category: null,
      ai_source: "raw",
      cache_hit: false,
    };
  }
  // Suppress unused-variable lint while leaving the reason argument for
  // future structured logging.
  void reason;
  return {
    merchant_name: "Unknown merchant",
    category: null,
    ai_source: "unknown",
    cache_hit: false,
  };
}

export async function normalizeMerchant(
  input: NormalizeInput,
  opts: { userId?: string; scanRunId?: string } = {}
): Promise<NormalizeResult> {
  if (!anthropic) return fallback(input, "no_client");

  const key = cacheKey.aiMerchant(descriptorKey(input.raw_descriptor));
  const cached = await cacheGet<CachedShape>(key);
  if (cached) {
    return {
      merchant_name: cached.merchant_name,
      category: cached.category,
      ai_source: "llm",
      cache_hit: true,
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort("ai_timeout"),
    SCAN_BUDGET_MS.aiTimeoutPerRow
  );
  const start = Date.now();

  try {
    // The Anthropic SDK accepts a Node AbortSignal under the
    // request-options second argument. When it fires we get a synchronous
    // throw that we map onto the fallback chain.
    const res = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 120,
        // Pinned for determinism. Same descriptor → same merchant_name
        // and category. Without this the cache-miss path is a coin flip
        // across runs.
        temperature: 0,
        system: NORMALIZE_SYSTEM,
        messages: [{ role: "user", content: normalizeUser(input) }],
      },
      { signal: ctrl.signal }
    );

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = parseNormalizeResponse(text);
    if (!parsed) return fallback(input, "parse");

    await cacheSet<CachedShape>(key, parsed, CACHE_TTL_SECONDS);
    await logAiCost({
      userId: opts.userId,
      scanRunId: opts.scanRunId,
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      latency_ms: Date.now() - start,
      cache_hit: false,
    });

    return {
      merchant_name: parsed.merchant_name,
      category: parsed.category,
      ai_source: "llm",
      cache_hit: false,
    };
  } catch (e) {
    const aborted =
      (e as { name?: string })?.name === "AbortError" ||
      String(e).includes("ai_timeout");
    return fallback(input, aborted ? "timeout" : "error");
  } finally {
    clearTimeout(timer);
  }
}
