// Findings aggregator — unifies the engine's existing signals into
// a single verb-led feed for the "Frugavo noticed" surface.
//
// Sources combined (read-only, no engine changes):
//   • MoneyLeak[]             (lib/money-leaks.ts)
//   • ShockInsight[]          (lib/insights.ts)
//   • ConcentrationInsight    (lib/intelligence/concentration.ts)
//
// Output: Finding[] with a verb-led headline, plain-language
// conclusion, confidence tier (High/Medium/Low — see CONFIDENCE
// NOTE below), why-we-think reasoning, and a potential-impact line.
//
// CONFIDENCE NOTE:
//   The engine does NOT currently model "this finding will hold with
//   confidence Y." We have per-subscription confidence (Phase F
//   Claude verdict) but no per-finding score. Per spec, we render a
//   three-tier label and leave a TODO for a real score:
//
//   TODO(confidence): wire a real finding-level confidence signal.
//     Inputs we'd want: source-data sample size (e.g. number of
//     charges observed), classifier confidence on contributing subs,
//     time-stability of the pattern (newer = lower confidence).
//
// Tone words enforced — one verb per finding:
//   "We found …"     — duplicates, money leaks present today
//   "We're watching…" — at-risk subs not yet a problem
//   "We noticed …"   — observations / patterns
//   "We predict …"   — temporal predictions (renewals)

import type { MoneyLeak } from "@/lib/money-leaks";
import type { ShockInsight } from "@/lib/insights";
import type { ConcentrationInsight } from "@/lib/intelligence/concentration";

export type FindingKind =
  | "duplicate"
  | "overlap"
  | "dormant"
  | "price_increase"
  | "rising_spend"
  | "concentration"
  | "biggest_billing_day"
  | "highest_single_charge"
  | "ai_vs_streaming"
  | "top_three_vs_threshold"
  | "longest_running";

export type ConfidenceTier = "high" | "medium" | "low";

export type Finding = {
  // Stable id derived from the source signal — used for routing to
  // /app/noticed/[id] and for feedback writes.
  id: string;
  kind: FindingKind;
  // Verb-led short headline. ONE verb word per spec.
  headline: string;
  // Plain-language sentence describing what this means. NEVER a raw
  // stat — phrased as a conclusion (e.g. "Software now drives 58%
  // of your spend").
  conclusion: string;
  // One-sentence reasoning. Appears as "Why we think this:" in the UI.
  why: string;
  // Dollar/year impact when applicable, OR a risk note. Optional.
  potentialImpactLabel?: string;
  // Confidence tier — High/Medium/Low. The percent column is
  // intentionally absent at this layer per spec.
  confidence: ConfidenceTier;
  // Severity for sort order. 0 = lowest, 2 = highest.
  severity: 0 | 1 | 2;
  // Reference to source subscription ids when known (for resolve UI
  // to surface the underlying charges).
  subscriptionIds: string[];
};

export type FindingsInput = {
  moneyLeaks: MoneyLeak[];
  shockInsights: ShockInsight[];
  concentration: ConcentrationInsight | null;
};

// ─── tier mapping helpers ─────────────────────────────────────

// Severity → tier mapping is conservative. Most findings start at
// "medium" because we don't yet have a quantitative score.
function severityToConfidence(sev: "low" | "medium" | "high"): ConfidenceTier {
  // TODO(confidence): replace with a real per-finding score.
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  return "low";
}

function moneyLeakKindToFindingKind(k: MoneyLeak["kind"]): FindingKind {
  switch (k) {
    case "overlapping_ai_tools":
      return "overlap";
    case "dormant_subscription":
      return "dormant";
    case "price_creep":
      return "price_increase";
    case "rising_monthly_spend":
      return "rising_spend";
  }
}

// Verb selector. "We found / We're watching / We noticed / We predict"
function verbForKind(kind: FindingKind): string {
  switch (kind) {
    case "duplicate":
    case "overlap":
    case "dormant":
      return "We found";
    case "price_increase":
    case "rising_spend":
      return "We noticed";
    case "concentration":
    case "biggest_billing_day":
    case "highest_single_charge":
    case "ai_vs_streaming":
    case "top_three_vs_threshold":
    case "longest_running":
      return "We noticed";
  }
}

// Severity to numeric for sort.
function severityRank(sev: "low" | "medium" | "high"): 0 | 1 | 2 {
  if (sev === "high") return 2;
  if (sev === "medium") return 1;
  return 0;
}

// ─── main composer ────────────────────────────────────────────

