import type { LedgerSubscription, LedgerCharge } from "../insights";

// Dynamic behavioral badges. Pure functions over a subscription +
// its recent charges. Returns at most TWO badges per row, ranked by
// signal strength so the UI never gets visually crowded.
//
// Available kinds:
//   price_increased      — last cycle is materially higher than median
//   likely_forgotten     — no recent user activity + low utility category
//   annual_trap          — yearly cadence + large amount
//   rarely_charged       — long gaps between charges (relative to cadence)
//   essential            — utility/insurance/rent category
//   detected_recently    — first observation < 60 days ago
//   stable_for_n_months  — clean cadence + amount for ≥ 6 months
//   unusual_billing      — irregular gaps despite known merchant
//   potential_duplicate  — name/category resembles another sub
//   high_yearly_impact   — among the top 3 yearly contributors
//
// Each badge ships with a tone for the UI to color-encode:
//   'positive'  — green / brand (essential, stable)
//   'neutral'   — ink-muted (detected, essential)
//   'attention' — amber (likely forgotten, annual trap, rarely charged)
//   'danger'    — red (price increased, unusual billing)

export type BadgeKind =
  | "price_increased"
  | "likely_forgotten"
  | "annual_trap"
  | "rarely_charged"
  | "essential"
  | "detected_recently"
  | "stable_for_n_months"
  | "unusual_billing"
  | "potential_duplicate"
  | "high_yearly_impact";

export type Badge = {
  kind: BadgeKind;
  label: string;
  tone: "positive" | "neutral" | "attention" | "danger";
  // Optional numeric / short context — UI may render in title attr.
  detail?: string;
};

export type BadgeInput = {
  sub: Pick<
    LedgerSubscription,
    | "id"
    | "merchant_name"
    | "category"
    | "amount_cents"
    | "frequency"
    | "last_charged_at"
  >;
  charges: ReadonlyArray<
    Pick<LedgerCharge, "subscription_id" | "posted_date" | "amount_cents">
  >;
  // For high_yearly_impact ranking.
  yearlyRank?: number; // 1-based, undefined when not in top 3
  // For potential_duplicate detection — caller passes a Set of
  // merchant_name patterns that ALSO appear elsewhere in the user's
  // sub list under the same category.
  duplicateOfMerchant?: string | null;
  // 'now' injection so callers can replay deterministically.
  asOf?: Date;
};

const ESSENTIAL_CATEGORIES = new Set([
  "utilities",
  "phone_internet",
  "telecom",
  "insurance",
  "rent",
]);

const DISCRETIONARY_CATEGORIES = new Set([
  "streaming",
  "gaming",
  "food_delivery",
  "news",
  "fitness",
  "education",
]);

