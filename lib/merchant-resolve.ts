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
import { supabaseAdmin } from "./supabase";
import { normalizeDescriptor } from "./merchant-normalize";

// Pin the resolver version into the snapshot so replay can prove
// it's reading the same merchant identities the original scan used.
// Bump the version any time the system prompt OR the model id changes.
export const MERCHANT_RESOLVE_VERSION = "resolve-v1-haiku-4-5-20251001";

// Version tag for curated-catalog hits surfaced through the resolver.
// Distinct from MERCHANT_RESOLVE_VERSION so replay can tell apart "this
// came from Claude" from "this was a curated belt-and-braces override".
const MERCHANT_CATALOG_VERSION = "merchant_catalog_curated";

// Minimum Claude-reported confidence to promote a resolution into the
// durable, cross-user merchant_resolutions table. Below this we still
// use the verdict in-process (and in Redis) but never let it become
// the global answer everyone else inherits. 0.9 keeps half-baked
// guesses out of the shared pool.
const RESOLUTION_PROMOTE_THRESHOLD = 0.9;

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

// Canonical signature for a descriptor: lowercase + collapsed whitespace,
// SHA-1 hashed. This is the join key that ties together:
//   • Redis cache entries  (resolve:descriptor:v1:<sha1>)
//   • merchant_resolutions rows (descriptor_sha1 PK)
// Anything that touches identity for a descriptor MUST hash via this
// function so signatures line up across layers. Touching this is a
// migration event.
function descriptorSha1(descriptor: string): string {
  const norm = descriptor.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha1").update(norm).digest("hex");
}

// Redis key wraps the same sha1 so the cache and the database can be
// keyed off one identity hash.
function descriptorCacheKey(descriptor: string): string {
  return `resolve:descriptor:v1:${descriptorSha1(descriptor)}`;
}

// ---------------------------------------------------------------------
// Global merchant_resolutions helpers.
//
// The table is server-only (no RLS policies) and read/write goes
// through supabaseAdmin. All three functions degrade to no-op / empty
// when supabaseAdmin is missing so the resolver still works in local
// dev or when envs aren't wired.
// ---------------------------------------------------------------------

// Batch-read non-revoked resolutions by sha1. The migration's WHERE
// revoked_at IS NULL keeps revoked rows invisible to the read path
// in a single query.
async function readGlobalResolutions(
  sha1s: string[]
): Promise<Map<string, ResolvedIdentity>> {
  const out = new Map<string, ResolvedIdentity>();
  if (!supabaseAdmin || sha1s.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from("merchant_resolutions")
    .select(
      "descriptor_sha1, canonical_merchant_key, canonical_display_name, canonical_domain, confidence_score, resolver_version"
    )
    .in("descriptor_sha1", sha1s)
    .is("revoked_at", null);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{
    descriptor_sha1: string;
    canonical_merchant_key: string;
    canonical_display_name: string;
    canonical_domain: string | null;
    confidence_score: number;
    resolver_version: string;
  }>) {
    out.set(row.descriptor_sha1, {
      canonical_merchant_key: row.canonical_merchant_key,
      display_name: row.canonical_display_name,
      merchant_domain: row.canonical_domain,
      confidence: row.confidence_score,
      version: row.resolver_version,
    });
  }
  return out;
}

// Bump hit_count + last_hit_at for every sha1 that just served a read.
// Fire-and-forget at the call site; errors are logged but never thrown
// — usage tracking must never block resolution.
async function touchGlobalHits(sha1s: string[]): Promise<void> {
  if (!supabaseAdmin || sha1s.length === 0) return;
  const { error } = await supabaseAdmin.rpc("touch_merchant_resolution_hits", {
    p_descriptor_sha1s: sha1s,
  });
  if (error) throw error;
}

// Upsert a fresh Claude resolution into the global table. The PG
// function gates the UPDATE branch on "new confidence >= existing OR
// resolver_version differs" AND "row is not revoked", so a high-
// confidence row can never be silently overwritten by a lower one.
async function writeGlobalResolution(
  rawDescriptor: string,
  verdict: ResolvedIdentity,
  seedUserId: string | undefined
): Promise<void> {
  if (!supabaseAdmin) return;
  const sha = descriptorSha1(rawDescriptor);
  const { error } = await supabaseAdmin.rpc("upsert_merchant_resolution", {
    p_descriptor_sha1: sha,
    p_canonical_merchant_key: verdict.canonical_merchant_key,
    p_canonical_display_name: verdict.display_name,
    p_canonical_domain: verdict.merchant_domain,
    p_confidence_score: verdict.confidence,
    p_resolver_version: verdict.version,
    p_seed_raw_descriptor: rawDescriptor,
    p_seed_user_id: seedUserId ?? null,
  });
  if (error) throw error;
}