export function composeFindings(input: FindingsInput): Finding[] {
  const out: Finding[] = [];

  // 1. Money leaks
  for (const m of input.moneyLeaks) {
    const kind = moneyLeakKindToFindingKind(m.kind);
    const verb = verbForKind(kind);
    out.push({
      id: `leak:${m.id}`,
      kind,
      // Re-cast as verb-led. Money leak headlines today read like
      // "Netflix went from $15.49 to $17.99" — we prepend the verb.
      headline: `${verb} — ${m.headline}`,
      conclusion: m.detail,
      why: whyForMoneyLeak(m.kind),
      potentialImpactLabel: impactForMoneyLeak(m),
      confidence: severityToConfidence(m.severity),
      severity: severityRank(m.severity),
      subscriptionIds: m.source.subscription_ids ?? [],
    });
  }

  // 2. Shock insights — pattern observations
  for (const s of input.shockInsights) {
    const kind = shockKindToFindingKind(s.kind);
    if (!kind) continue;
    const verb = verbForKind(kind);
    out.push({
      id: `shock:${s.id}`,
      kind,
      headline: `${verb} — ${s.headline}`,
      conclusion: s.detail,
      why: whyForShock(s.kind),
      potentialImpactLabel: undefined,
      // Shock insights have no severity field; treat as medium.
      confidence: "medium",
      severity: 1,
      subscriptionIds: s.source.subscription_ids ?? [],
    });
  }

  // 3. Concentration — at most one per render. Phrased as a
  // conclusion per spec: "Software now drives 58% of your spend."
  if (input.concentration && input.concentration.tone !== "neutral") {
    // The concentration insight already returns a headline + detail
    // crafted to read as a conclusion. We pass through with the
    // "We noticed" verb prepended.
    const c = input.concentration;
    out.push({
      id: "concentration:dashboard",
      kind: "concentration",
      headline: `We noticed — ${c.headline}`,
      conclusion: c.detail,
      why:
        "A single category becoming dominant means one price increase " +
        "or service change moves the whole monthly total. We track " +
        "concentration so you can act before that happens.",
      potentialImpactLabel:
        c.tone === "attention"
          ? "Risk: a single price hike hits harder"
          : undefined,
      confidence: c.tone === "attention" ? "high" : "medium",
      severity: c.tone === "attention" ? 2 : 1,
      subscriptionIds: [],
    });
  }

  // Sort by severity desc, then by source order (preserved by the
  // engine for tie-breaking).
  out.sort((a, b) => b.severity - a.severity);

  return out;
}

// ─── reasoning text per kind ──────────────────────────────────

function whyForMoneyLeak(k: MoneyLeak["kind"]): string {
  switch (k) {
    case "overlapping_ai_tools":
      return "Two AI subscriptions billing the same month for similar capabilities — typical sign of an unused trial converting.";
    case "dormant_subscription":
      return "No matching activity in the recent months, but the charges are still landing.";
    case "price_creep":
      return "The most recent charge is materially higher than the trailing median for this merchant.";
    case "rising_monthly_spend":
      return "Three of the last four months show a higher recurring total than the prior trailing average.";
  }
}

function impactForMoneyLeak(m: MoneyLeak): string | undefined {
  // We don't have a structured yearly_savings number on MoneyLeak
  // today. Surface a qualitative risk note instead.
  // TODO(confidence): add yearly_savings_cents to MoneyLeak in the
  //   engine, then surface here as "Potential impact: $X/yr".
  switch (m.kind) {
    case "overlapping_ai_tools":
      return "Potential impact: one of these can probably go";
    case "dormant_subscription":
      return "Potential impact: paying for something you don't use";
    case "price_creep":
      return "Potential impact: each cycle now costs more";
    case "rising_monthly_spend":
      return "Potential impact: monthly total trending up";
  }
}

function shockKindToFindingKind(k: ShockInsight["kind"]): FindingKind | null {
  switch (k) {
    case "ai_vs_streaming":
      return "ai_vs_streaming";
    case "top_three_vs_threshold":
      return "top_three_vs_threshold";
    case "biggest_billing_day":
      return "biggest_billing_day";
    case "growth_over_time":
      return "rising_spend";
    case "category_dominance":
      return "concentration";
    case "highest_single_charge":
      return "highest_single_charge";
    case "longest_running":
      return "longest_running";
  }
}

function whyForShock(k: ShockInsight["kind"]): string {
  switch (k) {
    case "ai_vs_streaming":
      return "Your AI tools now cost more per month than your media subscriptions. That category shift is recent and worth knowing.";
    case "top_three_vs_threshold":
      return "Three subscriptions account for most of your recurring spend, which means most savings live in those three.";
    case "biggest_billing_day":
      return "Multiple subscriptions billing on the same calendar day — a single statement spike rather than a flat monthly load.";
    case "growth_over_time":
      return "Comparing the trailing-12 average to the recent quarter, your recurring spend is materially higher than it used to be.";
    case "category_dominance":
      return "One category now exceeds 50% of your recurring spend. Single point of price-risk exposure.";
    case "highest_single_charge":
      return "Your largest single recurring charge represents a meaningful share of the monthly total.";
    case "longest_running":
      return "A subscription you've been paying continuously for a long time — worth periodic confirmation it's still useful.";
  }
}
