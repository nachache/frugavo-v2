// Tier assignment — pure function that resolves a detected recurring
// stream into ONE of the 4 semantic tiers + a 0-100 confidence score.
//
// This is the single source of truth for "what kind of thing is
// this?" The dashboard, reveal, personality calc, money-leaks,
// protection insights, share card, and the collapsed "spending
// patterns" accordion all read from the (recurring_type,
// confidence_score) fields this function produces.
//
// Tiers:
//   confirmed_subscription — surfacing-safe consumer subscription
//   recurring_bill         — utilities/telecom/insurance/rent
//   recurring_commerce     — recurring spend patterns (CVS, gas, food)
//   uncertain_recurring    — internal-only, hidden from all surfaces
//
// Inputs combine:
//   - The existing classifier's verdict (accept/needs_review)
//   - The scored log-odds from scoring.ts (Beta prior + pattern)
//   - The merchant-category prior from PFC tags
//   - A small set of guardrails (e.g. user-rejected stays uncertain)
//
// Determinism: same inputs → same output. No I/O, no Date.now().

import { categoryPrior, type RecurringTier } from "@/lib/merchant-category-priors";
import { sigmoid } from "@/lib/scoring";

export type TierInput = {
  // The downstream classifier's verdict — what landed in the
  // `classification` column today.
  classification: "confirmed" | "needs_review";
  // Plaid PFC tags from the representative transaction.
  pfc_primary?: string | null;
  pfc_detailed?: string | null;
  // Combined log-odds from scoring.ts (Beta prior + pattern features).
  // Higher = more confident the merchant is a recurring obligation.
  // If you don't have it, pass 0 (neutral).
  combined_log_odds: number;
  // True iff merchant_key is in the seeded subscription dictionary.
  // Dictionary membership is a strong positive signal that overrides
  // ambiguous PFC tags — e.g. Apple is tagged GENERAL_MERCHANDISE
  // by Plaid (because Apple sells phones) but iCloud subs are real
  // subscriptions. The boost flag lets us trust the catalog without
  // hardcoding individual merchant names in the tier-assignment.
  in_dictionary?: boolean;
  // Hard user override, if any. Wins outright.
  user_override?:
    | "confirmed"
    | "not_subscription"
    | "not_recurring"
    | "cancelled"
    | "wrong_amount"
    | "wrong_cadence"
    | null;
};

export type TierResult = {
  recurring_type:
    | "confirmed_subscription"
    | "recurring_bill"
    | "recurring_commerce"
    | "uncertain_recurring";
  confidence_score: number; // 0-100
  // For audit. The per-tier log-odds we considered.
  tier_log_odds: Record<RecurringTier, number>;
  // Why this tier won (or didn't).
  reason: string;
};

// Threshold under which we collapse to uncertain_recurring regardless
// of which tier scored highest. Calibrated to feel "trustworthy" —
// users would rather see fewer items they recognize than more items
// they don't.
const MIN_SURFACING_CONFIDENCE = 50;

// Confidence boost applied when the Beta-merchant prior strongly
// agrees with the tier choice. Caps below 100.
const MAX_CONFIDENCE = 99;

