// Findings aggregator — unifies the engine's existing signals into
// a single verb-led feed for the "Frugavo noticed" surface.
//
// Sources combined (read-only, no engine changes):
//   • MoneyLeak[]             (lib/money-leaks.ts)
//   • ShockInsight[]          (lib/insights.ts)
//   • ConcentrationInsight    (lib/intelligence/concentration.ts)
//   • ActionItem[] context    (subscription confidence + history)
//
// Output: Finding[] with verb-led headline, plain-language
// conclusion, confidence score (0..1, derived from real engine
// signals — see CONFIDENCE COMPUTATION below), "why we think this"
// reasoning, and a potential-impact line.
//
// CONFIDENCE COMPUTATION:
//
//   Each finding's score is computed from three real engine signals:
//
//   1. Source-data sample size
//      How many historical observations back this finding. For
//      MoneyLeak: count of charges across contributing subs. For
//      Shock: contributing subs count. More observations = more
//      stable signal.
//
//   2. Classifier confidence on contributing subs
//      Average sub.confidence (Phase F Claude verdict score) across
//      the subs this finding references. When the engine isn't sure
//      these are real recurring subs, we shouldn't be sure about
//      findings derived from them.
//
//   3. Severity escalation
//      MoneyLeak.severity ('low'/'medium'/'high') is the engine's
//      qualitative read on how worrying the finding is. We treat
//      this as a modest confidence boost.
//
//   Formula:
//      base       = avg(sub.confidence)        // 0..1, default 0.5
//      sampleBoost = min(1, samples / 6)       // full credit at 6
//      sevBoost    = 0.0 / 0.05 / 0.10 by sev  // small lift
//      probability = clamp(base * 0.65 + sampleBoost * 0.25 + sevBoost, 0, 1)
//
//   Tier boundaries:
//      ≥ 0.80  → "high"
//      ≥ 0.55  → "medium"
//      < 0.55  → "low"
//
// Tone words enforced — one verb per finding:
//   "We found …"     — duplicates, money leaks present today
//   "We're watching…" — at-risk subs not yet a problem
//   "We noticed …"   — observations / patterns
//   "We predict …"   — temporal predictions (renewals)

import type { MoneyLeak } from "@/lib/money-leaks";
import type { ShockInsight } from "@/lib/insights";
import type { ConcentrationInsight } from "@/lib/intelligence/concentration";
import type { ActionItem } from "@/lib/selectors/dashboard";

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
  // Plain-language sentence describing what this means.
  conclusion: string;
  // One-sentence reasoning. Rendered as "Why we think this:" in UI.
  why: string;
  // Dollar/year impact when applicable, OR a risk note. Optional.
  potentialImpactLabel?: string;
  // Numeric confidence — derived from real engine signals (see file
  // header for the formula). 0..1 range.
  confidence: number;
  // Cached tier from the numeric confidence above. Convenience for
  // UI rendering; can be recomputed from confidence at any time.
  confidenceTier: ConfidenceTier;
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
  // ActionItem context — used to look up sub.confidence and
  // months_observed for the contributing subscriptions of each
  // finding. Pass any action items; we'll match by subscription_id.
  // Optional for back-compat; when absent, confidence falls back to
  // severity-based heuristics.
  actionItems?: ActionItem[];
  // Resolved finding ids — anything in this set is filtered out of
  // the returned list. Used by /app/noticed and the home featured
  // card so a Look-into-it / Looks-fine resolution removes the
  // finding from the feed immediately.
  resolvedFindingIds?: Set<string>;
};

// ─── confidence score ─────────────────────────────────────────

function probabilityToTier(p: number): ConfidenceTier {
  if (p >= 0.8) return "high";
  if (p >= 0.55) return "medium";
  return "low";
}

// Average sub.confidence across subscription_ids that exist in the
// ActionItem index. Returns 0.5 when no overlap (unknown stance).
function averageContributingConfidence(
  subscriptionIds: string[],
  actionIndex: Map<string, ActionItem>
): number {
  if (subscriptionIds.length === 0) return 0.5;
  const vals: number[] = [];
  for (const sid of subscriptionIds) {
    const a = actionIndex.get(sid);
    if (a && a.confidence !== null && a.confidence !== undefined) {
      vals.push(a.confidence);
    }
  }
  if (vals.length === 0) return 0.5;
  return vals.reduce((acc, v) => acc + v, 0) / vals.length;
}

// Sum months_observed across contributing subs — proxy for sample
// size. The cap is 12 per sub already in dashboard.ts.
function totalSampleSize(
  subscriptionIds: string[],
  actionIndex: Map<string, ActionItem>
): number {
  if (subscriptionIds.length === 0) return 0;
  let total = 0;
  for (const sid of subscriptionIds) {
    const a = actionIndex.get(sid);
    if (a) total += a.months_observed ?? 0;
  }
  return total;
}

