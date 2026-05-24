// Layered subscription classifier (v2 — classifier brain).
//
// Major change from v1: Claude was a tiebreak that only fired at
// Gate B score == 2. It now runs on EVERY stream that survives
// Gate A. Gate B is still computed but its score is recorded as
// shadow signals for audit + future logistic retraining, not as
// the decision.
//
//   Gate A — Hard denylist (unchanged)
//     PFC primary in {TRANSFER_IN, TRANSFER_OUT, LOAN_PAYMENTS,
//     BANK_FEES, INCOME, TAX} → reject.
//     PFC detailed contains TAX_PAYMENT / ACCOUNT_TRANSFER / WIRE /
//     THIRD_PARTY_PAYMENT / CASH_ADVANCE / INTEREST / OVERDRAFT → reject.
//     Raw descriptor matches the hard deny regex → reject.
//
//     Ambiguous descriptor patterns (rent, vendor, b2b supply, long
//     digits) now route to "soft_review" — they pass Gate A and reach
//     the classifier, which can rescue real subs that pattern-match
//     like vendor invoices.
//
//   Gate B — Shadow scoring (NOT THE DECISION)
//     Same +1 signals as before (frequency, amount stability,
//     mature/active, positive PFC, known domain). Recorded in
//     classification_signals for audit + logistic retraining. Does
//     not gate the decision.
//
//   Gate C — Claude classifier (THE DECISION)
//     Called on every Gate A survivor. Returns is_subscription, tier,
//     confidence with a strict JSON contract. Cached by
//     (canonical_merchant_key, cadence_band, amount_bucket) so the
//     second scan of the same ledger is a near-100% cache hit.
//     Confidence + is_subscription gating:
//       high (>=0.85) + is_subscription === true → confirm
//       otherwise → needs_review
//     Error / timeout / low confidence → needs_review.
//
// Charity/donation override stays at the back of the pipeline.
//
// Outputs:
//   decision = 'confirm' | 'review' | 'reject'
//   classification:
//     - confirm  → 'confirmed'  (counts toward totals + candidates)
//     - review   → 'needs_review' (stored, never surfaced in totals)
//     - reject   → caller does not insert the row at all

import type { Frequency } from "@/lib/types/scan";

export type ClassificationStatus = "confirmed" | "needs_review";

export type ClassifyInput = {
  // Raw bank descriptor as it appeared on the statement.
  descriptor: string;
  // Plaid's cleaned merchant name, if present.
  merchantName?: string | null;
  // Plaid personal_finance_category fields. Either or both may be null.
  pfcPrimary?: string | null;
  pfcDetailed?: string | null;
  // Plaid recurring stream metadata.
  frequency?: string | null;
  status?: string | null; // MATURE | EARLY_DETECTION | TOMBSTONED
  isActive?: boolean;
  avgAmountCents: number;
  // Recent charge amounts in cents. Used for the CV signal.
  recentChargeCents?: number[];
  // Optional domain (Plaid website field or our domain map). Used as a
  // signal in Gate B and passed to the LLM tiebreak.
  domain?: string | null;
  // Canonical merchant identity from the resolver (Change 1). Drives
  // the classifier cache key — same canonical_merchant_key + cadence +
  // amount bucket = same cached verdict, no LLM call.
  canonicalMerchantKey?: string | null;
  // Cadence band string used by the cache key. WEEKLY | BIWEEKLY |
  // SEMI_MONTHLY | MONTHLY | QUARTERLY | ANNUALLY.
  cadenceBand?: string | null;
  // True iff Gate A flagged this stream with a soft_review pattern
  // (rent / vendor / b2b_supply / long_digits). Forwarded to the
  // classifier as extra context but does NOT change the cache key.
  softReviewReason?: string | null;
};

export type ClassifyDecision = "confirm" | "review" | "reject";

export type ClassifyResult = {
  decision: ClassifyDecision;
  classification: ClassificationStatus | null; // null only when decision === 'reject'
  score: number;
  signals: string[];
  rejectReason?: string;
  llm?: LlmClassifyResponse | null;
};

// v2 contract — the classifier returns tier + is_subscription + a
// short audit reason. The merchant / domain fields are kept on the
// type for backward compatibility (older callers still read them)
// but the resolver now owns identity, not the classifier.
export type LlmClassifyResponse = {
  merchant?: string;
  category?: string;
  domain?: string;
  is_subscription: boolean;
  confidence: number;
  // v2 fields
  tier?:
    | "confirmed_subscription"
    | "recurring_bill"
    | "recurring_commerce"
    | "uncertain_recurring";
  reason?: string;
};

