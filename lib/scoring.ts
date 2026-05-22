// Probabilistic candidate scoring core.
//
// Layers (top to bottom):
//   1. User override                — deterministic; overrides outright.
//   2. Calibrated probabilistic     — Beta-Binomial merchant prior
//                                     combined with calibrated logistic
//                                     over candidate features, in
//                                     log-odds space.
//
// Pure functions only. No I/O. All inputs are passed as plain values
// so the caller controls cache/DB access.
//
// Determinism contract: same features + same prior + same coefficients
// → byte-identical probability and decision. The scoring function is
// stateless and can be replayed against historical feature snapshots.

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

export type CandidateFeatures = {
  merchant_key: string;
  // Interval regularity: 0..1. 1 = perfectly even gaps between
  // charges. Derived as 1 - CV(gaps), clipped.
  regularity: number;
  // Amount consistency: 0..1. 1 = identical amounts every charge.
  // Derived as 1 - CV(amounts), clipped.
  amount_consistency: number;
  // Number of accepted (in-cadence) occurrences in the detected
  // stream. Higher counts → stronger evidence the cadence is real.
  occurrences: number;
  // Plaid PFC-derived hint or our catalog category. Used as a
  // categorical bonus on the logistic side; the prior catches the
  // merchant-specific signal.
  category: string;
  // True iff the merchant_key is in the seeded dictionary
  // (merchants.is_dictionary_seed). Acts as a confidence bump on the
  // logistic side independent of the Beta prior.
  in_dictionary: boolean;
  // For audit / debugging — not used in the score.
  cadence?: string;
};

export type MerchantPrior = {
  alpha: number; // positive evidence
  beta: number;  // negative evidence
};

export type UserOverride = {
  override_type:
    | "confirmed"
    | "not_recurring"
    | "not_subscription"
    | "wrong_amount"
    | "wrong_cadence"
    | "cancelled";
  override_value?: Record<string, unknown>;
};

export type ScoreResult = {
  probability: number; // 0..1
  decision: "subscription" | "one_off" | "uncertain";
  // Audit trail — exposes the path to a probability so we can show
  // "why" the score is what it is in the UI.
  prior_log_odds: number;
  pattern_log_odds: number;
  combined_log_odds: number;
  source: "override" | "score";
  override_type?: UserOverride["override_type"];
  // The merchant prior used (echoed back for traceability).
  prior_alpha: number;
  prior_beta: number;
};

export type LogisticCoefficients = {
  intercept: number;
  regularity: number;
  amount_consistency: number;
  // Multiplier on log1p(occurrences) so the bonus diminishes at high
  // counts (we don't want 50 charges weighed 5x more than 10).
  log_occurrences: number;
  in_dictionary: number;
  // Categorical bumps applied additively when the category matches.
  category_software: number;
  category_streaming: number;
  category_news: number;
  category_fitness: number;
  category_food_delivery: number;
  category_cloud_storage: number;
  category_gaming: number;
  category_telecom: number;
  category_utilities: number;
};

// ───────────────────────────────────────────────────────────────────
// Launch coefficients
//
// Hardcoded sensible defaults for cold-start before the retraining
// cron has produced its first fitted model. These are derived from
// the existing classifier behaviour at the same operating point:
//   • regularity and amount_consistency dominate (weights 4.0 / 3.0)
//   • log1p(occurrences) carries 1.0 weight
//   • dictionary membership adds ~1.5 in log-odds
//   • category bumps land in 0.3..0.8 range
//
// The intercept of -2.0 anchors an unknown candidate with mediocre
// features (regularity=0.5, amount_consistency=0.5, occurrences=2,
// not in dictionary, no category bonus) near probability 0.05 — so
// the engine errs toward "one-off" without prior evidence. The Beta
// prior is what moves a brand-new well-formed pattern into the
// uncertain or subscription band.
// ───────────────────────────────────────────────────────────────────

export const DEFAULT_COEFFICIENTS: LogisticCoefficients = {
  intercept: -2.0,
  regularity: 4.0,
  amount_consistency: 3.0,
  log_occurrences: 1.0,
  in_dictionary: 1.5,
  category_software: 0.8,
  category_streaming: 0.8,
  category_news: 0.6,
  category_fitness: 0.6,
  category_food_delivery: 0.4,
  category_cloud_storage: 0.7,
  category_gaming: 0.6,
  category_telecom: 0.5,
  category_utilities: 0.5,
};

// Decision thresholds. The middle band (0.4 .. 0.6) is the active-
// learning zone where we ask the user to label.
export const THRESHOLD_SUBSCRIPTION = 0.6;
export const THRESHOLD_ONE_OFF = 0.4;

// ───────────────────────────────────────────────────────────────────
// Math helpers
// ───────────────────────────────────────────────────────────────────

