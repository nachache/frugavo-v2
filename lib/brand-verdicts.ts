import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "./supabase";
import { redis } from "./cache";

// =========================================================================
// Brand Verdicts — Identity-first detection oracle.
//
// One global record per canonical merchant_key. Cached forever in
// `brand_verdicts` (Postgres) + Redis warm layer. Source of truth for
// "is this a subscription brand at all?" — the cadence math layer
// reads this to decide whether to confirm, doubt, or skip.
//
// Three likelihood values:
//
//   always     pure-subscription brand. Any occurrence with stable
//              cadence is a subscription (Netflix, Spotify, Anthropic).
//
//   sometimes  mixed brand. Per-user resolution depends on cadence +
//              amount + history. Apple sells iCloud (sub) and movie
//              rentals (one-off). Amazon sells Prime (sub) and goods
//              (one-off). PayPal-passthrough wraps anything.
//
//   never      pure one-off retailer. Never surface as a subscription
//              regardless of cadence (Starbucks, Uber, gas stations).
//
// Cache key:
//   merchant_key alone — verdict is a property of the brand, not of
//   any user's history. Same descriptor anywhere on the platform gets
//   the same answer. Replayable forever.
//
// Determinism contract:
//   - Claude called with temp=0, pinned model, JSON schema output.
//   - Cache key includes (prompt_version, model_version). Bumping
//     either opens a new namespace; old rows stay valid for replay.
//   - Claude sees ONLY the descriptor string — not amounts, dates,
//     transaction lists. Verdict depends only on what the descriptor
//     says it is.
// =========================================================================

const MODEL = "claude-haiku-4-5-20251001";
const PROMPT_VERSION = 1;
const REDIS_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d warm; DB is durable
const CLAUDE_TIMEOUT_MS = 4_000;

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

if (!anthropic) {
  // eslint-disable-next-line no-console
  console.warn(
    "[brand-verdicts] ANTHROPIC_API_KEY missing — Claude path disabled. Cache + catalog only."
  );
}

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

export type SubscriptionLikelihood = "always" | "sometimes" | "never";

export type BrandVerdict = {
  // CANONICAL merchant key — Claude's output, the durable identity.
  // This is what subscriptions should be keyed/grouped on long term,
  // NOT the engine normalizer's noisy source_key.
  merchant_key: string;
  display_name: string;
  category: string;
  subscription_likelihood: SubscriptionLikelihood;
  domain: string | null;
  decided_by: "catalog" | "claude" | "manual_admin";
  decided_at: string;
  model_version: string | null;
  prompt_version: number | null;
  // Claude-only audit fields. NULL when decided_by isn't 'claude'.
  // reasoning is a short string for QA + prompt tuning;
  // confidence_score is Claude's self-reported certainty 0..1 that
  // downstream callers can weight against the engine cadence math.
  reasoning: string | null;
  confidence_score: number | null;
  // Engine normalizer keys that have mapped to this canonical. The
  // amount-tier fragmentation collapses here.
  source_keys: string[];
};

export type LookupArgs = {
  // ENGINE source key — what lib/merchant-normalize.ts produced. May
  // carry amount-tier noise (e.g. 'apple_t10'). The lookup resolves
  // this to a canonical merchant_key by either direct PK hit OR
  // GIN-indexed source_keys array contains.
  source_key: string;
  // Descriptor sample used as the Claude input on cache miss. The
  // verdict is keyed by canonical merchant_key (so the cache hits
  // across descriptor variants), but Claude needs to see at least
  // one representative descriptor to make the call.
  descriptor: string;
  // Optional Plaid PFC tag — helps Claude when the source_key is
  // ambiguous (e.g. a generic biller wrapper).
  pfc_primary?: string | null;
};

// ──────────────────────────────────────────────────────────────────────
// Cache key helpers
// ──────────────────────────────────────────────────────────────────────