export function assignTier(input: TierInput): TierResult {
  // ---- Hard user-override paths ----
  // Negative feedback always demotes to uncertain. Even if the
  // pattern is perfect, the user has explicitly said "this isn't a
  // subscription." Respect that across all surfaces.
  if (
    input.user_override === "not_subscription" ||
    input.user_override === "not_recurring"
  ) {
    return {
      recurring_type: "uncertain_recurring",
      confidence_score: 0,
      tier_log_odds: { confirmed_subscription: 0, recurring_bill: 0, recurring_commerce: 0 },
      reason: `user_override:${input.user_override}`,
    };
  }
  // Positive feedback locks the tier to confirmed_subscription at
  // max confidence.
  if (
    input.user_override === "confirmed" ||
    input.user_override === "wrong_amount" ||
    input.user_override === "wrong_cadence"
  ) {
    return {
      recurring_type: "confirmed_subscription",
      confidence_score: MAX_CONFIDENCE,
      tier_log_odds: { confirmed_subscription: 0, recurring_bill: 0, recurring_commerce: 0 },
      reason: `user_override:${input.user_override}`,
    };
  }

  // ---- needs_review → uncertain ----
  // The classifier already said it wasn't sure. We don't promote to
  // a real tier just because PFC happened to match — we wait for
  // user confirmation or more data.
  if (input.classification === "needs_review") {
    return {
      recurring_type: "uncertain_recurring",
      confidence_score: clamp(Math.round(sigmoid(input.combined_log_odds) * 60), 30, 49),
      tier_log_odds: { confirmed_subscription: 0, recurring_bill: 0, recurring_commerce: 0 },
      reason: "classifier_needs_review",
    };
  }

  // ---- confirmed: pick a tier ----
  const prior = categoryPrior(input.pfc_primary, input.pfc_detailed);

  // Dictionary boost. If the merchant is in the seeded subscription
  // dictionary (Netflix, Spotify, Apple, Amazon Prime, Adobe, Notion,
  // OpenAI, ChatGPT, etc.) we add +2.5 to the subscription tier and
  // demote the commerce tier by -1.0. This is enough to overcome a
  // mis-tagged GENERAL_MERCHANDISE PFC without being absolute — a
  // user override still wins. The dictionary itself is data-driven
  // (lib/data/merchant-catalog.json) so this isn't a hardcoded
  // whitelist in the classifier.
  const dictBoost = input.in_dictionary === true ? 2.5 : 0;
  const dictCommercePenalty = input.in_dictionary === true ? -1.0 : 0;

  // The combined log-odds tells us how strongly the stream behaves
  // like a recurring obligation. We add the per-tier category shift
  // to redistribute that confidence across the 3 surfacing tiers.
  const tierLogOdds: Record<RecurringTier, number> = {
    confirmed_subscription:
      input.combined_log_odds + prior.confirmed_subscription + dictBoost,
    recurring_bill: input.combined_log_odds + prior.recurring_bill,
    recurring_commerce:
      input.combined_log_odds + prior.recurring_commerce + dictCommercePenalty,
  };

  // Pick the highest-scoring tier.
  let bestTier: RecurringTier = "confirmed_subscription";
  let bestLO = tierLogOdds.confirmed_subscription;
  for (const tier of ["recurring_bill", "recurring_commerce"] as RecurringTier[]) {
    if (tierLogOdds[tier] > bestLO) {
      bestTier = tier;
      bestLO = tierLogOdds[tier];
    }
  }

  // Convert log-odds → probability → 0-100 confidence.
  const probability = sigmoid(bestLO);
  let confidence = Math.round(probability * 100);
  if (confidence > MAX_CONFIDENCE) confidence = MAX_CONFIDENCE;

  // Guardrail: if the strongest tier still didn't clear the surfacing
  // threshold, collapse to uncertain. This catches edge cases where
  // a charge regularly recurs but PFC says "TRANSFER" / "TAX" /
  // "INCOME" or all three tier scores went negative.
  if (confidence < MIN_SURFACING_CONFIDENCE) {
    return {
      recurring_type: "uncertain_recurring",
      confidence_score: confidence,
      tier_log_odds: tierLogOdds,
      reason: `confidence_below_threshold:${confidence}`,
    };
  }

  // Guardrail: if the dominant category prior strongly says commerce
  // (e.g. groceries +4.0) AND the chosen tier is confirmed_subscription,
  // demote to recurring_commerce. The classifier shouldn't be able to
  // call Whole Foods a subscription just because the user shops there
  // every Wednesday at $89.
  //
  // EXCEPTION: if the merchant is in the catalog dictionary, trust
  // that signal. Apple is GENERAL_MERCHANDISE per Plaid but iCloud
  // is a real subscription; the catalog knows the difference.
  if (
    bestTier === "confirmed_subscription" &&
    prior.recurring_commerce >= 2.0 &&
    prior.confirmed_subscription <= 0 &&
    input.in_dictionary !== true
  ) {
    return {
      recurring_type: "recurring_commerce",
      confidence_score: Math.round(sigmoid(tierLogOdds.recurring_commerce) * 100),
      tier_log_odds: tierLogOdds,
      reason: "commerce_prior_dominant",
    };
  }

  // Symmetric guardrail: PFC strongly says bill (utilities, internet)
  // wins over default confirmed_subscription when bill prior > sub prior
  // by 1.5+ log-odds.
  if (
    bestTier === "confirmed_subscription" &&
    prior.recurring_bill - prior.confirmed_subscription >= 1.5
  ) {
    return {
      recurring_type: "recurring_bill",
      confidence_score: Math.round(sigmoid(tierLogOdds.recurring_bill) * 100),
      tier_log_odds: tierLogOdds,
      reason: "bill_prior_dominant",
    };
  }

  return {
    recurring_type:
      bestTier === "confirmed_subscription"
        ? "confirmed_subscription"
        : bestTier === "recurring_bill"
          ? "recurring_bill"
          : "recurring_commerce",
    confidence_score: confidence,
    tier_log_odds: tierLogOdds,
    reason: `best_tier:${bestTier}`,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
