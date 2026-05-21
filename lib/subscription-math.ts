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
  // Tracks user intent independent of provider confirmation:
  //   - 'keep'   — user explicitly said keep, never surface as candidate
  //   - 'cancel' — user clicked "I cancelled it", watcher is pending
  //   - 'unsure' — watcher saw a charge after cancellation, needs retry
  //   - null     — no decision yet, eligible for the candidates list
  user_decision?: string | null;
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

// Cancel candidates — single source of truth for both the dashboard
// "Worth a look" strip and the recommendation banner's count. Returns
// EVERY actionable candidate (no fixed cap); the UI decides how many
// to render and offers a "show all" toggle for the rest.
//
// Three reasons, in priority order. A sub only ever appears once
// (deduped by id), tagged by its highest-priority reason.
//   - biggest:   the single most-expensive active sub (always 1)
//   - forgotten: regret_score >= 60
//   - silent:    no charge in 35+ days
//
// Filtered out:
//   - status !== 'active'
//   - user_decision === 'keep' (user opted out)
//   - user_decision === 'cancel' (already pending)
export type CandidateReason = "biggest" | "forgotten" | "silent";

export type CancelCandidate = {
  sub: SubLike;
  reason: CandidateReason;
  caption: string;
};

const FORGOTTEN_REGRET_THRESHOLD = 60;
const SILENT_DAYS_THRESHOLD = 35;

export function cancelCandidates(
  subs: SubLike[],
  now = new Date()
): CancelCandidate[] {
  // Only actionable subs reach the candidates pool.
  const actionable = subs.filter(
    (s) =>
      s.status === "active" &&
      s.user_decision !== "keep" &&
      s.user_decision !== "cancel"
  );
  if (actionable.length === 0) return [];

  const seen = new Map<string, CancelCandidate>();

  // 1) biggest — exactly one sub.
  const biggest = [...actionable].sort(
    (a, b) =>
      monthlyEquivalentCents(b.amount_cents, b.frequency) -
      monthlyEquivalentCents(a.amount_cents, a.frequency)
  )[0];
  if (biggest) {
    seen.set(biggest.id, {
      sub: biggest,
      reason: "biggest",
      caption: "Biggest line item",
    });
  }

  // 2) forgotten — every sub above the regret threshold not already seen.
  for (const s of actionable) {
    if (seen.has(s.id)) continue;
    if ((s.regret_score ?? 0) >= FORGOTTEN_REGRET_THRESHOLD) {
      seen.set(s.id, {
        sub: s,
        reason: "forgotten",
        caption: "Might be forgotten",
      });
    }
  }

  // 3) silent — every sub with no charge in 35+ days.
  for (const s of actionable) {
    if (seen.has(s.id)) continue;
    if (!s.last_charged_at) continue;
    const days =
      (now.getTime() - new Date(s.last_charged_at).getTime()) / 86_400_000;
    if (days > SILENT_DAYS_THRESHOLD) {
      seen.set(s.id, {
        sub: s,
        reason: "silent",
        caption: "No recent charge",
      });
    }
  }

  // Final order: biggest first, then by annual cost desc within
  // remaining reasons. Stable so the dashboard renders the same order
  // every time.
  return Array.from(seen.values()).sort((a, b) => {
    if (a.reason === "biggest" && b.reason !== "biggest") return -1;
    if (a.reason !== "biggest" && b.reason === "biggest") return 1;
    return (
      monthlyEquivalentCents(b.sub.amount_cents, b.sub.frequency) -
      monthlyEquivalentCents(a.sub.amount_cents, a.sub.frequency)
    );
  });
}

// Annual savings across an entire candidates list. Used by the banner
// for "Up to $X/yr in potential savings" — never hardcoded.
export function candidatesAnnualSavingsCents(
  candidates: CancelCandidate[]
): number {
  return candidates.reduce(
    (sum, c) =>
      sum +
      monthlyEquivalentCents(c.sub.amount_cents, c.sub.frequency) * 12,
    0
  );
}

// Per-candidate plain-English narrative. Every value comes from the
// real subscription row — last_charged_at, regret_score, amount. Never
// generic, always specific. Drives the "why is this flagged?" answer
// inside each candidate card.
export function candidateNarrative(
  c: CancelCandidate,
  now = new Date()
): string {
  const annual =
    monthlyEquivalentCents(c.sub.amount_cents, c.sub.frequency) * 12;
  const annualDollars = `$${Math.round(annual / 100).toLocaleString()}`;

  const monthsSince = c.sub.last_charged_at
    ? Math.max(
        0,
        Math.round(
          (now.getTime() - new Date(c.sub.last_charged_at).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        )
      )
    : null;

  switch (c.reason) {
    case "biggest":
      return `Your biggest line item. ${annualDollars} a year.`;
    case "forgotten":
      if (monthsSince !== null && monthsSince >= 1) {
        return `Last charged ${monthsSince} ${monthsSince === 1 ? "month" : "months"} ago. You'd save ${annualDollars}/year.`;
      }
      return `Flagged as likely forgotten. You'd save ${annualDollars}/year.`;
    case "silent":
      if (monthsSince !== null && monthsSince >= 1) {
        return `No charge in ${monthsSince} ${monthsSince === 1 ? "month" : "months"}. ${annualDollars}/year if it stays gone.`;
      }
      return `No recent charge. ${annualDollars}/year if it stays gone.`;
  }
}