function redisKey(lookupKey: string): string {
  // Redis is keyed on whatever key the CALLER passed (typically the
  // engine source_key, sometimes the canonical). Both work — same
  // verdict value gets cached under whichever lookup string asked
  // for it. The DB is the source of truth; Redis is just a warm
  // shortcut.
  //
  // Namespace by prompt+model versions so a future prompt change
  // opens a clean cache namespace without invalidating durable DB
  // rows.
  return `brand_verdict:v${PROMPT_VERSION}:${MODEL}:${lookupKey}`;
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

// Primary lookup. Takes an engine source_key and returns the canonical
// verdict. Four-tier read path:
//
//   1. Redis (warm cache, 30d TTL) — keyed on source_key directly so
//      repeat lookups skip the dual DB lookup.
//   2. brand_verdicts PK match — fast path when source_key IS the
//      canonical (e.g. 'netflix' came in clean, hit PK 'netflix').
//   3. brand_verdicts source_keys @> array contains — collapses the
//      amount-tier fragmentation case (e.g. 'apple_t10' came in,
//      we have a row 'apple_icloud' with source_keys including
//      'apple_t10').
//   4. Claude (cache miss). Claude returns a canonical merchant_key
//      which becomes the durable PK; the caller's source_key is
//      added to that row's source_keys array. Future lookups for
//      THIS source_key hit tier 3 instead of calling Claude again.
//
// If Claude is unavailable or fails, returns null. Callers must
// handle null — typically by falling back to engine-only cadence
// logic for this scan and re-trying on the next scan.
export async function getBrandVerdict(
  args: LookupArgs
): Promise<BrandVerdict | null> {
  const { source_key, descriptor, pfc_primary } = args;
  if (!source_key) return null;

  // Tier 1 — Redis (warm cache, keyed on the source_key the caller
  // passed; we store the canonical verdict against it).
  if (redis) {
    try {
      const cached = await redis.get<BrandVerdict>(redisKey(source_key));
      if (cached && isWellFormed(cached)) return cached;
    } catch {
      // fall through
    }
  }

  // Tier 2 + 3 — durable DB dual lookup. The PK path handles
  // already-canonical inputs ('netflix', 'spotify'); the source_keys
  // GIN path handles noisy normalizer outputs ('apple_t10'). We
  // issue both as one round-trip with OR for free.
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("brand_verdicts")
      .select(
        "merchant_key, display_name, category, subscription_likelihood, domain, decided_by, decided_at, model_version, prompt_version, reasoning, confidence_score, source_keys"
      )
      .or(`merchant_key.eq.${source_key},source_keys.cs.{${source_key}}`)
      .limit(1)
      .maybeSingle();
    if (data && isWellFormed(data as unknown as BrandVerdict)) {
      const verdict = data as unknown as BrandVerdict;
      // Warm Redis under the source_key the caller asked with, so
      // the next identical lookup hits tier 1.
      if (redis) {
        try {
          await redis.set(redisKey(source_key), verdict, {
            ex: REDIS_TTL_SECONDS,
          });
        } catch {
          // non-fatal
        }
      }
      return verdict;
    }
  }

  // Tier 4 — live Claude call.
  if (!anthropic) return null;
  const fromClaude = await askClaude({ source_key, descriptor, pfc_primary });
  if (!fromClaude) return null;

  // Persist to durable layer AND warm Redis. Claude's merchant_key
  // is the canonical PK. The caller's source_key is added to the
  // source_keys array so future lookups for this engine output hit
  // the dual-lookup directly. If the canonical row already exists
  // (different source_key resolved here before), we union the new
  // source_key into the existing array.
  const finalVerdict = await persistClaudeVerdict({
    canonical: fromClaude,
    source_key,
    descriptor,
  });

  if (redis) {
    try {
      await redis.set(redisKey(source_key), finalVerdict, {
        ex: REDIS_TTL_SECONDS,
      });
    } catch {
      // non-fatal
    }
  }
  return finalVerdict;
}

