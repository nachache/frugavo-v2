// Layered subscription classifier.
//
// Replaces the weak single-regex filter with three gates. A Plaid
// stream becomes a confirmed subscription only if it passes ALL of:
//
//   Gate A — Hard denylist
//     Plaid personal_finance_category primary in {TRANSFER_IN,
//     TRANSFER_OUT, LOAN_PAYMENTS, BANK_FEES, INCOME, TAX} → reject.
//     PFC detailed contains TAX_PAYMENT / ACCOUNT_TRANSFER / WIRE /
//     THIRD_PARTY_PAYMENT / CASH_ADVANCE / INTEREST / OVERDRAFT → reject.
//     Raw descriptor or cleaned name matches the descriptor deny regex
//     (tax, settlement, government, transfer, payroll, mortgage, loan,
//     vendor invoice patterns, 9+ digit account numbers, etc.) → reject.
//
//   Gate B — Subscription-positive scoring (must score >= 2)
//     +1 valid frequency (WEEKLY|SEMI_MONTHLY|MONTHLY|ANNUALLY).
//         UNKNOWN frequency immediately disqualifies — returns score -1.
//     +1 stable amount (coefficient of variation <= 0.15 on charge history).
//     +1 status === MATURE and is_active === true.
//     +1 PFC primary in {ENTERTAINMENT, RENT_AND_UTILITIES,
//         GENERAL_SERVICES, PERSONAL_CARE} OR the merchant resolves to
//         a known SaaS / streaming / telecom / utility domain.
//
//   Gate C — LLM tiebreak (only for score == 2)
//     Calls Haiku with the strict-JSON classify contract. On confidence
//     >= 0.6 and is_subscription === true → confirm. Otherwise → review.
//     On timeout or any error → review (we never auto-confirm on
//     uncertainty).
//
// Charity/donation override: descriptors that look like charitable
// giving (UNRWA, SOS Children's Villages, Ottawa Humane Society, etc.)
// are forced to needs_review regardless of mechanical score. Plaid's
// PFC bucket for these is usually GENERAL_SERVICES which would
// otherwise score 4 and auto-confirm.
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

export type LlmClassifyResponse = {
  merchant: string;
  category: string;
  domain: string;
  is_subscription: boolean;
  confidence: number;
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

// The descriptor deny regex from the spec, split into named groups so
// the verify harness can tell WHICH pattern fired and we can spot
// regressions per category.
const DESCRIPTOR_DENY_GROUPS: { name: string; pattern: RegExp }[] = [
  { name: "tax",        pattern: /\b(tax|gst|hst|cra)\b/i },
  { name: "government", pattern: /\b(govern|federal\s+govt|gvt\s+of)\b/i },
  { name: "transfer",   pattern: /\b(wire|e[\-\s]?transfer|cash\s+transfer|interac|international\s+transfer\s+fee|direct\s+payment)\b/i },
  { name: "settlement", pattern: /\b(settlement|sd\s+settlement)\b/i },
  { name: "merchant_svc", pattern: /\b(merchant\s+svc|mrchnt|merchant\s+services)\b/i },
  { name: "fee",        pattern: /\b(cover\s+fee)\b/i },
  { name: "payroll",    pattern: /\bpayroll\b/i },
  { name: "loan",       pattern: /\b(mortgage|loan|bdc|banque\s+developpement|loan\s+payment)\b/i },
  { name: "vendor",     pattern: /\b(property\s+group|holdings?|invoice|payment\s+to)\b/i },
  { name: "transfer_to_account", pattern: /\bpc\s+to\s+\d/i },
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

export type GateAResult = { passed: true } | { passed: false; reason: string };

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

export async function classifyStream(
  input: ClassifyInput,
  llm?: LlmCallback
): Promise<ClassifyResult> {
  // A
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

  // B
  const b = gateB(input);
  if (b.disqualified) {
    return {
      decision: "reject",
      classification: null,
      score: 0,
      signals: b.signals,
      rejectReason: "gateB_disqualified",
    };
  }

  // Charity override — applies regardless of mechanical score.
  const text = `${input.merchantName ?? ""} ${input.descriptor ?? ""}`;
  const isCharity = CHARITY_INDICATORS.test(text);
  if (isCharity) {
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [...b.signals, "charity_override"],
    };
  }

  if (b.score >= 3) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: b.signals,
    };
  }

  if (b.score <= 1) {
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: b.signals,
    };
  }

  // Score == 2 → LLM tiebreak
  if (!llm) {
    return {
      decision: "review",
      classification: "needs_review",
      score: b.score,
      signals: [...b.signals, "no_llm_available"],
    };
  }
  let llmResp: LlmClassifyResponse | null = null;
  try {
    llmResp = await llm(input);
  } catch {
    llmResp = null;
  }
  if (
    llmResp &&
    llmResp.is_subscription === true &&
    typeof llmResp.confidence === "number" &&
    llmResp.confidence >= 0.6
  ) {
    return {
      decision: "confirm",
      classification: "confirmed",
      score: b.score,
      signals: [...b.signals, `llm_confirmed:${llmResp.confidence.toFixed(2)}`],
      llm: llmResp,
    };
  }
  return {
    decision: "review",
    classification: "needs_review",
    score: b.score,
    signals: [
      ...b.signals,
      llmResp
        ? `llm_low_confidence:${(llmResp.confidence ?? 0).toFixed(2)}`
        : "llm_timeout",
    ],
    llm: llmResp ?? null,
  };
}

// ---------- LLM prompt for the tiebreak ----------

export const CLASSIFY_SYSTEM_PROMPT = `You classify bank transactions as subscriptions or not.

Return STRICT JSON, no prose, matching:
{ "merchant": string, "category": string, "domain": string, "is_subscription": boolean, "confidence": 0-1 }

A subscription is a recurring service the cardholder actively pays for ongoing access (streaming, software, telecom, utilities, gym, memberships).

It is NOT: taxes, government payments, transfers, loan/mortgage payments, settlements, merchant-acquirer deposits, charitable donations, one-off purchases at restaurants/shops/gas stations, or business vendor invoices.

If you cannot tell, set is_subscription=false and confidence<=0.5.`;

export function classifyUserPrompt(input: ClassifyInput): string {
  return [
    `Descriptor: "${input.descriptor}"`,
    `Plaid category: "${input.pfcDetailed ?? input.pfcPrimary ?? "unknown"}"`,
    `Avg amount: ${(input.avgAmountCents / 100).toFixed(2)}`,
    `Frequency: ${input.frequency ?? "unknown"}`,
  ].join("\n");
}