// ---------- Gate A: hard denylist ----------

const PFC_PRIMARY_DENY = new Set<string>([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOAN_PAYMENTS",
  "BANK_FEES",
  "INCOME",
  "TAX",
]);

const PFC_DETAILED_DENY_TOKENS = [
  "TAX_PAYMENT",
  "ACCOUNT_TRANSFER",
  "WIRE",
  "THIRD_PARTY_PAYMENT",
  "CASH_ADVANCE",
  "INTEREST",
  "OVERDRAFT",
];

// HARD-REJECT descriptor patterns. Streams matching any of these are
// dropped before the classifier even sees them — they are definitively
// NOT consumer subscriptions and never could be (taxes, transfers,
// payroll, internal bank moves).
//
// SOFT-REJECT patterns (further below) used to live here too but they
// now route to needs_review so the LLM classifier can rescue real
// subscriptions that pattern-match like vendor invoices or rent.
const DESCRIPTOR_DENY_GROUPS: { name: string; pattern: RegExp }[] = [
  { name: "tax",        pattern: /\b(tax|gst|hst|cra|irs|government\s+tax|tax\s+payment)\b/i },
  { name: "government", pattern: /\b(govern|federal\s+govt|gvt\s+of|municipal|passport|passeport|cour\s+municipal)\b/i },
  { name: "transfer",   pattern: /\b(wire|e[\-\s]?transfer|cash\s+transfer|interac|international\s+transfer\s+fee|direct\s+payment|mb[\-\s]?transfer|free\s+interac)\b/i },
  { name: "settlement", pattern: /\b(settlement|sd\s+settlement|stripe\s+settlement|square\s+settlement|wire\s+settlement|disbursement)\b/i },
  { name: "merchant_svc", pattern: /\b(merchant\s+svc|mrchnt|merchant\s+services)\b/i },
  { name: "fee",        pattern: /\b(cover\s+fee|service\s+fee|transfer\s+fee|atm\s+fee|nsf\s+fee|overdraft\s+fee)\b/i },
  // Payroll providers + the generic "payroll" word.
  { name: "payroll",    pattern: /\b(payroll|gusto|adp\s+payroll|paychex|justworks|rippling|deel|wagepoint|payworks|ceridian|pc[\-\s]?payworks|mb[\-\s]?payworks|ach\s+credit|temp\s+wages|temp\s+staffing|tempstars[\-\s]?temp)\b/i },
  { name: "loan",       pattern: /\b(mortgage|loan|bdc|banque\s+developpement|loan\s+payment|line\s+of\s+credit)\b/i },
  { name: "transfer_to_account", pattern: /\bpc\s+to\s+\d/i },
  { name: "card_payment", pattern: /\b(credit\s*card[^a-z]*payment|automatic\s+payment|auto[\s-]?pay\b|cc\s+payment|card\s+payment|payment\s+received|payment\s+-?\s*thank|thank\s+you[^a-z]*payment)\b/i },
  { name: "bank_internal", pattern: /\b(cd\s+deposit|certificate\s+of\s+deposit|savings\s+transfer|sweep\s+to\s+savings|investment\s+contribution|brokerage\s+transfer|round[\-\s]?up|abm\s+withdrawal|atm\s+withdrawal|bank\s+withdrawal|scotia\s+direct|scotiaconnect|cash\s+sent|cash\s+withdrawal)\b/i },
  { name: "bare_generic", pattern: /^(deposit|transfer|withdrawal|debit|credit)$/i },
  { name: "brokerage",  pattern: /\b(questrade|wealthsimple|td\s+direct|td\s+waterhouse|etrade|e\*trade|schwab|fidelity|vanguard|robinhood|interactive\s+brokers|brokerage)\b/i },
];