// Upsert Claude's canonical verdict to brand_verdicts, unioning
// source_keys + raw_descriptor_samples idempotently. Returns the
// post-write verdict (with source_keys reflecting the union) so the
// Redis cache stores the latest shape.
async function persistClaudeVerdict(args: {
  // Claude's output, BEFORE the source_keys union write. Typed as
  // Omit<...> so callers can hand off the askClaude return directly
  // without manufacturing an empty source_keys field upstream.
  canonical: Omit<BrandVerdict, "source_keys">;
  source_key: string;
  descriptor: string;
}): Promise<BrandVerdict> {
  const { canonical, source_key, descriptor } = args;
  if (!supabaseAdmin) {
    // No durable layer — synthesize source_keys from the input so the
    // returned BrandVerdict still satisfies the type. The next scan
    // will retry the persist when supabaseAdmin is available.
    return { ...canonical, source_keys: [source_key] };
  }

  // Read existing row to union arrays without overwriting.
  const { data: existing } = await supabaseAdmin
    .from("brand_verdicts")
    .select("source_keys, raw_descriptor_samples")
    .eq("merchant_key", canonical.merchant_key)
    .maybeSingle();

  const existingSourceKeys =
    (existing?.source_keys as string[] | null) ?? [];
  const existingSamples =
    (existing?.raw_descriptor_samples as string[] | null) ?? [];

  const unionedSourceKeys = uniqueAppend(existingSourceKeys, source_key);
  const unionedSamples = uniqueAppend(existingSamples, descriptor, 10);

  await supabaseAdmin.from("brand_verdicts").upsert(
    {
      merchant_key: canonical.merchant_key,
      display_name: canonical.display_name,
      category: canonical.category,
      subscription_likelihood: canonical.subscription_likelihood,
      domain: canonical.domain,
      decided_by: "claude",
      decided_at: canonical.decided_at,
      model_version: canonical.model_version,
      prompt_version: canonical.prompt_version,
      reasoning: canonical.reasoning,
      confidence_score: canonical.confidence_score,
      raw_descriptor_samples: unionedSamples,
      source_keys: unionedSourceKeys,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "merchant_key" }
  );

  return { ...canonical, source_keys: unionedSourceKeys };
}

// Helper. Append `value` to `existing` if not already present.
// Bounded at `cap` items (oldest evicted from the front) so unbounded
// growth doesn't bloat the row.
function uniqueAppend<T>(existing: T[], value: T, cap = 100): T[] {
  if (existing.includes(value)) return existing;
  const next = [...existing, value];
  if (next.length > cap) next.splice(0, next.length - cap);
  return next;
}

