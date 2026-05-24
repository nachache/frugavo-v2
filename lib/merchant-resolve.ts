// Canonical merchant identity resolution.
//
// THE RECALL FIX.
// ───────────────
// The detector groups transactions by merchant_key before computing
// cadence + applying the band minimum. If one merchant lands on the
// ledger under multiple descriptor variants (APPLE.COM/BILL, APPLE
// 800-275, Apple Services), each variant becomes its own merchant_key
// and each has fewer charges than the band minimum. The stream
// never detects. That's the primary recall driver.
//
// This module fixes it by inserting a resolution step between the
// Plaid sync and the recurrence detector: a batch Claude call that
// collapses descriptor variants into one canonical_merchant_key.
//
// DETERMINISM CONTRACT
// ────────────────────
// Resolution is a pure function of the raw descriptor. Same descriptor
// → same canonical key. We cache aggressively so the second scan of
// the same ledger makes zero LLM calls:
//
//   Cache key: `resolve:descriptor:v1:<sha1(normalized_descriptor)>`
//   Cache value: { canonical_merchant_key, display_name, merchant_domain,
//                  confidence, version }
//   Persistence: written to plaid_transactions.canonical_merchant_key
//                so the canonical ledger is self-describing for replay.
//
// On Claude error/timeout: fall back to the existing normalizeDescriptor
// key for that descriptor only, never block the scan. The unresolved
// descriptor retries on the next scan when the system recovers.
//
// TRUST ASYMMETRY PRESERVED
// ─────────────────────────
// Identity resolution is upstream of classification. Even if Claude
// resolves Apple iCloud as "apple" with confidence 0.95, the downstream
// classifier still has to decide is_subscription=true with confidence
// >= the trust threshold before it's promoted to `confirmed`.

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { redis } from "./cache";

// Pin the resolver version into the snapshot so replay can prove
// it's reading the same merchant identities the original scan used.
// Bump the version any time the system prompt OR the model id changes.
export const MERCHANT_RESOLVE_VERSION = "resolve-v1-haiku-4-5-20251001";

const RESOLVE_MODEL = "claude-haiku-4-5-20251001";
// Per-batch timeout. 60s headroom for Haiku's structured-JSON
// response over 12 descriptors. Generous so transient slowness
// doesn't kill the batch; the retry handles real timeouts.
const RESOLVE_TIMEOUT_MS = 60_000;
// 12 items per batch is the durable size — small enough that one
// timeout doesn't lose much work, large enough to amortize
// per-call overhead. max_tokens stays at 4096 which is plenty.
const RESOLVE_BATCH_SIZE = 12;
const RESOLVE_MAX_TOKENS = 4096;
// One retry on abort/timeout. Two consecutive failures = the batch
// falls back to normalizeDescriptor for those descriptors.
const RESOLVE_RETRY_BACKOFF_MS = 500;

export type ResolvedIdentity = {
  canonical_merchant_key: string;
  display_name: string;
  merchant_domain: string | null;
  confidence: number;
  version: string;
};

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Stable lowercase, [a-z0-9_] only. Used to project canonical keys
// returned by Claude into a safe shape we can use as a database key.
function safeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

// Deterministic cache key from the normalized descriptor. Sha1 keeps
// the Redis key small + opaque. We intentionally lowercase + strip
// extra whitespace before hashing so "APPLE.COM/BILL " and "apple.com/bill"
// share a cache entry — that's the whole point of identity resolution.
function descriptorCacheKey(descriptor: string): string {
  const norm = descriptor.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha1").update(norm).digest("hex");
  return `resolve:descriptor:v1:${hash}`;
}

// ---------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------

/**
 * Resolve a batch of descriptors to canonical identities.
 *
 * Returns a Map keyed by the ORIGINAL descriptor (case + spacing
 * preserved) so the caller can look up identity for any descriptor it
 * passed in. Descriptors that resolved successfully (from cache or
 * fresh LLM call) get a ResolvedIdentity; descriptors that failed
 * resolution are absent from the map. The caller falls back to
 * normalizeDescriptor for absent entries.
 */
