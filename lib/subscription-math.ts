import { asCategory, type Category } from "./categories";

// Pure functions for everything the dashboard needs to compute off a
// list of subscriptions. No React, no DB — all derived from rows.

export type Frequency =
  | "monthly"
  | "annually"
  | "weekly"
  | "biweekly"
  | "semi_monthly"
  | "unknown";

export type SubLike = {
  id: string;
  merchant_name: string;
  normalized_name?: string | null;
  category?: string | null;
  amount_cents: number;
  currency: string;
  frequency: string;
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
  regret_score?: number | null;
  status: string;
};

export function monthlyEquivalentCents(amount_cents: number, frequency: string): number {
  switch (frequency) {
    case "monthly":
      return amount_cents;
    case "annually":
      return Math.round(amount_cents / 12);
    case "weekly":
      return Math.round((amount_cents * 52) / 12);
    case "biweekly":
      return Math.round((amount_cents * 26) / 12);
    case "semi_monthly":
      return amount_cents * 2;
    default:
      return 0;
  }
}

export function annualCents(amount_cents: number, frequency: string): number {
  return monthlyEquivalentCents(amount_cents, frequency) * 12;
}

export function totalMonthlyCents(subs: SubLike[]): number {
  return subs.reduce(
    (sum, s) =>
      s.status === "active"
        ? sum + monthlyEquivalentCents(s.amount_cents, s.frequency)
        : sum,
    0
  );
}

// 12-month series. Prefers real per-charge history when provided
// (lib/scan.ts seeds subscription_charges in sandbox; production will
// populate it from /transactions/sync). Falls back to a projection from
// current state when the charges argument is empty, which is the only
// thing we can do until history exists.
export type MonthBucket = {
  label: string;          // e.g. "Jun"
  yearMonth: string;      // "2026-06"
  totalCents: number;
};

export type ChargeRow = {
  amount_cents: number;
  charged_at: string; // YYYY-MM-DD
};

export function trailingTwelveMonths(
  subs: SubLike[],
  charges: ChargeRow[] = [],
  now = new Date()
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short" });

  // Bucket real charges by YYYY-MM first so the hot path is a map lookup.
  const realByMonth = new Map<string, number>();
  for (const c of charges) {
    const ym = c.charged_at.slice(0, 7);
    realByMonth.set(ym, (realByMonth.get(ym) ?? 0) + c.amount_cents);
  }

  const haveHistory = realByMonth.size > 0;

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    let totalCents = 0;

    if (haveHistory) {
      totalCents = realByMonth.get(yearMonth) ?? 0;
    } else {
      // Projection fallback.
      for (const s of subs) {
        if (s.status !== "active") continue;
        if (s.frequency === "annually") {
          const anchor = s.last_charged_at ? new Date(s.last_charged_at) : null;
          if (anchor && anchor.getMonth() === d.getMonth()) {
            totalCents += s.amount_cents;
          }
          continue;
        }
        totalCents += monthlyEquivalentCents(s.amount_cents, s.frequency);
      }
    }

    buckets.push({
      label: fmt.format(d),
      yearMonth,
      totalCents,
    });
  }

  return buckets;
}

// Breakdown by category for the donut.
export type CategorySlice = {
  category: Category;
  monthlyCents: number;
  count: number;
};

export function categoryBreakdown(subs: SubLike[]): CategorySlice[] {
  const map = new Map<Category, CategorySlice>();
  for (const s of subs) {
    if (s.status !== "active") continue;
    const cat = asCategory(s.category);
    const cur = map.get(cat) ?? { category: cat, monthlyCents: 0, count: 0 };
    cur.monthlyCents += monthlyEquivalentCents(s.amount_cents, s.frequency);
    cur.count += 1;
    map.set(cat, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.monthlyCents - a.monthlyCents);
}

// Cancel candidates. Conservative — never returns more than 3 so the
// strip stays focused. We surface:
//   - biggest:  most expensive active sub
//   - forgotten: high regret_score (default threshold 60)
//   - silent:   no charge in the past 35 days but still active
//
// We dedupe so the same sub doesn't appear under two reasons.
export type CandidateReason = "biggest" | "forgotten" | "silent";

export type CancelCandidate = {
  sub: SubLike;
  reason: CandidateReason;
  caption: string;
};

export function cancelCandidates(subs: SubLike[], now = new Date()): CancelCandidate[] {
  const active = subs.filter((s) => s.status === "active");
  if (active.length === 0) return [];

  const out: CancelCandidate[] = [];
  const seen = new Set<string>();

  const biggest = [...active].sort(
    (a, b) =>
      monthlyEquivalentCents(b.amount_cents, b.frequency) -
      monthlyEquivalentCents(a.amount_cents, a.frequency)
  )[0];
  if (biggest) {
    out.push({
      sub: biggest,
      reason: "biggest",
      caption: "Biggest line item",
    });
    seen.add(biggest.id);
  }

  const forgotten = active
    .filter(
      (s) =>
        !seen.has(s.id) && (s.regret_score ?? 0) >= 60
    )
    .sort((a, b) => (b.regret_score ?? 0) - (a.regret_score ?? 0));
  if (forgotten[0]) {
    out.push({
      sub: forgotten[0],
      reason: "forgotten",
      caption: "Might be forgotten",
    });
    seen.add(forgotten[0].id);
  }

  const silent = active
    .filter((s) => !seen.has(s.id))
    .filter((s) => {
      if (!s.last_charged_at) return false;
      const days = (now.getTime() - new Date(s.last_charged_at).getTime()) / 86_400_000;
      return days > 35;
    })
    .sort(
      (a, b) =>
        monthlyEquivalentCents(b.amount_cents, b.frequency) -
        monthlyEquivalentCents(a.amount_cents, a.frequency)
    );
  if (silent[0]) {
    out.push({
      sub: silent[0],
      reason: "silent",
      caption: "No recent charge",
    });
  }

  return out.slice(0, 3);
}
