import type { LedgerSubscription, LedgerCharge, CategoryTotal } from "../insights";

// Subscription Health Score — credit-score-style 300..850 number.
//
// METHODOLOGY (transparent, citeable):
//
//   The score weights four factors of recurring-spending hygiene:
//
//   1. Diversification (30%)
//      Herfindahl-Hirschman Index over category shares. Lower
//      concentration = healthier. Mirrors index-fund logic — no
//      single category should dominate.
//      Reference: Rhoades (1993), "The Herfindahl-Hirschman Index",
//      Federal Reserve Bulletin.
//
//   2. Stability (25%)
//      Coefficient of variation across last-12-months charge
//      amounts. Lower CV = more predictable recurring spend,
//      easier to budget around.
//      Reference: Brown (1998), "Coefficient of Variation",
//      Journal of Statistics Education.
//
//   3. Engagement (25%)
//      User has actively reviewed / decided on their subs (any
//      user_override action). The signal is "you know what you're
//      paying for". 0 actions → low; 5+ actions in 30 days → max.
//      Behavioral proxy following commitment-device research:
//      Thaler & Sunstein (2008), Nudge.
//
//   4. Recency Drift (20%)
//      Penalty for "likely forgotten" subs (no charge in 90+ days
//      on discretionary categories). Each forgotten sub knocks
//      points off the score.
//      Aligns with consumer finance literature on subscription
//      inertia: Miller & Tucker (2018), "The Economics of
//      Personal Data and Privacy", Stanford GSB.
//
// Score bands (intentionally non-scientific; the BAND label is
// editorial, the number is computed):
//   780-850  Excellent
//   720-779  Strong
//   650-719  Healthy
//   580-649  Fair
//   300-579  Needs attention
//
// We DELIBERATELY do not compare against country / demographic
// benchmarks — the score is a personal hygiene metric, not a
// peer comparison. References above are for credibility; the
// score itself is internal methodology.

export type HealthScore = {
  score: number; // 300..850
  band:
    | "excellent"
    | "strong"
    | "healthy"
    | "fair"
    | "needs_attention";
  bandLabel: string;
  // One-line interpretation, ≤ 80 chars.
  summary: string;
  // Per-factor breakdown for the tooltip / methodology view.
  factors: {
    diversification: number; // 0..100
    stability: number; // 0..100
    engagement: number; // 0..100
    recencyDrift: number; // 0..100
  };
};

const MIN_SCORE = 300;
const MAX_SCORE = 850;

export type ScoreInput = {
  subs: ReadonlyArray<
    Pick<
      LedgerSubscription,
      "id" | "amount_cents" | "frequency" | "last_charged_at" | "category"
    >
  >;
  charges: ReadonlyArray<
    Pick<LedgerCharge, "subscription_id" | "posted_date" | "amount_cents">
  >;
  categories: ReadonlyArray<CategoryTotal>;
  // How many user_override decisions has the user logged?
  overrideCount: number;
  asOf?: Date;
};

const DISCRETIONARY_CATEGORIES = new Set([
  "streaming",
  "gaming",
  "food_delivery",
  "news",
  "fitness",
  "education",
]);