// SOFT-REJECT descriptor patterns. Streams matching these are
// AMBIGUOUS — they could be vendor invoices / rent / B2B supply (not
// subs), but they could also be a legit subscription whose merchant
// name happens to contain the same words. Per the trust-rebuild brief:
// "keep deleting only the unambiguous non-subscriptions. For ambiguous
// descriptors that currently get regex-deleted but could be real
// subscriptions, route them to a candidate pool with status
// needs_review and an audit reason, instead of dropping them."
//
// These patterns are now routed via Gate A returning passed:true with
// a `soft_review:<pattern_name>` signal. Gate B + the classifier get
// to see them and decide.
const DESCRIPTOR_SOFT_REVIEW_GROUPS: { name: string; pattern: RegExp }[] = [
  // B2B procurement / lab services. Real B2B subs (Henry Schein
  // Connect, dental practice software) shouldn't be deleted just
  // because they share words with one-off supply invoices.
  { name: "b2b_supply", pattern: /\b((dental|medical|laboratory|optical|orthodontic|veterinary)\s+(supply|supplies|laboratory|labs?|equipment|distributor))\b/i },
  { name: "b2b_lab",    pattern: /\b(dental\s+lab|dental\s+laboratory|medical\s+lab|pathology\s+lab|optical\s+lab|practicon|orascoptic|cintas|safco)\b/i },
  // Property / rent. Recurring residential rent should land as
  // recurring_bill, not be deleted. Software products with
  // "Properties" in the name (HubSpot Marketing Hub etc.) shouldn't
  // be deleted either.
  { name: "rent",       pattern: /\b(property\s+group|real\s+estate|propert(?:y|ies)\s+(?:llc|inc|management)|landlord|rent\s+payment|lease\s+payment|huntington\s+property)\b/i },
  // Generic vendor / invoice language. Some SaaS shows up as
  // "VENDOR PAYMENT TO X" depending on the bank's renderer.
  { name: "vendor",     pattern: /\b(holdings?|invoice|payment\s+to)\b/i },
  // Long digit-only blobs without a human merchant. Sometimes a real
  // merchant pays through a processor that surfaces only a digit
  // reference. Let the classifier ask Claude.
  { name: "long_digits", pattern: /\b\d{9,}\b/ },
];

// Charity / donation indicators. Forces needs_review at the back of
// the classifier even when mechanical score is high. The spec says
// donations are never auto-confirmed.
const CHARITY_INDICATORS =
  /\b(unrwa|islamic\s*relief|nccm|cnmc|red\s*cross|world\s*vision|doctors?\s*without\s*borders?|salvation\s*army|food\s*bank|relief|humanitarian|orphan|refugee|childrens?\s*villages?|humane\s*society|sos\s*children)\b/i;

// ---------- Known subscription domains (positive signal) ----------
//
// Single source of truth: lib/data/merchant-catalog.json. We collect
// every domain listed on a merchant OR biller entry at module load and
// expose the resulting Set to Gate B. When the catalog grows, this set
// grows automatically — no duplicate list to maintain.

import catalog from "@/lib/data/merchant-catalog.json";

type CatalogShape = {
  merchants: { domains?: string[] }[];
  billers: { domains?: string[] }[];
};

const KNOWN_SUB_DOMAINS: Set<string> = (() => {
  const s = new Set<string>();
  const c = catalog as unknown as CatalogShape;
  for (const m of c.merchants ?? []) {
    for (const d of m.domains ?? []) s.add(d.toLowerCase());
  }
  for (const b of c.billers ?? []) {
    for (const d of b.domains ?? []) s.add(d.toLowerCase());
  }
  return s;
})();

// ---------- Gate A ----------

export type GateAResult =
  | { passed: true; softReviewReason?: string }
  | { passed: false; reason: string };

export function gateA(input: ClassifyInput): GateAResult {
  if (input.pfcPrimary && PFC_PRIMARY_DENY.has(input.pfcPrimary.toUpperCase())) {
    return { passed: false, reason: `pfc_primary:${input.pfcPrimary}` };
  }
  if (input.pfcDetailed) {
    const up = input.pfcDetailed.toUpperCase();
    for (const token of PFC_DETAILED_DENY_TOKENS) {
      if (up.includes(token)) {
        return { passed: false, reason: `pfc_detailed:${token}` };
      }
    }
  }
  const text = `${input.merchantName ?? ""} ${input.descriptor ?? ""}`.trim();
  if (!text) {
    return { passed: false, reason: "empty_descriptor" };
  }
  for (const { name, pattern } of DESCRIPTOR_DENY_GROUPS) {
    if (pattern.test(text)) {
      return { passed: false, reason: `descriptor:${name}` };
    }
  }
  // Soft-route patterns: pass Gate A but mark for forced needs_review
  // unless the classifier explicitly confirms otherwise.
  for (const { name, pattern } of DESCRIPTOR_SOFT_REVIEW_GROUPS) {
    if (pattern.test(text)) {
      return { passed: true, softReviewReason: `soft_review:${name}` };
    }
  }
  return { passed: true };
}

// ---------- Gate B ----------

const POSITIVE_PFC_PRIMARIES = new Set<string>([
  "ENTERTAINMENT",
  "RENT_AND_UTILITIES",
  "GENERAL_SERVICES",
  "PERSONAL_CARE",
]);

const VALID_FREQUENCIES = new Set<string>([
  "WEEKLY",
  "SEMI_MONTHLY",
  "MONTHLY",
  "ANNUALLY",
]);