export async function resolveDescriptors(
  descriptors: string[]
): Promise<Map<string, ResolvedIdentity>> {
  const out = new Map<string, ResolvedIdentity>();
  if (descriptors.length === 0) return out;

  // Dedupe by normalized descriptor first — multiple raw descriptors
  // that normalize identically should share one LLM call AND share
  // one cache entry.
  const uniq = new Map<string, string>(); // normalized → first-seen-raw
  for (const d of descriptors) {
    if (!d) continue;
    const norm = d.trim().toLowerCase().replace(/\s+/g, " ");
    if (!uniq.has(norm)) uniq.set(norm, d);
  }

  // 1) Cache pass — hit Redis for every distinct normalized descriptor.
  const uncached: string[] = []; // raw descriptors to resolve fresh
  if (redis) {
    const keys = Array.from(uniq.keys()).map((n) => `resolve:descriptor:v1:${createHash("sha1").update(n).digest("hex")}`);
    try {
      const cached = (await redis.mget<(ResolvedIdentity | null)[]>(...keys)) ?? [];
      let i = 0;
      for (const norm of uniq.keys()) {
        const raw = uniq.get(norm)!;
        const hit = cached[i++];
        if (hit && hit.canonical_merchant_key) {
          out.set(raw, hit);
          // Echo to every raw descriptor that normalizes to this one.
          for (const d of descriptors) {
            if (d && d.trim().toLowerCase().replace(/\s+/g, " ") === norm) {
              out.set(d, hit);
            }
          }
        } else {
          uncached.push(raw);
        }
      }
    } catch {
      // Cache failure shouldn't break resolution; treat as full miss.
      uncached.push(...uniq.values());
    }
  } else {
    uncached.push(...uniq.values());
  }

  if (uncached.length === 0 || !client) {
    // Either fully cached, or no LLM available. Either way we return
    // what we have; the caller falls back to normalizeDescriptor for
    // anything missing.
    return out;
  }

  // 2) LLM pass — batch uncached descriptors. We chunk by RESOLVE_BATCH_SIZE
  // and run sequentially (Claude rate limits + a single timeout per
  // batch is enough). Failures on one batch don't poison the rest.
  const totalBatches = Math.ceil(uncached.length / RESOLVE_BATCH_SIZE);
  for (let i = 0; i < uncached.length; i += RESOLVE_BATCH_SIZE) {
    const batch = uncached.slice(i, i + RESOLVE_BATCH_SIZE);
    const batchNum = Math.floor(i / RESOLVE_BATCH_SIZE) + 1;
    // eslint-disable-next-line no-console
    console.log(`[resolve] batch ${batchNum}/${totalBatches} (${batch.length} descriptors)`);
    let verdicts: Map<string, ResolvedIdentity>;
    try {
      verdicts = await resolveBatch(batch);
    } catch {
      // Batch failed after retry. Skip this batch entirely; the caller
      // will fall back to normalizeDescriptor for these descriptors.
      // We do NOT throw — the scan must continue.
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`[resolve]   → ${verdicts.size} resolved`);
    for (const [raw, verdict] of verdicts) {
      out.set(raw, verdict);
      // Echo to all raw descriptors that share the normalized form.
      const norm = raw.trim().toLowerCase().replace(/\s+/g, " ");
      for (const d of descriptors) {
        if (d && d.trim().toLowerCase().replace(/\s+/g, " ") === norm) {
          out.set(d, verdict);
        }
      }
      // Cache write — TTL of 365d to keep Redis from filling up but
      // long enough that a single user re-scanning monthly always hits.
      if (redis) {
        try {
          await redis.set(descriptorCacheKey(raw), verdict, {
            ex: 60 * 60 * 24 * 365,
          });
        } catch {
          // Non-fatal: cache write failure means the next scan will
          // re-resolve. Idempotent.
        }
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------
// Internal: one LLM batch call.
// ---------------------------------------------------------------------

const RESOLVE_SYSTEM_PROMPT = `You normalize raw bank transaction descriptors into canonical merchant identities.

Each descriptor is one bank statement line: noisy, with billing suffixes, processor prefixes, store numbers, phone numbers, city codes.

For EVERY descriptor in the input array, return STRICT JSON in this exact shape:

{
  "results": [
    {
      "descriptor": "<the exact input descriptor string>",
      "canonical_merchant_key": "<lowercase_underscored_merchant_key>",
      "display_name": "<human readable name>",
      "merchant_domain": "<primary domain, or null>",
      "confidence": <0.0 to 1.0>
    }
  ]
}

WHAT TO STRIP
- billing suffixes ('.COM/BILL', '/BILL', 'INC', 'LLC')
- store numbers ('#4421', 'STORE 12', '4421')
- phone numbers (any 3-3-4 digit pattern or 800-prefix)
- city / state codes at the end
- payment processor prefixes ('PADDLE.NET*', 'STRIPE*', 'SQ *', 'PAYPAL *')
- random transaction identifiers (long alphanumeric blobs)

WHAT TO KEEP
- the underlying merchant brand, lowercased and underscore-joined

PROCESSOR PASS-THROUGH
- If a processor prefix hides a merchant (e.g. 'PADDLE.NET* WIDGETCORP'), extract the merchant name AFTER the processor token. The processor is not the merchant.
- If you cannot extract a merchant from a processor descriptor, use the processor itself as the key (e.g. "paddle", "stripe") with confidence <= 0.5.

DISTINCT PRODUCT VARIANTS
- When a merchant sells multiple distinct products under similar descriptors, treat the product as the identity (e.g. a marketplace charge is distinct from a separate prime/membership product the same brand sells — give them different canonical keys).

OUTPUT RULES
- canonical_merchant_key: lowercase, underscores only, no spaces / dashes / special chars / accents. Max 64 chars.
- display_name: the human-readable form, properly capitalized.
- merchant_domain: the canonical website if obvious, null otherwise.
- confidence: honest estimate. High (>=0.85) clearly identified. Mid (0.5-0.85) identifiable but with some ambiguity. Low (<0.5) too generic, looks like internal bank movement, or looks like noise.

OUTPUT ONLY THE JSON. NO PROSE, NO MARKDOWN FENCES, NO EXPLANATIONS.`;

// One LLM call. Throws on failure so the outer wrapper can retry.
async function callResolveBatchOnce(
  descriptors: string[]
): Promise<Map<string, ResolvedIdentity>> {
  const out = new Map<string, ResolvedIdentity>();
  if (!client || descriptors.length === 0) return out;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("resolve_timeout"), RESOLVE_TIMEOUT_MS);
  try {
    const user = JSON.stringify({ descriptors });
    const res = await client.messages.create(
      {
        model: RESOLVE_MODEL,
        max_tokens: RESOLVE_MAX_TOKENS,
        temperature: 0,
        system: RESOLVE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: user }],
      },
      { signal: ctrl.signal }
    );
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(text) as {
      results: Array<{
        descriptor: string;
        canonical_merchant_key: string;
        display_name?: string;
        merchant_domain?: string | null;
        confidence?: number;
      }>;
    };
    if (!parsed || !Array.isArray(parsed.results)) {
      throw new Error("invalid_resolver_response");
    }
    for (const r of parsed.results) {
      if (
        typeof r.descriptor !== "string" ||
        typeof r.canonical_merchant_key !== "string" ||
        r.canonical_merchant_key.length === 0
      ) {
        continue;
      }
      const key = safeKey(r.canonical_merchant_key);
      if (!key) continue;
      out.set(r.descriptor, {
        canonical_merchant_key: key,
        display_name:
          typeof r.display_name === "string" && r.display_name.length > 0
            ? r.display_name
            : key,
        merchant_domain:
          typeof r.merchant_domain === "string" && r.merchant_domain.length > 0
            ? r.merchant_domain.toLowerCase()
            : null,
        confidence:
          typeof r.confidence === "number" && Number.isFinite(r.confidence)
            ? Math.max(0, Math.min(1, r.confidence))
            : 0.5,
        version: MERCHANT_RESOLVE_VERSION,
      });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// Public wrapper. Tries once, retries once on failure with a short
// backoff. If both attempts fail, throws — the caller falls back per
// descriptor in resolveDescriptors. Guarantees the resolver never
// silently swallows errors.
async function resolveBatch(
  descriptors: string[]
): Promise<Map<string, ResolvedIdentity>> {
  if (descriptors.length === 0) return new Map();
  try {
    return await callResolveBatchOnce(descriptors);
  } catch (e1) {
    // eslint-disable-next-line no-console
    console.warn(
      `[resolve] batch attempt 1/2 failed (${e1 instanceof Error ? e1.message : e1}), retrying after ${RESOLVE_RETRY_BACKOFF_MS}ms`
    );
    await new Promise((r) => setTimeout(r, RESOLVE_RETRY_BACKOFF_MS));
    try {
      return await callResolveBatchOnce(descriptors);
    } catch (e2) {
      // eslint-disable-next-line no-console
      console.warn(
        `[resolve] batch attempt 2/2 failed (${e2 instanceof Error ? e2.message : e2}); descriptors fall back to normalizeDescriptor:`
      );
      for (const d of descriptors) {
        // eslint-disable-next-line no-console
        console.warn(`[resolve]   fallback → "${d}"`);
      }
      // Re-throw so caller can apply the deterministic fallback path.
      throw e2;
    }
  }
}

// ---------------------------------------------------------------------
// Test hook — lets the verifier seed the Redis cache without going
// through Claude (used by the determinism + replay acceptance tests).
// ---------------------------------------------------------------------

export async function _seedCacheForTest(
  descriptor: string,
  identity: ResolvedIdentity
): Promise<void> {
  if (!redis) return;
  await redis.set(descriptorCacheKey(descriptor), identity, {
    ex: 60 * 60 * 24 * 365,
  });
}