// Curated-catalog re-check. Belt-and-braces inside the resolver: even
// though scan.ts already pre-filters curated-hits upstream of this
// module, we run normalizeDescriptor again here so a curated entry
// beats a stale Redis row or a poisoned global row on the very next
// scan — no manual cache revoke required.
function curatedResolution(rawDescriptor: string): ResolvedIdentity | null {
  const n = normalizeDescriptor(rawDescriptor);
  if (!n.catalog_key || n.catalog_key.length === 0) return null;
  return {
    canonical_merchant_key: n.catalog_key,
    display_name: n.merchant_name || n.catalog_key,
    merchant_domain: n.domain,
    confidence: 0.95,
    version: MERCHANT_CATALOG_VERSION,
  };
}

// ---------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------

/**
 * Resolve a batch of descriptors to canonical identities.
 *
 * Returns a Map keyed by the ORIGINAL descriptor (case + spacing
 * preserved) so the caller can look up identity for any descriptor it
 * passed in. Descriptors that resolved successfully get a
 * ResolvedIdentity; descriptors that failed resolution are absent from
 * the map. The caller falls back to normalizeDescriptor for absent
 * entries.
 *
 * Read order (each layer skips the rest on hit):
 *   1. Redis per-instance cache (365d TTL)
 *   2. Curated merchant-catalog.json belt-and-braces re-check
 *      — runs against every Redis hit AND every cache miss so a
 *      curated entry can override a stale Redis row or a poisoned
 *      learned row on the very next scan, without manual revoke.
 *   3. merchant_resolutions global table (durable, cross-user)
 *   4. Claude live call (fallback)
 *
 * Write path on Claude success:
 *   • always: Redis (365d)
 *   • only when confidence >= RESOLUTION_PROMOTE_THRESHOLD: global
 *     table (so half-baked guesses never become the cross-user answer)
 *
 * seedUserId is the Clerk user id whose scan triggered the live
 * resolution. It's persisted on the global row for audit / revoke.
 */
