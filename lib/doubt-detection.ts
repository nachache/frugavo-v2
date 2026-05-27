import type { DetectedStream } from "./recurrence-detect";
import type { BrandVerdict } from "./brand-verdicts";

// =========================================================================
// Doubt detection — pure functions that decide:
//   1. computeConfidence({stream, verdict})  → 0..1 per-candidate
//   2. shouldCreateDoubt({stream, verdict, confidence}) → {surface, prompt_kind} | null
//
// Neither function touches the DB or makes I/O. The scan orchestrator
// calls them, persists the result, and writes doubt_items as needed.
//
// Thresholds locked in docs/intelligence.md (Addendum):
//   MATERIALITY_THRESHOLD_CENTS = 200   ($2/mo equivalent)
//   CONFIDENCE_AUTO_CONFIRM     = 0.85  no prompt
//   CONFIDENCE_DASHBOARD_PROMPT = 0.55  passive Quick Check
//   (below 0.55)                        active scan chip
//
// Tunable via the constants below; production reads from this file.
// Telemetry layer (doubt_prompts_log) gives Phase E the data to
// adjust them empirically.
// =========================================================================

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

export const DOUBT_CONSTANTS = {
  // Below this monthly-equivalent dollar amount, no doubt is ever
  // created. Kills 99-cent app-store one-offs and trivial bank fees.
  MATERIALITY_THRESHOLD_CENTS: 200,
  // Auto-confirm: no prompt anywhere.
  CONFIDENCE_AUTO_CONFIRM: 0.85,
  // Passive Quick Check on the dashboard.
  CONFIDENCE_DASHBOARD_PROMPT: 0.55,
  // Below CONFIDENCE_DASHBOARD_PROMPT → active inline scan chip.
} as const;

// ──────────────────────────────────────────────────────────────────────
// computeConfidence
//
// Returns a 0..1 confidence that this detected stream is a real
// subscription. Combines four signals:
//
//   identityScore   from brand_verdict.subscription_likelihood
//                   always → 0.85  sometimes → 0.55  never → 0.10
//   cadenceScore    1 - normalized MAD of inter-charge intervals
//                   (regularity proxy; 1.0 = perfectly regular)
//   occurrenceScore min(occurrences / 4, 1)  caps at 4+ charges
//   claudeMultiplier brand_verdict.confidence_score (Claude's own
//                   confidence in its verdict — caps engine confidence
//                   when Claude wasn't sure)
//
// Weighting: identity 50% + cadence 30% + occurrences 20%, then
// multiplied by claudeMultiplier. Clamped to [0,1].
//
// Returns 0.5 (neutral) when no brand_verdict is available. The
// engine then falls back to its existing classifier path without
// reading confidence.
// ──────────────────────────────────────────────────────────────────────

export type ComputeConfidenceArgs = {
  stream: Pick<
    DetectedStream,
    "occurrences" | "median_gap_days" | "transactions" | "median_amount_dollars"
  >;
  verdict: BrandVerdict | null;
};

export function computeConfidence(args: ComputeConfidenceArgs): number {
  const { stream, verdict } = args;

  // No verdict → neutral. Phase C's UI will fall back to engine
  // classification without surfacing a confidence.
  if (!verdict) return 0.5;

  const identityScore = identityScoreFor(verdict.subscription_likelihood);
  const cadenceScore = cadenceRegularity(stream);
  const occurrenceScore = Math.min(stream.occurrences / 4, 1);

  // Weighted base. Identity dominates because the brand verdict is
  // the strongest signal — DoorDash one-off vs DashPass is a
  // verdict-level distinction the cadence math will never see.
  const weighted =
    identityScore * 0.5 + cadenceScore * 0.3 + occurrenceScore * 0.2;

  // Claude's self-assessment caps the engine confidence. When Claude
  // hedged (confidence_score = 0.3), the engine can't be more
  // confident than that — it's classifying a brand Claude wasn't
  // sure of.
  const claudeMultiplier =
    typeof verdict.confidence_score === "number" &&
    verdict.confidence_score >= 0 &&
    verdict.confidence_score <= 1
      ? verdict.confidence_score
      : 1.0;

  const final = weighted * claudeMultiplier;
  return clamp(final, 0, 1);
}

function identityScoreFor(
  likelihood: BrandVerdict["subscription_likelihood"]
): number {
  switch (likelihood) {
    case "always":
      return 0.85;
    case "sometimes":
      return 0.55;
    case "never":
      return 0.1;
    default:
      return 0.5;
  }
}

