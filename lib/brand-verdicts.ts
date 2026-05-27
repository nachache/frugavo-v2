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
};

export type LookupArgs = {
  merchant_key: string;
  // Descriptor sample used as the Claude input on cache miss. The
  // verdict is keyed on merchant_key alone (so the cache hits across
  // descriptor variants), but Claude needs to see at least one
  // representative descriptor to make the call.
  descriptor: string;
  // Optional Plaid PFC tag — helps Claude when the merchant_key is
  // ambiguous (e.g. a generic biller wrapper).
  pfc_primary?: string | null;
};

// ──────────────────────────────────────────────────────────────────────
// Cache key helpers
// ──────────────────────────────────────────────────────────────────────

function redisKey(merchant_key: string): string {
  // Namespace by prompt+model versions so a future prompt change opens
  // a clean cache namespace without invalidating durable DB rows.
  return `brand_verdict:v${PROMPT_VERSION}:${MODEL}:${merchant_key}`;
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

// Primary lookup. Three-tier read path:
//   1. Redis (warm cache, 30d TTL)
//   2. brand_verdicts table (durable, forever)
//   3. Claude (cache miss, writes back to both layers)
//
// If Claude is unavailable or fails, returns null. Callers must
// handle null — typically by falling back to engine-only cadence
// logic for this scan and re-trying on the next scan when Claude
// might be back.
export async function getBrandVerdict(
  args: LookupArgs
): Promise<BrandVerdict | null> {
  const { merchant_key, descriptor, pfc_primary } = args;
  if (!merchant_key) return null;

  // Tier 1 — Redis.
  if (redis) {
    try {
      const cached = await redis.get<BrandVerdict>(redisKey(merchant_key));
      if (cached && isWellFormed(cached)) return cached;
    } catch {
      // fall through
    }
  }

  // Tier 2 — durable DB.
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("brand_verdicts")
      .select(
        "merchant_key, display_name, category, subscription_likelihood, domain, decided_by, decided_at, model_version, prompt_version, reasoning, confidence_score"
      )
      .eq("merchant_key", merchant_key)
      .maybeSingle();
    if (data && isWellFormed(data as unknown as BrandVerdict)) {
      const verdict = data as unknown as BrandVerdict;
      // Warm Redis for next time. Best-effort.
      if (redis) {
        try {
          await redis.set(redisKey(merchant_key), verdict, {
            ex: REDIS_TTL_SECONDS,
          });
        } catch {
          // non-fatal
        }
      }
      return verdict;
    }
  }

  // Tier 3 — live Claude call.
  if (!anthropic) return null;
  const fromClaude = await askClaude({ merchant_key, descriptor, pfc_primary });
  if (!fromClaude) return null;

  // Persist to durable layer AND warm Redis.
  if (supabaseAdmin) {
    await supabaseAdmin.from("brand_verdicts").upsert(
      {
        merchant_key: fromClaude.merchant_key,
        display_name: fromClaude.display_name,
        category: fromClaude.category,
        subscription_likelihood: fromClaude.subscription_likelihood,
        domain: fromClaude.domain,
        decided_by: "claude",
        decided_at: fromClaude.decided_at,
        model_version: fromClaude.model_version,
        prompt_version: fromClaude.prompt_version,
        reasoning: fromClaude.reasoning,
        confidence_score: fromClaude.confidence_score,
        raw_descriptor_samples: [descriptor],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "merchant_key" }
    );
  }
  if (redis) {
    try {
      await redis.set(redisKey(merchant_key), fromClaude, {
        ex: REDIS_TTL_SECONDS,
      });
    } catch {
      // non-fatal
    }
  }
  return fromClaude;
}

// Bulk lookup. Used by the scan orchestrator after detection — looks
// up every merchant_key in a single round-trip to the DB, then asks
// Claude in parallel for misses (bounded concurrency). Same caching
// contract as getBrandVerdict.
export async function getBrandVerdictsBulk(
  inputs: LookupArgs[]
): Promise<Map<string, BrandVerdict>> {
  const out = new Map<string, BrandVerdict>();
  if (inputs.length === 0) return out;

  // Dedupe by merchant_key before any I/O.
  const unique = new Map<string, LookupArgs>();
  for (const i of inputs) {
    if (!unique.has(i.merchant_key)) unique.set(i.merchant_key, i);
  }

  // Tier 2 single-trip fetch for the durable layer. Redis micro-cache
  // we skip for the bulk path — too many round trips for a small win.
  const keys = Array.from(unique.keys());
  if (supabaseAdmin && keys.length > 0) {
    const { data } = await supabaseAdmin
      .from("brand_verdicts")
      .select(
        "merchant_key, display_name, category, subscription_likelihood, domain, decided_by, decided_at, model_version, prompt_version, reasoning, confidence_score"
      )
      .in("merchant_key", keys);
    for (const row of data ?? []) {
      const verdict = row as unknown as BrandVerdict;
      if (isWellFormed(verdict)) {
        out.set(verdict.merchant_key, verdict);
      }
    }
  }

  // Misses → Claude with bounded concurrency.
  const misses = keys.filter((k) => !out.has(k));
  const MAX_CONCURRENT = 4;
  for (let i = 0; i < misses.length; i += MAX_CONCURRENT) {
    const chunk = misses.slice(i, i + MAX_CONCURRENT);
    const settled = await Promise.allSettled(
      chunk.map((k) => getBrandVerdict(unique.get(k)!))
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        out.set(r.value.merchant_key, r.value);
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
): Promise<BrandVerdict | null> {
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
      merchant_key: parsed.merchant_key.toLowerCase(),
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
  return `Descriptor: ${args.descriptor}${pfc}\nMerchant key (engine-assigned, possibly noisy): ${args.merchant_key}`;
}

// ──────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────

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
  return true;
}

// Versions exported for telemetry + admin tools.
export const BRAND_VERDICT_PROMPT_VERSION = PROMPT_VERSION;
export const BRAND_VERDICT_MODEL = MODEL;