export type GateBResult = {
  score: number;
  signals: string[];
  disqualified?: boolean;
};

export function gateB(input: ClassifyInput): GateBResult {
  const signals: string[] = [];
  let score = 0;

  // Frequency signal — UNKNOWN is an immediate disqualifier.
  const freqRaw = (input.frequency ?? "").toUpperCase();
  if (!freqRaw || freqRaw === "UNKNOWN") {
    return { score: -1, signals: ["unknown_frequency"], disqualified: true };
  }
  if (VALID_FREQUENCIES.has(freqRaw)) {
    score += 1;
    signals.push(`freq:${freqRaw}`);
  }

  // Coefficient of variation on the charge history. <= 0.15 = stable.
  if (input.recentChargeCents && input.recentChargeCents.length >= 2) {
    const cv = coefficientOfVariation(input.recentChargeCents);
    if (cv <= 0.15) {
      score += 1;
      signals.push(`cv:${cv.toFixed(3)}`);
    }
  }

  // MATURE + active. Plaid only marks streams MATURE after several
  // consecutive on-cadence charges.
  if (
    (input.status ?? "").toUpperCase() === "MATURE" &&
    input.isActive === true
  ) {
    score += 1;
    signals.push("mature_active");
  }

  // Positive category signal — either by Plaid PFC or by known domain.
  const pfcUp = (input.pfcPrimary ?? "").toUpperCase();
  if (POSITIVE_PFC_PRIMARIES.has(pfcUp)) {
    score += 1;
    signals.push(`pfc_positive:${pfcUp}`);
  } else if (input.domain && KNOWN_SUB_DOMAINS.has(input.domain.toLowerCase())) {
    score += 1;
    signals.push(`known_domain:${input.domain.toLowerCase()}`);
  }

  return { score, signals };
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((s, x) => s + (x - mean) * (x - mean), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// ---------- Top-level classifier ----------

export type LlmCallback = (input: ClassifyInput) => Promise<LlmClassifyResponse | null>;

// Confidence floor for auto-confirm. Anything lower → needs_review.
// Trust asymmetry: users forgive missing subscriptions, never fake ones.
const CLASSIFY_CONFIRM_FLOOR = 0.85;

export async function classifyStream(
  input: ClassifyInput,
  llm?: LlmCallback
): Promise<ClassifyResult> {
  // A — hard rejects.
  const a = gateA(input);
  if (!a.passed) {
    return {
      decision: "reject",
      classification: null,
      score: 0,
      signals: [],
      rejectReason: a.reason,
    };
  }

  // B — shadow scoring. Recorded for audit + retraining; NOT the
  // decision. The classifier brain (Gate C below) decides.
  const b = gateB(input);
  const shadowSignals = b.disqualified
    ? [...b.signals, "gateB_disqualified_shadow"]
    : b.signals;

  // Soft-route signal from Gate A.
  if (a.softReviewReason) shadowSignals.push(a.softReviewReason);

  // Charity override — applies regardless of LLM verdict.
  const text = `${input.merchantName ?? ""} ${input.descriptor ?? ""}`;
  const isCharity = CHARITY_INDICATORS.test(text);
  if (isCharity) {
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [...shadowSignals, "charity_override"],
    };
  }

  // C — Claude classifier runs on every Gate A survivor.
  // If no llm callback was supplied (e.g. test harness, env without
  // ANTHROPIC_API_KEY), we fall back to the old Gate B threshold so
  // the engine still works degraded. needs_review on uncertainty.
  if (!llm) {
    if (b.score >= 3) {
      return {
        decision: "confirm",
        classification: "confirmed",
        score: b.score,
        signals: [...shadowSignals, "no_llm_fallback_high_b"],
      };
    }
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [...shadowSignals, "no_llm_available"],
    };
  }

  let llmResp: LlmClassifyResponse | null = null;
  try {
    llmResp = await llm(input);
  } catch {
    llmResp = null;
  }

  // Error / timeout → needs_review. Never auto-confirm.
  if (!llmResp) {
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [...shadowSignals, "llm_timeout_or_error"],
      llm: null,
    };
  }

  const conf = typeof llmResp.confidence === "number" ? llmResp.confidence : 0;
  const isSub = llmResp.is_subscription === true;
  const tierSignal = llmResp.tier ? `llm_tier:${llmResp.tier}` : "llm_tier:unknown";
  const reasonSignal = llmResp.reason
    ? `llm_reason:${String(llmResp.reason).slice(0, 60)}`
    : "llm_reason:none";
  const confSignal = `llm_conf:${conf.toFixed(2)}`;

  if (isSub && conf >= CLASSIFY_CONFIRM_FLOOR) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: [...shadowSignals, "llm_confirmed", confSignal, tierSignal, reasonSignal],
      llm: llmResp,
    };
  }

  return {
    decision: "review",
    classification: "needs_review",
    score: b.score,
    signals: [
      ...shadowSignals,
      isSub ? "llm_below_floor" : "llm_not_subscription",
      confSignal,
      tierSignal,
      reasonSignal,
    ],
    llm: llmResp,
  };
}