export function computeBadges(input: BadgeInput): Badge[] {
  const asOf = input.asOf ?? new Date();
  const out: Badge[] = [];

  const subCharges = (input.charges ?? []).filter(
    (c) => c.subscription_id === input.sub.id
  );
  // Sort oldest → newest for downstream comparisons.
  const sorted = [...subCharges].sort((a, b) =>
    a.posted_date.localeCompare(b.posted_date)
  );

  // ─── price_increased ──────────────────────────────────────────
  if (sorted.length >= 3) {
    const recent = sorted[sorted.length - 1];
    const priors = sorted.slice(0, -1);
    const priorAmounts = priors.map((c) => Math.abs(c.amount_cents));
    const medianPrior = median(priorAmounts);
    const recentAbs = Math.abs(recent.amount_cents);
    if (medianPrior > 0 && recentAbs >= medianPrior * 1.1) {
      const pct = Math.round(((recentAbs - medianPrior) / medianPrior) * 100);
      out.push({
        kind: "price_increased",
        label: `Price up ${pct}%`,
        tone: "danger",
        detail: `Latest charge $${(recentAbs / 100).toFixed(2)} vs median $${(medianPrior / 100).toFixed(2)}.`,
      });
    }
  }

  // ─── annual_trap ──────────────────────────────────────────────
  if (
    input.sub.frequency === "annually" &&
    Math.abs(input.sub.amount_cents) >= 5000_00
  ) {
    out.push({
      kind: "annual_trap",
      label: "Annual trap",
      tone: "attention",
      detail: "Yearly billing — easy to forget the renewal.",
    });
  } else if (
    input.sub.frequency === "annually" &&
    Math.abs(input.sub.amount_cents) >= 10000
  ) {
    out.push({
      kind: "annual_trap",
      label: "Yearly billing",
      tone: "neutral",
      detail: "Easy to miss between renewals.",
    });
  }

  // ─── likely_forgotten ─────────────────────────────────────────
  // Discretionary category + no charge in 90+ days.
  if (
    DISCRETIONARY_CATEGORIES.has(input.sub.category) &&
    input.sub.last_charged_at
  ) {
    const days = daysBetween(new Date(input.sub.last_charged_at), asOf);
    if (days >= 90 && days < 365) {
      out.push({
        kind: "likely_forgotten",
        label: "Likely forgotten",
        tone: "attention",
        detail: `No charge in ${days} days.`,
      });
    }
  }

  // ─── rarely_charged ───────────────────────────────────────────
  if (sorted.length >= 2 && input.sub.frequency === "monthly") {
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        daysBetween(
          new Date(sorted[i - 1].posted_date),
          new Date(sorted[i].posted_date)
        )
      );
    }
    const med = median(intervals);
    if (med >= 45) {
      out.push({
        kind: "rarely_charged",
        label: "Charges irregularly",
        tone: "attention",
        detail: `Median ${Math.round(med)} days between charges.`,
      });
    }
  }

  // ─── essential ────────────────────────────────────────────────
  if (ESSENTIAL_CATEGORIES.has(input.sub.category)) {
    out.push({
      kind: "essential",
      label: "Essential",
      tone: "positive",
    });
  }

  // ─── detected_recently ────────────────────────────────────────
  if (sorted.length >= 1) {
    const firstSeen = new Date(sorted[0].posted_date);
    const days = daysBetween(firstSeen, asOf);
    if (days <= 60) {
      out.push({
        kind: "detected_recently",
        label: "Detected recently",
        tone: "neutral",
        detail: `First seen ${days} day${days === 1 ? "" : "s"} ago.`,
      });
    }
  }

  // ─── stable_for_n_months ──────────────────────────────────────
  if (sorted.length >= 6 && input.sub.frequency === "monthly") {
    const months = Math.min(24, sorted.length);
    const amts = sorted.slice(-months).map((c) => Math.abs(c.amount_cents));
    const variance = stddev(amts) / Math.max(1, median(amts));
    if (variance <= 0.02) {
      out.push({
        kind: "stable_for_n_months",
        label: `Stable for ${months} months`,
        tone: "positive",
        detail: "Same amount, same cadence.",
      });
    }
  }

  // ─── unusual_billing ──────────────────────────────────────────
  if (sorted.length >= 4 && input.sub.frequency === "monthly") {
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        daysBetween(
          new Date(sorted[i - 1].posted_date),
          new Date(sorted[i].posted_date)
        )
      );
    }
    const cv = stddev(intervals) / Math.max(1, median(intervals));
    if (cv >= 0.4) {
      out.push({
        kind: "unusual_billing",
        label: "Unusual billing cycle",
        tone: "danger",
        detail: "Intervals between charges drift more than expected.",
      });
    }
  }

  // ─── potential_duplicate ──────────────────────────────────────
  if (input.duplicateOfMerchant) {
    out.push({
      kind: "potential_duplicate",
      label: "Possible duplicate",
      tone: "danger",
      detail: `May overlap with ${input.duplicateOfMerchant}.`,
    });
  }

  // ─── high_yearly_impact ───────────────────────────────────────
  if (input.yearlyRank && input.yearlyRank <= 3) {
    out.push({
      kind: "high_yearly_impact",
      label: "High yearly impact",
      tone: "neutral",
      detail: `#${input.yearlyRank} in annual spend.`,
    });
  }

  // Rank + cap at 2. Priority order:
  //   danger > attention > positive > neutral
  // Within tier, the FIRST one wins (insertion order is meaningful).
  const order: Record<Badge["tone"], number> = {
    danger: 0,
    attention: 1,
    positive: 2,
    neutral: 3,
  };
  out.sort((a, b) => order[a.tone] - order[b.tone]);
  return out.slice(0, 2);
}

// ─── math helpers ─────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}