function computeFindingConfidence(args: {
  subscriptionIds: string[];
  actionIndex: Map<string, ActionItem>;
  severity: "low" | "medium" | "high";
}): number {
  const base = averageContributingConfidence(args.subscriptionIds, args.actionIndex);
  const samples = totalSampleSize(args.subscriptionIds, args.actionIndex);
  const sampleBoost = Math.min(1, samples / 6); // full credit at 6 months total
  const sevBoost =
    args.severity === "high" ? 0.1 : args.severity === "medium" ? 0.05 : 0;
  const score = base * 0.65 + sampleBoost * 0.25 + sevBoost;
  return Math.max(0, Math.min(1, score));
}

// ─── kind mapping ─────────────────────────────────────────────

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

// Returns a short label for the kind — used as an eyebrow chip on
// finding cards. Reduces the "We found / Frugavo noticed" prefix
// repetition by letting the headline stand on its own and the
// kind chip carry the categorization.
export function kindLabel(kind: FindingKind): string {
  return verbForKind(kind);
}
function verbForKind(kind: FindingKind): string {
  switch (kind) {
    case "duplicate":
    case "overlap":
      return "Overlap found";
    case "dormant":
      return "Likely forgotten";
    case "price_increase":
      return "Price up";
    case "rising_spend":
      return "Trending higher";
    case "concentration":
      return "Concentration";
    case "biggest_billing_day":
      return "Billing spike";
    case "highest_single_charge":
      return "Biggest charge";
    case "ai_vs_streaming":
      return "AI now bigger";
    case "top_three_vs_threshold":
      return "Top three";
    case "longest_running":
      return "Long-running";
  }
}

function severityRank(sev: "low" | "medium" | "high"): 0 | 1 | 2 {
  if (sev === "high") return 2;
  if (sev === "medium") return 1;
  return 0;
}

// ─── main composer ────────────────────────────────────────────

export function composeFindings(input: FindingsInput): Finding[] {
  const out: Finding[] = [];
  const actionIndex = new Map<string, ActionItem>();
  for (const a of input.actionItems ?? []) {
    actionIndex.set(a.subscription_id, a);
  }
  const resolved = input.resolvedFindingIds ?? new Set<string>();

  // 1. Money leaks
  for (const m of input.moneyLeaks) {
    const id = `leak:${m.id}`;
    if (resolved.has(id)) continue;
    const kind = moneyLeakKindToFindingKind(m.kind);
    const subscriptionIds = m.source.subscription_ids ?? [];
    const confidence = computeFindingConfidence({
      subscriptionIds,
      actionIndex,
      severity: m.severity,
    });
    out.push({
      id,
      kind,
      // Headline stands on its own — no prepended verb. The kind
      // label (verbForKind) is rendered as a tiny eyebrow chip in
      // the noticed feed instead, keeping each finding readable.
      headline: m.headline,
      conclusion: m.detail,
      why: whyForMoneyLeak(m.kind),
      potentialImpactLabel: impactForMoneyLeak(m),
      confidence,
      confidenceTier: probabilityToTier(confidence),
      severity: severityRank(m.severity),
      subscriptionIds,
    });
  }

  // 2. Shock insights — pattern observations
  for (const s of input.shockInsights) {
    const id = `shock:${s.id}`;
    if (resolved.has(id)) continue;
    const kind = shockKindToFindingKind(s.kind);
    if (!kind) continue;
    const subscriptionIds = s.source.subscription_ids ?? [];
    // Shock insights don't carry a severity field; treat as medium.
    const confidence = computeFindingConfidence({
      subscriptionIds,
      actionIndex,
      severity: "medium",
    });
    out.push({
      id,
      kind,
      headline: s.headline,
      conclusion: s.detail,
      why: whyForShock(s.kind),
      potentialImpactLabel: undefined,
      confidence,
      confidenceTier: probabilityToTier(confidence),
      severity: 1,
      subscriptionIds,
    });
  }

  // 3. Concentration — at most one per render. Phrased as conclusion.
  if (input.concentration && input.concentration.tone !== "neutral") {
    const id = "concentration:dashboard";
    if (!resolved.has(id)) {
      const c = input.concentration;
      // Concentration has no contributing subscription_ids, but it
      // does have a quantifiable signal: the headline implies a
      // dominant category. We treat the tone as severity and rely
      // entirely on the sevBoost + a neutral base.
      const confidence = computeFindingConfidence({
        subscriptionIds: [],
        actionIndex,
        severity: c.tone === "attention" ? "high" : "medium",
      });
      out.push({
        id,
        kind: "concentration",
        headline: c.headline,
        conclusion: c.detail,
        why:
          "A single category becoming dominant means one price increase " +
          "or service change moves the whole monthly total. We track " +
          "concentration so you can act before that happens.",
        potentialImpactLabel:
          c.tone === "attention"
            ? "Risk: a single price hike hits harder"
            : undefined,
        confidence,
        confidenceTier: probabilityToTier(confidence),
        severity: c.tone === "attention" ? 2 : 1,
        subscriptionIds: [],
      });
    }
  }

  // Sort by severity desc, then by confidence desc within a tier.
  out.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return b.confidence - a.confidence;
  });

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