// Bulk lookup. Used by the scan orchestrator after detection — looks
// up every source_key in a single round-trip to the DB, then asks
// Claude in parallel for misses (bounded concurrency). Same caching
// contract as getBrandVerdict.
//
// Returns a Map keyed on the INPUT source_key (not the canonical
// merchant_key) so callers can correlate verdicts back to the
// engine-grouped streams they came from. Two distinct source_keys
// that resolve to the same canonical will both appear in the map,
// pointing to the same BrandVerdict object.
export async function getBrandVerdictsBulk(
  inputs: LookupArgs[]
): Promise<Map<string, BrandVerdict>> {
  const out = new Map<string, BrandVerdict>();
  if (inputs.length === 0) return out;

  // Dedupe by source_key before any I/O.
  const unique = new Map<string, LookupArgs>();
  for (const i of inputs) {
    if (!unique.has(i.source_key)) unique.set(i.source_key, i);
  }
  const sourceKeys = Array.from(unique.keys());

  // Tier 2 single-trip dual fetch — PK match OR source_keys array
  // contains, against the full set of input source_keys.
  if (supabaseAdmin && sourceKeys.length > 0) {
    // Two queries (PK in, source_keys overlap) issued in parallel.
    // Combined into the output map; an input that's both a canonical
    // and a listed source_key on the same row hits only once.
    const [pkRes, arrRes] = await Promise.all([
      supabaseAdmin
        .from("brand_verdicts")
        .select(
          "merchant_key, display_name, category, subscription_likelihood, domain, decided_by, decided_at, model_version, prompt_version, reasoning, confidence_score, source_keys"
        )
        .in("merchant_key", sourceKeys),
      supabaseAdmin
        .from("brand_verdicts")
        .select(
          "merchant_key, display_name, category, subscription_likelihood, domain, decided_by, decided_at, model_version, prompt_version, reasoning, confidence_score, source_keys"
        )
        // source_keys && array overlap — matches any row whose
        // source_keys array intersects the input set.
        .overlaps("source_keys", sourceKeys),
    ]);

    for (const row of [...(pkRes.data ?? []), ...(arrRes.data ?? [])]) {
      const verdict = row as unknown as BrandVerdict;
      if (!isWellFormed(verdict)) continue;
      // Map every matching input source_key → this canonical verdict.
      const matchedSources = [
        verdict.merchant_key, // PK case
        ...((verdict.source_keys as string[]) ?? []),
      ].filter((k) => unique.has(k));
      for (const k of matchedSources) {
        if (!out.has(k)) out.set(k, verdict);
      }
    }
  }

  // Misses → Claude with bounded concurrency. getBrandVerdict handles
  // the persist + source_keys union write back to the DB.
  const misses = sourceKeys.filter((k) => !out.has(k));
  const MAX_CONCURRENT = 4;
  for (let i = 0; i < misses.length; i += MAX_CONCURRENT) {
    const chunk = misses.slice(i, i + MAX_CONCURRENT);
    const settled = await Promise.allSettled(
      chunk.map((k) => getBrandVerdict(unique.get(k)!))
    );
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      const sourceKey = chunk[j];
      if (r.status === "fulfilled" && r.value) {
        out.set(sourceKey, r.value);
      }
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Claude call. Temp 0, JSON schema output, pinned model.
// ──────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial classifier. Given a bank transaction descriptor and an optional Plaid category tag, identify the merchant brand and classify whether THIS DESCRIPTOR represents a recurring subscription.

Respond with ONLY a JSON object in this exact schema:

{
  "merchant_key": string,           // canonical lowercase slug, no spaces. Include product-level signals when present (e.g. "netflix", "anthropic", "apple_icloud", "amazon_prime", "doordash_dashpass")
  "display_name": string,           // brand + product as a human would write it (e.g. "Netflix", "Apple iCloud", "DoorDash DashPass")
  "category": string,               // one of: streaming, software, news, fitness, cloud_storage, gaming, telecom, utilities, education, insurance, food_delivery, retail, transportation, financial_services, other
  "subscription_likelihood": string,// one of: "always" | "sometimes" | "never"
  "domain": string | null,          // primary domain if you know it (e.g. "netflix.com"), else null
  "reasoning": string,              // ONE short sentence explaining the verdict (max 140 chars). Cited by audit + future tuning.
  "confidence_score": number        // 0.0 to 1.0. Your self-assessed certainty in this verdict.
}

CRITICAL RULES for subscription_likelihood:

- "always" — every charge that matches THIS descriptor pattern is a recurring subscription. Examples: Netflix, Spotify, Anthropic, "APPLE.COM/BILL ICLOUD", "DOORDASH*DASHPASS", "AMAZON PRIME".
- "sometimes" — the descriptor is genuinely ambiguous. Could be a sub, could be a one-off. The user must resolve. Examples: "APPLE.COM/BILL 866-712-7753" (could be iCloud OR a movie rental), "DOORDASH*1234" (could be DashPass OR an order), generic "AMAZON.COM*M12345" (could be Prime OR a purchase).
- "never" — this descriptor pattern is never a subscription. Examples: "DOORDASH ORDER 5678" (one-off meal), "UBER TRIP 12345" (one-off ride), "STARBUCKS 4567" (coffee), "SHELL #1234" (gas), "ATM WITHDRAWAL", "WIRE TRANSFER".

KEY PRINCIPLE: judge the DESCRIPTOR, not the brand alone. DoorDash sells DashPass (always) AND one-off meals (never) AND ambiguous wrapped charges (sometimes). Apple sells iCloud (always) AND movie rentals (never) AND ambiguous bill wrappers (sometimes). If the descriptor names a specific product (DashPass, iCloud, Prime, Audible), use that. If the descriptor is the brand alone with a noise suffix, classify as "sometimes" unless context strongly suggests one-off (e.g. "ORDER", "TRIP", "PURCHASE", numeric POS suffixes).

Do not invent merchants. If you can't confidently identify the brand, output your best guess for display_name, set category to "other", set subscription_likelihood to "sometimes", confidence_score ≤ 0.5, and explain the uncertainty in reasoning.

Respond with ONLY the JSON object. No markdown, no commentary, no code fences.`;

async function askClaude(
  args: LookupArgs
): Promise<Omit<BrandVerdict, "source_keys"> | null> {
  // Note: askClaude returns the verdict WITHOUT source_keys — that's
  // filled in by persistClaudeVerdict after the union-write to the
  // durable layer. Keeps the Claude path focused on the merchant
  // judgment, not the cache bookkeeping.
  if (!anthropic) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("claude_timeout"), CLAUDE_TIMEOUT_MS);

  const userPrompt = buildUserPrompt(args);

  try {
    const res = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 256,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: ctrl.signal }
    );

    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");

    const parsed = JSON.parse(raw) as Partial<BrandVerdict>;

    // Validate the response shape rigorously — Claude misses produce
    // crash-loops if we trust the response without checking. Every
    // required field gets a type check + range check where applicable.
    if (
      typeof parsed.merchant_key !== "string" ||
      !parsed.merchant_key ||
      typeof parsed.display_name !== "string" ||
      typeof parsed.category !== "string" ||
      (parsed.subscription_likelihood !== "always" &&
        parsed.subscription_likelihood !== "sometimes" &&
        parsed.subscription_likelihood !== "never") ||
      typeof parsed.reasoning !== "string" ||
      typeof parsed.confidence_score !== "number" ||
      parsed.confidence_score < 0 ||
      parsed.confidence_score > 1
    ) {
      // eslint-disable-next-line no-console
      console.warn("[brand-verdicts] Claude returned malformed verdict", parsed);
      return null;
    }

    return {
      // Normalize Claude's canonical key aggressively so two near-
      // identical outputs ('Apple iCloud' vs 'apple_icloud' vs
      // 'apple-icloud') don't produce duplicate PKs. lowercase,
      // collapse whitespace/hyphens → underscores, strip trailing
      // punctuation. Claude already emits lowercase snake_case per
      // the prompt, but this is defense-in-depth.
      merchant_key: normalizeCanonical(parsed.merchant_key),
      display_name: parsed.display_name,
      category: parsed.category,
      subscription_likelihood: parsed.subscription_likelihood,
      domain:
        typeof parsed.domain === "string" && parsed.domain.length > 0
          ? parsed.domain.toLowerCase()
          : null,
      decided_by: "claude",
      decided_at: new Date().toISOString(),
      model_version: MODEL,
      prompt_version: PROMPT_VERSION,
      // Cap reasoning at the prompt's stated max to defend against
      // future prompt changes that don't update this validator.
      reasoning: parsed.reasoning.slice(0, 280),
      confidence_score: parsed.confidence_score,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[brand-verdicts] Claude call failed",
      e instanceof Error ? e.message : e
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildUserPrompt(args: LookupArgs): string {
  const pfc = args.pfc_primary ? `\nPlaid category: ${args.pfc_primary}` : "";
  // We pass the source_key as a hint, but Claude is told to produce
  // its own canonical merchant_key — not echo this one back. The
  // source_key may carry amount-tier noise we explicitly want to
  // collapse.
  return `Descriptor: ${args.descriptor}${pfc}\nEngine source key (may be noisy — produce your own canonical): ${args.source_key}`;
}

// ──────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────

// Normalize Claude's canonical merchant_key output so cosmetic
// variants don't fragment the brand_verdicts PK. Defensive — the
// prompt already asks for lowercase snake_case, but this defends
// against future prompt drift.
function normalizeCanonical(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")    // hyphens + whitespace → underscore
    .replace(/[^a-z0-9_]/g, "") // strip any remaining punctuation
    .replace(/_+/g, "_")        // collapse runs of underscores
    .replace(/^_|_$/g, "");     // trim leading/trailing underscores
}

function isWellFormed(v: BrandVerdict | null | undefined): v is BrandVerdict {
  if (!v) return false;
  if (typeof v.merchant_key !== "string" || !v.merchant_key) return false;
  if (typeof v.display_name !== "string") return false;
  if (typeof v.category !== "string") return false;
  if (
    v.subscription_likelihood !== "always" &&
    v.subscription_likelihood !== "sometimes" &&
    v.subscription_likelihood !== "never"
  ) {
    return false;
  }
  // source_keys must be an array (may be empty for catalog/manual rows
  // and brand-new claude rows before persistClaudeVerdict runs the
  // union). Coerce undefined → [] so DB rows from older migrations
  // don't trip the check.
  if (v.source_keys != null && !Array.isArray(v.source_keys)) return false;
  return true;
}

// Versions exported for telemetry + admin tools.
export const BRAND_VERDICT_PROMPT_VERSION = PROMPT_VERSION;
export const BRAND_VERDICT_MODEL = MODEL;