// ---------- Classifier brain (v2) ----------
//
// Pin the prompt + model version into the snapshot so replay can
// prove it's reading the same verdicts. Bump on any prompt change.
export const CLASSIFY_LLM_VERSION = "classify-v2-haiku-4-5-20251001";

export const CLASSIFY_SYSTEM_PROMPT = `You decide whether a recurring charge belongs in the user's "subscriptions and bills" view, or in the "recurring spending patterns" view, or should stay hidden.

TIERS
- confirmed_subscription: ongoing access to a service the user pays for as a subscription. Examples: Netflix, Spotify, Apple iCloud, Apple One, Amazon Prime, Adobe Creative Cloud, ChatGPT/OpenAI, Notion, Dropbox, gym memberships, magazine/news subscriptions, software SaaS (Microsoft 365, Google Workspace, GitHub, Figma, Vercel), VPN services, AI tools.
- recurring_bill: regular obligation the user thinks of as a bill, not a subscription. Examples: utilities (electric, gas, water), telecom (Verizon, T-Mobile, Comcast, Spectrum), internet, insurance (auto, health, home), rent, mortgage, daycare/childcare.
- recurring_commerce: recurring spending patterns at merchants where each charge is a discrete purchase, NOT ongoing access. Examples: Starbucks, CVS, Whole Foods, Olive Garden, Shell, Sephora, DoorDash, Uber, Walmart, Home Depot.
- uncertain_recurring: cannot tell, low-confidence identification, or merchant looks like internal bank movement.

is_subscription is TRUE only for confirmed_subscription and recurring_bill (the things that count toward the user's recurring obligations total). It is FALSE for recurring_commerce and uncertain_recurring.

INPUT
You receive a candidate with: canonical_merchant_key, display_name, merchant_domain, descriptor, plaid_category, cadence (frequency band), and amount range. Use the canonical_merchant_key as the primary identity signal; the descriptor is noise.

OUTPUT
Return STRICT JSON, no prose, no markdown fences:

{
  "is_subscription": true|false,
  "tier": "confirmed_subscription"|"recurring_bill"|"recurring_commerce"|"uncertain_recurring",
  "confidence": <0.0..1.0>,
  "reason": "<short machine-readable audit string, max 80 chars>"
}

CONFIDENCE RULES
- high (>=0.85): merchant is clearly identified AND the tier is unambiguous.
- mid (0.6..0.85): identity clear but tier debatable (e.g. a gym vs personal training).
- low (<0.6): uncertain merchant identity OR unclear whether ongoing access vs discrete purchase.

If you have any doubt at all, prefer the more conservative tier (uncertain_recurring) and a lower confidence. The system NEVER auto-confirms below 0.85.`;

export function classifyUserPrompt(input: ClassifyInput): string {
  const obj = {
    canonical_merchant_key: input.canonicalMerchantKey ?? null,
    display_name: input.merchantName ?? null,
    merchant_domain: input.domain ?? null,
    descriptor: input.descriptor,
    plaid_category_primary: input.pfcPrimary ?? null,
    plaid_category_detailed: input.pfcDetailed ?? null,
    cadence_band: input.cadenceBand ?? null,
    median_amount_usd: Number((input.avgAmountCents / 100).toFixed(2)),
    soft_review_pattern: input.softReviewReason ?? null,
  };
  return JSON.stringify(obj);
}

// Cache key construction. Same merchant + same cadence + same dollar
// bucket = same verdict, so two scans of two users with the same
// Netflix monthly @ \$15 share one Claude call. Determinism is
// preserved because the verdict itself is deterministic at temperature 0.
export function classifyCacheKey(input: ClassifyInput): string | null {
  const key = input.canonicalMerchantKey;
  if (!key) return null;
  const cadence = input.cadenceBand ?? "UNKNOWN";
  // Round to nearest dollar. ceil(median_cents/100). $15.49 → 16 bucket,
  // $15.99 → 16 bucket, $22.99 → 23 bucket. Netflix Basic vs Premium
  // separate by design.
  const bucket = Math.max(0, Math.ceil(input.avgAmountCents / 100));
  return `classify:v1:${key}:${cadence}:${bucket}`;
}
