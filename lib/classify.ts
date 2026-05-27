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
  // True iff the canonical identity came from the curated
  // merchant-catalog.json (deterministic, hand-vetted). Used by the
  // stricter LLM-confirm gate: a curated identity is sufficient
  // independent evidence to back an LLM "yes" verdict; an LLM-only
  // identity (resolver guess) is not.
  isCuratedMerchant?: boolean;
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

// HARD-DENY PFC primaries. These are unambiguous non-recurring-spend
// categories: money movement, income.
//
// NOTE: LOAN_PAYMENTS was previously here (inherited from the v1
// binary classifier where "loan" wasn't recognized as a tier). In the
// new 4-tier model, mortgages / car loans / student loans / credit
// card loans are legitimate recurring_bill candidates and must reach
// the classifier. Moved to soft-route via PFC_PRIMARY_SOFT_REVIEW.
//
// TAX was previously here, but moved to soft-route too: property tax
// paid monthly through a city (e.g. PC-Gatineau, City of Ottawa) is a
// real recurring_bill. PFC_DETAILED_DENY_TOKENS still hard-blocks
// `TAX_PAYMENT` (one-off CRA / IRS filings) so income-tax filings
// don't sneak in.
const PFC_PRIMARY_DENY = new Set<string>([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "BANK_FEES",
  "INCOME",
]);