export function sigmoid(x: number): number {
  // Numerical-stable sigmoid.
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

// Beta posterior mean log-odds. Adds a small epsilon so alpha/beta=0
// won't produce ±Infinity (a fresh merchant has alpha=beta=1 by table
// default so this is mostly defensive).
export function betaLogOdds(alpha: number, beta: number): number {
  const a = Math.max(alpha, 1e-3);
  const b = Math.max(beta, 1e-3);
  return Math.log(a / b);
}

// ───────────────────────────────────────────────────────────────────
// Logistic pattern score
//
// Outputs a log-odds value (NOT a probability). Caller combines this
// with the merchant prior log-odds and runs sigmoid().
// ───────────────────────────────────────────────────────────────────

export function patternLogOdds(
  features: CandidateFeatures,
  coeffs: LogisticCoefficients = DEFAULT_COEFFICIENTS
): number {
  const r = clamp01(features.regularity);
  const a = clamp01(features.amount_consistency);
  const occ = Math.max(0, features.occurrences);
  let lo =
    coeffs.intercept +
    coeffs.regularity * r +
    coeffs.amount_consistency * a +
    coeffs.log_occurrences * Math.log1p(occ);
  if (features.in_dictionary) lo += coeffs.in_dictionary;

  const catKey = `category_${features.category}` as keyof LogisticCoefficients;
  const catBonus = (coeffs as unknown as Record<string, number>)[catKey];
  if (typeof catBonus === "number") lo += catBonus;

  return lo;
}

// ───────────────────────────────────────────────────────────────────
// Top-level scoring entry point
// ───────────────────────────────────────────────────────────────────

export function scoreCandidate(args: {
  features: CandidateFeatures;
  prior?: MerchantPrior;
  override?: UserOverride;
  coeffs?: LogisticCoefficients;
}): ScoreResult {
  const { features, prior, override, coeffs = DEFAULT_COEFFICIENTS } = args;

  // Defensive default — a brand-new merchant the engine has never
  // seen sits at (1,1) → log-odds 0. The pattern score alone decides.
  const priorAlpha = prior?.alpha ?? 1;
  const priorBeta = prior?.beta ?? 1;

  // 1) User override wins outright.
  if (override) {
    const isSubscription =
      override.override_type === "confirmed" ||
      override.override_type === "wrong_amount" ||
      override.override_type === "wrong_cadence";
    return {
      probability: isSubscription ? 1 : 0,
      decision: isSubscription ? "subscription" : "one_off",
      prior_log_odds: 0,
      pattern_log_odds: 0,
      combined_log_odds: isSubscription ? Infinity : -Infinity,
      source: "override",
      override_type: override.override_type,
      prior_alpha: priorAlpha,
      prior_beta: priorBeta,
    };
  }

  // 2) Probabilistic combination in log-odds space.
  const priorLO = betaLogOdds(priorAlpha, priorBeta);
  const patternLO = patternLogOdds(features, coeffs);
  const combinedLO = priorLO + patternLO;
  const p = sigmoid(combinedLO);

  const decision: ScoreResult["decision"] =
    p >= THRESHOLD_SUBSCRIPTION
      ? "subscription"
      : p < THRESHOLD_ONE_OFF
        ? "one_off"
        : "uncertain";

  return {
    probability: p,
    decision,
    prior_log_odds: priorLO,
    pattern_log_odds: patternLO,
    combined_log_odds: combinedLO,
    source: "score",
    prior_alpha: priorAlpha,
    prior_beta: priorBeta,
  };
}

// ───────────────────────────────────────────────────────────────────
// Feature derivation from raw stream data
//
// Convenience helpers so callers can hand us a DetectedStream-shaped
// payload and get back the features the scorer expects.
// ───────────────────────────────────────────────────────────────────

/**
 * 1 - coefficient_of_variation, clipped to [0, 1]. Returns 1 when n < 2.
 */
export function regularityFromGaps(gapsDays: number[]): number {
  if (gapsDays.length < 2) return 1;
  const mean = gapsDays.reduce((a, b) => a + b, 0) / gapsDays.length;
  if (mean <= 0) return 0;
  const variance =
    gapsDays.reduce((acc, g) => acc + (g - mean) ** 2, 0) / gapsDays.length;
  const cv = Math.sqrt(variance) / mean;
  return clamp01(1 - cv);
}

export function consistencyFromAmounts(amountsCents: number[]): number {
  if (amountsCents.length < 2) return 1;
  const mean = amountsCents.reduce((a, b) => a + b, 0) / amountsCents.length;
  if (mean <= 0) return 0;
  const variance =
    amountsCents.reduce((acc, x) => acc + (x - mean) ** 2, 0) /
    amountsCents.length;
  const cv = Math.sqrt(variance) / mean;
  return clamp01(1 - cv);
}

/**
 * Given an array of dated charges (newest or oldest first either
 * works — we sort ascending internally), return the regularity and
 * amount_consistency features the scorer expects.
 */
export function featuresFromCharges(
  charges: { posted_date: string; amount_cents: number }[]
): { regularity: number; amount_consistency: number; occurrences: number } {
  const sorted = [...charges].sort((a, b) =>
    a.posted_date.localeCompare(b.posted_date)
  );
  const occurrences = sorted.length;
  if (occurrences < 2) {
    return { regularity: 1, amount_consistency: 1, occurrences };
  }
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1].posted_date).getTime();
    const b = new Date(sorted[i].posted_date).getTime();
    gaps.push(Math.max(0, (b - a) / (1000 * 60 * 60 * 24)));
  }
  return {
    regularity: regularityFromGaps(gaps),
    amount_consistency: consistencyFromAmounts(
      sorted.map((c) => Math.abs(c.amount_cents))
    ),
    occurrences,
  };
}

// ───────────────────────────────────────────────────────────────────
// Label → outcome mapping for the feedback endpoint.
// ───────────────────────────────────────────────────────────────────

export function outcomeFromOverride(
  type: UserOverride["override_type"]
): "positive" | "negative" | "edit" {
  switch (type) {
    case "confirmed":
      return "positive";
    case "not_recurring":
    case "not_subscription":
      return "negative";
    case "wrong_amount":
    case "wrong_cadence":
      return "edit";
    case "cancelled":
      // Cancellation is still positive evidence the merchant was a
      // subscription — the user just doesn't want it anymore.
      return "positive";
  }
}