export async function resolveDescriptors(
  descriptors: string[],
  seedUserId?: string
): Promise<Map<string, ResolvedIdentity>> {
  const out = new Map<string, ResolvedIdentity>();
  if (descriptors.length === 0) return out;

  // Dedupe by normalized descriptor first — multiple raw descriptors
  // that normalize identically share one LLM call AND one cache entry.
  const uniq = new Map<string, string>(); // normalized → first-seen-raw
  for (const d of descriptors) {
    if (!d) continue;
    const norm = d.trim().toLowerCase().replace(/\s+/g, " ");
    if (!uniq.has(norm)) uniq.set(norm, d);
  }

  // Echo a verdict to every original raw descriptor that normalizes to
  // the same form, so the caller's lookups work regardless of which
  // raw variant it passes back.
  const echoTo = (anchorRaw: string, verdict: ResolvedIdentity) => {
    const targetNorm = anchorRaw.trim().toLowerCase().replace(/\s+/g, " ");
    out.set(anchorRaw, verdict);
    for (const d of descriptors) {
      if (d && d.trim().toLowerCase().replace(/\s+/g, " ") === targetNorm) {
        out.set(d, verdict);
      }
    }
  };

  // Step 1: Redis cache pass — single mget for every distinct raw.
  // For each result we ALSO consult the curated catalog: a curated
  // entry overrides a stale Redis row in place.
  const remaining: string[] = []; // raw descriptors still to resolve
  const rawList = Array.from(uniq.values());
  if (redis) {
    const keys = rawList.map((r) => descriptorCacheKey(r));
    try {
      const cached =
        (await redis.mget<(ResolvedIdentity | null)[]>(...keys)) ?? [];
      for (let i = 0; i < rawList.length; i++) {
        const raw = rawList[i];
        const hit = cached[i];
        const curated = curatedResolution(raw);
        if (hit && hit.canonical_merchant_key) {
          // Belt-and-braces: prefer curated when it disagrees with the
          // cached row, otherwise keep the cached row.
          echoTo(
            raw,
            curated &&
              curated.canonical_merchant_key !== hit.canonical_merchant_key
              ? curated
              : hit
          );
        } else if (curated) {
          echoTo(raw, curated);
        } else {
          remaining.push(raw);
        }
      }
    } catch {
      // Cache failure: treat all as Redis-miss. Curated still wins
      // where applicable; everything else falls through to global +
      // Claude.
      for (const raw of rawList) {
        const curated = curatedResolution(raw);
        if (curated) echoTo(raw, curated);
        else remaining.push(raw);
      }
    }
  } else {
    for (const raw of rawList) {
      const curated = curatedResolution(raw);
      if (curated) echoTo(raw, curated);
      else remaining.push(raw);
    }
  }

  if (remaining.length === 0) return out;

  // Step 2: Global table pass for everything still unresolved. The
  // curated re-check is implicitly already done above (anything the
  // catalog knew about was resolved in step 1), so a global hit here
  // only wins if the catalog had nothing for the descriptor.
  let stillUnresolved: string[] = remaining;
  if (supabaseAdmin) {
    try {
      const sha1ByRaw = new Map<string, string>();
      for (const raw of remaining) sha1ByRaw.set(raw, descriptorSha1(raw));
      const uniqueSha1s = Array.from(new Set(sha1ByRaw.values()));
      const globalHits = await readGlobalResolutions(uniqueSha1s);
      const touchList: string[] = [];
      const nextRemaining: string[] = [];
      for (const raw of remaining) {
        const sha = sha1ByRaw.get(raw)!;
        const hit = globalHits.get(sha);
        if (hit) {
          echoTo(raw, hit);
          touchList.push(sha);
          // Write-through to Redis so subsequent same-process scans
          // skip the global lookup.
          if (redis) {
            try {
              await redis.set(descriptorCacheKey(raw), hit, {
                ex: 60 * 60 * 24 * 365,
              });
            } catch {
              // Non-fatal — next scan will re-hit the global table.
            }
          }
        } else {
          nextRemaining.push(raw);
        }
      }
      if (touchList.length > 0) {
        // Fire-and-forget hit counter. Never block resolution on it.
        touchGlobalHits(touchList).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn(
            `[resolve] touch_merchant_resolution_hits failed: ${
              e instanceof Error ? e.message : e
            }`
          );
        });
      }
      stillUnresolved = nextRemaining;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[resolve] global table read failed (${
          e instanceof Error ? e.message : e
        }); falling through to Claude`
      );
    }
  }

  if (stillUnresolved.length === 0 || !client) {
    // Either fully resolved by cache/catalog/global, or no LLM available.
    // Return what we have; caller falls back to normalizeDescriptor for
    // anything missing.
    return out;
  }

  // Step 3: LLM pass. Chunk by RESOLVE_BATCH_SIZE; failures on one
  // batch don't poison the rest.
  const totalBatches = Math.ceil(stillUnresolved.length / RESOLVE_BATCH_SIZE);
  for (let i = 0; i < stillUnresolved.length; i += RESOLVE_BATCH_SIZE) {
    const batch = stillUnresolved.slice(i, i + RESOLVE_BATCH_SIZE);
    const batchNum = Math.floor(i / RESOLVE_BATCH_SIZE) + 1;
    // eslint-disable-next-line no-console
    console.log(
      `[resolve] batch ${batchNum}/${totalBatches} (${batch.length} descriptors)`
    );
    let verdicts: Map<string, ResolvedIdentity>;
    try {
      verdicts = await resolveBatch(batch);
    } catch {
      // Batch failed after retry. Skip; caller falls back to
      // normalizeDescriptor for these descriptors. Scan must continue.
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`[resolve]   → ${verdicts.size} resolved`);
    for (const [raw, verdict] of verdicts) {
      echoTo(raw, verdict);
      // Redis cache write — TTL 365d.
      if (redis) {
        try {
          await redis.set(descriptorCacheKey(raw), verdict, {
            ex: 60 * 60 * 24 * 365,
          });
        } catch {
          // Non-fatal.
        }
      }
      // Global write-through. Only promote high-confidence verdicts
      // into the durable cross-user pool. Below the threshold we still
      // use the verdict in-process and in Redis, but the next user
      // gets a fresh Claude call rather than inheriting a guess.
      if (verdict.confidence >= RESOLUTION_PROMOTE_THRESHOLD) {
        try {
          await writeGlobalResolution(raw, verdict, seedUserId);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            `[resolve] upsert_merchant_resolution failed for "${raw}" (${
              e instanceof Error ? e.message : e
            })`
          );
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