// Soft-route PFC primaries. Pass Gate A with a soft_review signal so
// the classifier can decide. Used for categories that COULD be a
// recurring bill but historically got over-rejected.
const PFC_PRIMARY_SOFT_REVIEW = new Set<string>([
  "LOAN_PAYMENTS",
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
// v7 / Problem 2 — All brand/company/processor identities have been
// removed from these regexes. What remains is generic class
// vocabulary: words that describe the TYPE of transaction (tax,
// transfer, fee, payroll, brokerage, withdrawal) rather than the
// specific entity. Identity comes from the catalog (data) and PFC
// tags (Plaid). The classifier's Gate A still routes provably
// non-merchant flows to reject — it just does so on grammar, not
// brand names.
const DESCRIPTOR_DENY_GROUPS: { name: string; pattern: RegExp }[] = [
  // Tax-class indicators. Bare `\btax\b` still avoided so legitimate
  // property-tax / city-tax bills route through; the explicit phrases
  // and tax-authority abbreviations (these are class identifiers,
  // analogous to "court" or "DMV") catch one-off filings.
  { name: "tax",        pattern: /\b(income\s+tax|sales\s+tax|tax\s+payment|tax\s+refund|tax\s+instal+ment|tax\s+filing|government\s+tax)\b/i },
  // Government-class one-off fees + court fees.
  { name: "government", pattern: /\b(federal\s+govt|gvt\s+of|passport|passeport|cour\s+municipal|municipal\s+court)\b/i },
  // Money-movement transfers — generic vocabulary only.
  { name: "transfer",   pattern: /\b(wire|e[\-\s]?transfer|cash\s+transfer|international\s+transfer\s+fee|direct\s+payment|mb[\-\s]?transfer)\b/i },
  // Settlement / disbursement vocabulary.
  { name: "settlement", pattern: /\b(settlement|wire\s+settlement|disbursement)\b/i },
  { name: "merchant_svc", pattern: /\b(merchant\s+svc|mrchnt|merchant\s+services)\b/i },
  { name: "fee",        pattern: /\b(cover\s+fee|service\s+fee|transfer\s+fee|atm\s+fee|nsf\s+fee|overdraft\s+fee)\b/i },
  // Payroll category — generic indicator only. Specific payroll
  // providers are recognized via the catalog if needed; here we
  // care about the class of transaction.
  { name: "payroll",    pattern: /\b(payroll|ach\s+credit|temp\s+wages|temp\s+staffing)\b/i },
  // NOTE: "AUTOPAY" was removed earlier — it signals the user
  // enrolled their bill in autopay, not a card payment to exclude.
  // We still reject literal credit-card-payment language because
  // that's internal money movement.
  { name: "card_payment", pattern: /\b(credit\s*card[^a-z]*payment|automatic\s+payment|cc\s+payment|card\s+payment|payment\s+received|payment\s+-?\s*thank|thank\s+you[^a-z]*payment)\b/i },
  // Bank-internal money movement.
  { name: "bank_internal", pattern: /\b(cd\s+deposit|certificate\s+of\s+deposit|savings\s+transfer|sweep\s+to\s+savings|investment\s+contribution|brokerage\s+transfer|round[\-\s]?up|abm\s+withdrawal|atm\s+withdrawal|bank\s+withdrawal|cash\s+sent|cash\s+withdrawal)\b/i },
  { name: "bare_generic", pattern: /^(deposit|transfer|withdrawal|debit|credit)$/i },
  // Brokerage category — the word itself is the generic signal.
  // Specific brokers come from the catalog when present; their
  // Gate-A behavior is governed by Plaid PFC primary tags
  // (INVESTMENTS) rather than this regex.
  { name: "brokerage",  pattern: /\bbrokerage\b/i },
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
  // B2B procurement / lab services. Generic category vocabulary;
  // specific vendor brands removed.
  { name: "b2b_supply", pattern: /\b((dental|medical|laboratory|optical|orthodontic|veterinary)\s+(supply|supplies|laboratory|labs?|equipment|distributor))\b/i },
  { name: "b2b_lab",    pattern: /\b(dental\s+lab|dental\s+laboratory|medical\s+lab|pathology\s+lab|optical\s+lab)\b/i },
  // Property / rent. Generic property-management vocabulary.
  { name: "rent",       pattern: /\b(property\s+group|real\s+estate|propert(?:y|ies)\s+(?:llc|inc|management)|landlord|rent\s+payment|lease\s+payment)\b/i },
  // Loan / mortgage patterns — generic category language.
  { name: "loan",       pattern: /\b(mortgage|loan|loan\s+payment|line\s+of\s+credit)\b/i },
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
// v7 / Problem 2 — Charity vocabulary, brand-name-free. Specific
// NGO/charity organization names removed; identification of named
// charities falls to the catalog (data). What remains is the
// abstract vocabulary of donation activity (relief, humanitarian,
// orphan, refugee, etc.).
const CHARITY_INDICATORS =
  /\b(donation|donor|charity|charitable|tithe|tithing|zakat|relief|humanitarian|orphan|refugee|food\s*bank|humane\s*society|nonprofit|non[\s-]?profit)\b/i;

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
  const pfcUp = (input.pfcPrimary ?? "").toUpperCase();
  if (pfcUp && PFC_PRIMARY_DENY.has(pfcUp)) {
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
  // PFC primary soft-route (LOAN_PAYMENTS). Pass but mark.
  if (pfcUp && PFC_PRIMARY_SOFT_REVIEW.has(pfcUp)) {
    return { passed: true, softReviewReason: `soft_review:pfc_${pfcUp.toLowerCase()}` };
  }
  // Descriptor soft-route patterns: pass Gate A but mark for the
  // classifier to weigh in. Without confirmation they'd land
  // needs_review by default.
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

// ─── Math-decisive confirm thresholds (v4) ──────────────────────────
//
// The cadence math + amount stability already prove recurrence for a
// large class of streams (utilities, loans, insurance, fixed-price
// subs). Before v4 the LLM could downgrade those to needs_review on a
// "not a subscription" verdict — wrong, because the LLM's question is
// about category, not recurrence. v4 introduces two thresholds:
//
//   CV_DECISIVE — coefficient of variation below this is mathematically
//                 certain recurrence (e.g. cv < 0.02 means every charge
//                 within 2% of the median). Confirmable on math alone.
//   CV_STABLE   — generous ceiling for "stable enough." Utility bills
//                 swing 30%+ between summer and winter; we still want
//                 to confirm them when a recurring_bill signal pairs
//                 with reasonably stable amounts.
//
// These mirror Fix 5 from the spec: confirm requires EITHER a
// recognized recurring-merchant match (curated catalog) OR near-zero
// CV. Streams like "Costco Gas" (cv ~0.045, no catalog hit) and
// "Amazon Marketplace" (cv ~0.087, marketplace not a sub) fail both
// gates and route to review instead of confirming on cadence luck.
const CV_DECISIVE = 0.02;
const CV_STABLE = 0.15;

// PFC tags that mean "this is a recurring bill" (utility / loan /
// insurance / mortgage / rent). Used by the math-decisive confirm path
// to whitelist these categories so they don't depend on the LLM saying
// is_subscription=true. Mirrors Fix 2: utilities + loans + insurance
// are valid recurring streams even when the LLM thinks "subscription"
// means streaming services only.
const RECURRING_BILL_PFC_PRIMARIES = new Set<string>([
  "RENT_AND_UTILITIES",
  "LOAN_PAYMENTS",
]);

// Detailed-PFC substrings that also indicate a recurring bill. Plaid
// uses these for insurance, telecom, and similar fixed obligations.
const RECURRING_BILL_PFC_DETAILED_TOKENS = [
  "INSURANCE",
  "MORTGAGE",
  "RENT",
  "UTILITIES",
  "TELEPHONE",
  "INTERNET",
  "CABLE",
];

// v7 / Problem 2 — Generic recurring-bill class vocabulary ONLY.
// Brand names removed; identity comes from the catalog and PFC tags.
// What remains describes a CATEGORY of recurring obligation
// (utilities, telecom, insurance, loans, rent, childcare) — none of
// these words identifies a specific company.
const RECURRING_BILL_DESCRIPTOR = /\b(electric|electrical|hydro|gas\s+(co|company|utility)|water\s+(util|board)|sewer|utility|utilities|mortgage|home\s+loan|auto\s+loan|car\s+loan|student\s+loan|loan\s+pmt|loan\s+payment|insurance|premium|wireless\s+pmt|cable\s+co|broadband|internet\s+(svc|service)|isp\s+payment|hoa\s+dues|childcare|daycare)\b/i;

// v7 / Problem 2 — Buy-now-pay-later (BNPL) signal, brand-name-free.
// BNPL providers historically named themselves here; brief requires
// structural detection only. The remaining vocabulary describes the
// MECHANIC ("pay in N installments") rather than the company. Pure
// brand-name descriptors without these structural tokens fall through
// to the normal classifier path (the catalog can still recognize a
// known BNPL provider by name; the engine code stays merchant-free).
const BNPL_DESCRIPTOR =
  /\b(installments?|pay\s+in\s+\d+|pay\s+in\s+(?:two|three|four|five|six)|bnpl|buy\s+now\s+pay\s+later|interest[\s-]?free\s+(?:plan|installment))\b/i;

function isRecurringBillSignal(input: ClassifyInput): boolean {
  const pfcPrimary = (input.pfcPrimary ?? "").toUpperCase();
  if (RECURRING_BILL_PFC_PRIMARIES.has(pfcPrimary)) return true;
  const pfcDetailed = (input.pfcDetailed ?? "").toUpperCase();
  for (const tok of RECURRING_BILL_PFC_DETAILED_TOKENS) {
    if (pfcDetailed.includes(tok)) return true;
  }
  const text = `${input.merchantName ?? ""} ${input.descriptor ?? ""}`;
  return RECURRING_BILL_DESCRIPTOR.test(text);
}

// Stand-alone CV computation for the classifier's confirm path. The
// existing Gate B also computes CV but its result is shadow-only; this
// is the decision-grade value.
function classifierCv(recent?: number[]): number | null {
  if (!recent || recent.length < 2) return null;
  return coefficientOfVariation(recent);
}

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

  // ─── Math-decisive confirm path (v4) ────────────────────────────
  //
  // The cadence math has already proven recurrence by the time we
  // reach this point. The decision left is "is the recurrence
  // genuine?" The LLM is the right tool for that ONLY when amount
  // stability is ambiguous. When the math is decisive — very low CV
  // or a clear recurring-bill signal with stable amounts — trust the
  // math and confirm without bothering the LLM.
  //
  // Fix 1: protects SRP / Southwest Gas / Mesa Water / Cox /
  //        Rocket Mortgage / Ally / State Farm from getting
  //        downgraded when the LLM answers "not a subscription"
  //        based on a narrow streaming-only mental model.
  // Fix 2: utilities + loans + insurance are confirmable when
  //        cv is reasonably stable, regardless of LLM.
  const cv = classifierCv(input.recentChargeCents);
  const chargeCount = input.recentChargeCents?.length ?? 0;
  const cvDecisive = cv !== null && cv < CV_DECISIVE;
  const cvStable = cv !== null && cv < CV_STABLE;
  const isCurated = input.isCuratedMerchant === true;
  const isRecurringBill = isRecurringBillSignal(input);

  // BNPL force-review. Afterpay / Klarna / Affirm / Sezzle look like
  // textbook recurring streams (fixed cadence, fixed amount) but
  // they're installment plans tied to a one-time purchase, not
  // cancellable subscriptions. Surface them so the user sees them,
  // never auto-confirm — they don't belong in the "what can I cut"
  // bucket.
  if (BNPL_DESCRIPTOR.test(text)) {
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [...shadowSignals, "bnpl_installment_review"],
    };
  }

  // cvDecisive auto-confirm requires at least 3 charges. Two
  // near-identical fares 30 days apart (e.g. Lyft rides at $14.50 and
  // $14.65) hit cv<0.02 by coincidence — with only 2 data points
  // we can't tell a coincidence from a real subscription. ≥3 charges
  // is the floor for treating low CV as decisive evidence.
  const CV_DECISIVE_MIN_CHARGES = 3;
  if (cvDecisive && chargeCount >= CV_DECISIVE_MIN_CHARGES) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: [
        ...shadowSignals,
        "math_confirmed:cv_decisive",
        `cv:${cv!.toFixed(3)}`,
        `n:${chargeCount}`,
      ],
    };
  }
  if (isRecurringBill && cvStable) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: [
        ...shadowSignals,
        "math_confirmed:recurring_bill",
        `cv:${cv!.toFixed(3)}`,
      ],
    };
  }
  // v7 / Problem 5 — Registry single-hit confirm.
  // A curated catalog match with only ONE observed charge (cv===null)
  // is enough evidence to CONFIRM, not just review. Per brief:
  // "registry/source match MUST be promotable to confirm, not capped
  // at review." This is the cadence-relative-floor manifestation for
  // long-cadence subs — an annual renewal in a 6-month window
  // legitimately shows up once, and a hand-vetted catalog entry is
  // the supporting signal that promotes it past the LLM's caution.
  if (isCurated && cv === null) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: [
        ...shadowSignals,
        "registry_single_hit_confirm",
      ],
    };
  }
  if (isCurated && cvStable) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: [
        ...shadowSignals,
        "math_confirmed:curated_stable",
        `cv:${cv!.toFixed(3)}`,
      ],
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
    // v5 — tightened independent-signal requirement. The LLM saying
    // "yes" with high confidence still isn't enough on its own; we
    // now also reject the case where amount variance is too high for
    // a subscription-grade catalog merchant. Conditions:
    //
    //   • curated subscription-grade merchant AND (1 charge OR
    //     stable cv) — single-hit registry rescues confirm (cv null)
    //     and multi-hit stable amounts confirm. Multi-hit with high
    //     amount variance (Amazon Prime $117–$237 from product
    //     purchases bleeding into the membership stream) routes to
    //     review instead.
    //   • mathematically decisive recurrence AND ≥3 charges — kills
    //     2-fare coincidences (Lyft case) while preserving real
    //     low-cv streams (Netflix, Spotify) at any reasonable history.
    //   • recurring_bill descriptor pattern + stable cv — covers
    //     utilities, loans, insurance, mortgage payments.
    //
    // This kills the four false positives from transactions2:
    //   - Amazon (catalog "other", isCurated=false) → no signal
    //   - Amazon Prime (catalog streaming, isCurated=true but
    //     cvStable=false at cv 0.20) → no signal
    //   - Lyft (isCurated=false, cvDecisive but len=2) → no signal
    //   - Costco Gas / Amazon Marketplace pattern from earlier work
    //     remains gated as before.
    const hasIndependentSignal =
      (isCurated && (cv === null || cvStable)) ||
      (cvDecisive && chargeCount >= CV_DECISIVE_MIN_CHARGES) ||
      (isRecurringBill && cvStable);
    if (hasIndependentSignal) {
      return {
        decision: "confirm",
        classification: "confirmed",
        score: b.score,
        signals: [
          ...shadowSignals,
          "llm_confirmed",
          confSignal,
          tierSignal,
          reasonSignal,
          cv !== null ? `cv:${cv.toFixed(3)}` : "cv:na",
        ],
        llm: llmResp,
      };
    }
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [
        ...shadowSignals,
        "llm_yes_no_independent_signal",
        confSignal,
        tierSignal,
        reasonSignal,
        cv !== null ? `cv:${cv.toFixed(3)}` : "cv:na",
      ],
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