// Cadence regularity: 1 - (median-absolute-deviation / median).
// 1.0 = perfectly regular cadence; 0.0 = max irregularity. With
// fewer than 2 intervals (1 occurrence), there's no cadence — return
// 0.3 so single-occurrence rows don't get penalized AND don't
// auto-confirm.
function cadenceRegularity(args: {
  occurrences: number;
  transactions: ReadonlyArray<{ date: string }>;
}): number {
  const dates = (args.transactions ?? [])
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  if (dates.length < 2) return 0.3;

  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const a = new Date(dates[i - 1]).getTime();
    const b = new Date(dates[i]).getTime();
    const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
    if (days > 0) intervals.push(days);
  }
  if (intervals.length === 0) return 0.3;

  const med = median(intervals);
  if (med <= 0) return 0.3;

  const madValue = mad(intervals, med);
  const normalized = madValue / med;
  // Clamp the normalization so a single wildly-off interval doesn't
  // tank an otherwise-stable stream into negative regularity.
  return clamp(1 - normalized, 0, 1);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mad(values: number[], med?: number): number {
  if (values.length === 0) return 0;
  const m = med ?? median(values);
  const deviations = values.map((v) => Math.abs(v - m));
  return median(deviations);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ──────────────────────────────────────────────────────────────────────
// shouldCreateDoubt
//
// Decides whether (and where) to surface a doubt prompt for this
// candidate. Applies in order:
//
//   1. Materiality filter — below $2/mo equivalent, never ask.
//   2. Auto-confirm zone (confidence ≥ 0.85) — never ask.
//   3. likelihood='never' — never ask (engine will skip anyway).
//   4. confidence < 0.55 → 'scan_chip' (active during reveal)
//   5. confidence < 0.85 → 'dashboard_module' (passive Quick Check)
//
// Returns null when no doubt should be created. Returns a payload
// {surface, prompt_kind} when one should. Phase B only emits the
// 'is_real_sub' prompt_kind; other kinds (work_expense, shared,
// temporary) come in Phase C as separate chips on the same
// subscription.
// ──────────────────────────────────────────────────────────────────────

export type ShouldCreateDoubtArgs = {
  stream: Pick<DetectedStream, "occurrences"> & {
    monthly_equivalent_cents: number;
  };
  verdict: BrandVerdict | null;
  confidence: number;
};

export type DoubtCreationDecision = {
  surface: "scan_chip" | "dashboard_module";
  prompt_kind: "is_real_sub";
};

export function shouldCreateDoubt(
  args: ShouldCreateDoubtArgs
): DoubtCreationDecision | null {
  const { stream, verdict, confidence } = args;

  // 1. Materiality. $2/mo equivalent is the floor — nothing below
  //    that is worth interrupting the user for, even if Claude is
  //    uncertain about it.
  if (
    stream.monthly_equivalent_cents <
    DOUBT_CONSTANTS.MATERIALITY_THRESHOLD_CENTS
  ) {
    return null;
  }

  // 2. Auto-confirm zone. Engine is confident enough to treat this
  //    as a real subscription without asking.
  if (confidence >= DOUBT_CONSTANTS.CONFIDENCE_AUTO_CONFIRM) {
    return null;
  }

  // 3. 'never' likelihood. Engine will skip surfacing this entirely
  //    in Phase C; we don't ask the user about ATM withdrawals.
  if (verdict?.subscription_likelihood === "never") {
    return null;
  }

  // 4. Active scan chip — low confidence; we want the answer during
  //    the most attentive moment (the reveal).
  if (confidence < DOUBT_CONSTANTS.CONFIDENCE_DASHBOARD_PROMPT) {
    return { surface: "scan_chip", prompt_kind: "is_real_sub" };
  }

  // 5. Passive dashboard prompt — medium confidence; ask later when
  //    the user has time.
  return { surface: "dashboard_module", prompt_kind: "is_real_sub" };
}

// ──────────────────────────────────────────────────────────────────────
// Re-evaluation gate.
//
// After a doubt has been silenced (IGNORE_COUNT_BEFORE_SILENCE
// ignores), it re-fires ONLY if BOTH:
//   - the candidate's occurrence count has doubled since the last
//     time we asked
//   - the monthly equivalent stays above the materiality threshold
//
// Otherwise: stays silent forever.
// ──────────────────────────────────────────────────────────────────────

export type CanReEvaluateArgs = {
  silenced: boolean;
  occurrencesAtSilenceTime: number;
  currentOccurrences: number;
  currentMonthlyEquivalentCents: number;
};

export function canReEvaluateSilencedDoubt(
  args: CanReEvaluateArgs
): boolean {
  if (!args.silenced) return true;
  if (
    args.currentMonthlyEquivalentCents <
    DOUBT_CONSTANTS.MATERIALITY_THRESHOLD_CENTS
  ) {
    return false;
  }
  return args.currentOccurrences >= args.occurrencesAtSilenceTime * 2;
}