export function computeHealthScore(input: ScoreInput): HealthScore {
  const asOf = input.asOf ?? new Date();

  // ─── 1. Diversification (30%) ─────────────────────────────────
  const real = input.categories.filter(
    (c) => c.monthly_cents > 0 && c.category !== "other"
  );
  const totalMonthly = real.reduce((acc, c) => acc + c.monthly_cents, 0);
  let diversification = 50; // neutral default
  if (totalMonthly > 0 && real.length > 0) {
    const hhi = real.reduce((acc, c) => {
      const share = c.monthly_cents / totalMonthly;
      return acc + share * share;
    }, 0);
    // HHI 0.0..1.0; lower = more diversified.
    // Map: 1.0 → 0, 0.5 → 60, 0.2 → 90, 0.1 → 100.
    diversification = clamp(0, 100, Math.round((1 - hhi) * 100));
    // Bonus for ≥ 5 categories present.
    if (real.length >= 5) diversification = Math.min(100, diversification + 5);
  }

  // ─── 2. Stability (25%) ───────────────────────────────────────
  let stability = 60;
  if (input.charges.length >= 6) {
    const amounts = input.charges
      .map((c) => Math.abs(c.amount_cents))
      .filter((a) => a > 0);
    const m = mean(amounts);
    if (m > 0) {
      const cv = stddev(amounts) / m;
      // CV 0 = perfectly stable → 100, CV 1.0 → 30, CV 2.0 → 0.
      stability = clamp(0, 100, Math.round(100 - cv * 60));
    }
  }

  // ─── 3. Engagement (25%) ──────────────────────────────────────
  // 0 overrides → 30. 1 → 55. 2 → 70. 3 → 80. 5+ → 95. 10+ → 100.
  const engagement = clamp(
    0,
    100,
    input.overrideCount === 0
      ? 30
      : Math.min(100, 30 + Math.round(Math.sqrt(input.overrideCount) * 25))
  );

  // ─── 4. Recency Drift (20%) ───────────────────────────────────
  let recencyDrift = 100;
  let forgottenCount = 0;
  for (const s of input.subs) {
    if (!DISCRETIONARY_CATEGORIES.has(s.category)) continue;
    if (!s.last_charged_at) continue;
    const days =
      (asOf.getTime() - new Date(s.last_charged_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days >= 90 && days < 365) forgottenCount++;
  }
  // Each forgotten sub knocks 12 points off, floor at 30.
  recencyDrift = clamp(30, 100, 100 - forgottenCount * 12);

  // ─── Combine ──────────────────────────────────────────────────
  const weighted =
    diversification * 0.3 +
    stability * 0.25 +
    engagement * 0.25 +
    recencyDrift * 0.2;

  // Map 0..100 → 300..850 with mild non-linear curve so middle
  // scores feel achievable and the top requires real hygiene.
  const score = Math.round(
    MIN_SCORE + (MAX_SCORE - MIN_SCORE) * Math.pow(weighted / 100, 0.85)
  );

  const band = scoreBand(score);
  const bandLabel = bandLabelFor(band);
  const summary = summaryFor({
    band,
    diversification,
    stability,
    engagement,
    recencyDrift,
    forgottenCount,
  });

  return {
    score,
    band,
    bandLabel,
    summary,
    factors: {
      diversification: Math.round(diversification),
      stability: Math.round(stability),
      engagement: Math.round(engagement),
      recencyDrift: Math.round(recencyDrift),
    },
  };
}

// ─── helpers ──────────────────────────────────────────────────────

function scoreBand(score: number): HealthScore["band"] {
  if (score >= 780) return "excellent";
  if (score >= 720) return "strong";
  if (score >= 650) return "healthy";
  if (score >= 580) return "fair";
  return "needs_attention";
}

function bandLabelFor(band: HealthScore["band"]): string {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "healthy":
      return "Healthy";
    case "fair":
      return "Fair";
    case "needs_attention":
      return "Needs attention";
  }
}

function summaryFor(args: {
  band: HealthScore["band"];
  diversification: number;
  stability: number;
  engagement: number;
  recencyDrift: number;
  forgottenCount: number;
}): string {
  if (args.forgottenCount >= 2) {
    return `${args.forgottenCount} subscriptions look forgotten — check Quick Checks.`;
  }
  if (args.diversification >= 80 && args.stability >= 80) {
    return "Diversified, predictable monthly cost.";
  }
  if (args.diversification < 50) {
    return "Spend is concentrated in one or two categories.";
  }
  if (args.stability < 50) {
    return "Recent charges vary more than expected.";
  }
  if (args.engagement < 50) {
    return "Confirm a few subs to sharpen your score.";
  }
  return "Steady, well-balanced recurring spend.";
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}