// ---------- Classifier brain (v3) ----------
//
// v3 architectural shift: Claude returns the tier directly. We stopped
// preprocessing (no LLM resolver, no PFC priors, no dictionary boost,
// no tier-assignment math). Plaid's merchant_name is the identity
// signal. The classifier sees raw candidate context and produces a
// trusted verdict.
//
// Pin the prompt + model version into the snapshot so replay can
// prove it's reading the same verdicts. Bump on any prompt change.
export const CLASSIFY_LLM_VERSION = "classify-v3-haiku-4-5-20251001";

export const CLASSIFY_SYSTEM_PROMPT = `You are the classifier brain for a personal-finance app that detects recurring charges. You receive a candidate recurring stream and decide which tier it belongs to. Use your world knowledge to identify merchants — descriptors are noisy bank-statement strings (billing suffixes, store numbers, processor prefixes).

TIERS
- confirmed_subscription: ongoing access to a digital service or membership the user pays for on a recurring schedule. Streaming, software / SaaS, cloud storage, productivity tools, AI tools, VPNs, news / magazines, gym memberships, learning platforms, password managers, paid newsletters. The user thinks of these as "things I'm subscribed to."
- recurring_bill: regular obligation the user thinks of as a bill, not a subscription. Utilities (electric, gas, water), telecom (carriers, ISPs, cable, mobile), insurance (auto, health, home, life, renters), rent, mortgage, car loans, student loans, credit card autopay loans, childcare / daycare, security monitoring, HOA dues, property taxes paid monthly.
- recurring_commerce: recurring spending pattern at merchants where each charge is a discrete purchase, NOT ongoing access. Coffee shops, fast food, restaurants, pharmacies, gas stations, grocery, big-box retail, ride-share, food delivery, beauty / salons, clothing stores. The merchant might be visited regularly but each transaction is its own purchase.
- uncertain_recurring: cannot identify the merchant confidently, or the descriptor looks like internal bank movement, generic noise, or money transfer.

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
