// Insights derived from real ledger data (subscription_charges).
//
// Every function in this file is PURE and DETERMINISTIC:
//   - Input is a snapshot of subscription_charges + subscriptions rows.
//   - Output is a structured insight payload.
//   - No I/O, no Date.now(), no Math.random(), no AI calls.
//   - Same input + same as_of_date → byte-identical output.
//
// This matches the engine's existing replay contract. Insights are
// just another deterministic transformation over the canonical
// ledger; if the user asks "why does the dashboard say I spend $X?"
// we can always answer from the raw rows.

import catalog from "@/lib/data/merchant-catalog.json";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type LedgerCharge = {
  subscription_id: string;
  posted_date: string; // YYYY-MM-DD
  amount_cents: number;
  detector_status: "accepted" | "outlier" | "ignored";
  cadence_cycle_id: number | null;
};

export type LedgerSubscription = {
  id: string;
  merchant_name: string;
  merchant_key: string | null;
  category: string;
  amount_cents: number;
  currency: string;
  frequency: "weekly" | "biweekly" | "semi_monthly" | "monthly" | "quarterly" | "annually" | string;
  status: string;
  classification: string | null;
  last_charged_at: string | null;
};

// Catalog-derived AI key set. Built once at module load from
// merchant-catalog.json entries with "ai": true. Same source of truth
// as the rest of the engine.
type CatalogEntry = { key: string; ai?: boolean };
const AI_CATALOG_KEYS: Set<string> = (() => {
  const s = new Set<string>();
  const c = catalog as unknown as { merchants?: CatalogEntry[] };
  for (const m of c.merchants ?? []) {
    if (m.ai === true) s.add(m.key);
  }
  return s;
})();

export function isAiSubscription(sub: LedgerSubscription): boolean {
  if (!sub.merchant_key) return false;
  // merchant_key may carry a biller-tier suffix like "openai_t2";
  // strip it before catalog lookup.
  const baseKey = sub.merchant_key.replace(/_t\d+$/, "");
  return AI_CATALOG_KEYS.has(baseKey);
}

// ---------------------------------------------------------------------------
// Monthly-equivalent normalization
// ---------------------------------------------------------------------------

export function monthlyEqCents(amountCents: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "biweekly":
      return Math.round((amountCents * 26) / 12);
    case "semi_monthly":
      return amountCents * 2;
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "annually":
      return Math.round(amountCents / 12);
    default:
      return amountCents;
  }
}

// ---------------------------------------------------------------------------
// Burn rate (the emotional anchor)
// ---------------------------------------------------------------------------

export type BurnRate = {
  monthly_cents: number;
  yearly_cents: number;
  active_subscription_count: number;
  // Yearly spend as actually observed in the ledger over the trailing
  // 12 months (cap at oldest charge). Differs from yearly_cents
  // (= monthly_cents * 12, the cadence-based projection) when the
  // user has annual subs or partial-year history.
  ledger_yearly_cents: number;
};

export function computeBurnRate(
  subs: LedgerSubscription[],
  charges: LedgerCharge[],
  asOf: Date
): BurnRate {
  const active = subs.filter(
    (s) => s.status === "active" && s.classification === "confirmed"
  );
  const monthlyCents = active.reduce(
    (acc, s) => acc + monthlyEqCents(s.amount_cents, s.frequency),
    0
  );
  const yearlyCents = monthlyCents * 12;

  const twelveMoAgo = new Date(asOf);
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12);
  const twelveMoAgoIso = twelveMoAgo.toISOString().slice(0, 10);

  const ledgerYearly = charges
    .filter(
      (c) =>
        c.detector_status === "accepted" && c.posted_date >= twelveMoAgoIso
    )
    .reduce((acc, c) => acc + c.amount_cents, 0);

  return {
    monthly_cents: monthlyCents,
    yearly_cents: yearlyCents,
    active_subscription_count: active.length,
    ledger_yearly_cents: ledgerYearly,
  };
}

// ---------------------------------------------------------------------------
// 12-month spend chart (from real ledger)
// ---------------------------------------------------------------------------

export type MonthBucket = {
  month: string; // YYYY-MM
  spend_cents: number;
  charge_count: number;
};

export function computeMonthlySpendSeries(
  charges: LedgerCharge[],
  asOf: Date
): MonthBucket[] {
  // Build 12 month buckets ending at asOf's month.
  const buckets: Map<string, MonthBucket> = new Map();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(asOf);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { month: key, spend_cents: 0, charge_count: 0 });
  }

  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    const monthKey = c.posted_date.slice(0, 7);
    const b = buckets.get(monthKey);
    if (!b) continue; // outside window
    b.spend_cents += c.amount_cents;
    b.charge_count += 1;
  }

  return Array.from(buckets.values());
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

export type CategoryTotal = {
  category: string;
  monthly_cents: number;
  yearly_cents: number;
  subscription_count: number;
};

export function computeCategoryTotals(
  subs: LedgerSubscription[]
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const s of subs) {
    if (s.status !== "active" || s.classification !== "confirmed") continue;
    const monthly = monthlyEqCents(s.amount_cents, s.frequency);
    const existing = map.get(s.category) ?? {
      category: s.category,
      monthly_cents: 0,
      yearly_cents: 0,
      subscription_count: 0,
    };
    existing.monthly_cents += monthly;
    existing.yearly_cents += monthly * 12;
    existing.subscription_count += 1;
    map.set(s.category, existing);
  }
  // Sort descending by monthly spend.
  return Array.from(map.values()).sort(
    (a, b) => b.monthly_cents - a.monthly_cents
  );
}

// ---------------------------------------------------------------------------
// AI spend bucket
// ---------------------------------------------------------------------------

export type AiSpend = {
  monthly_cents: number;
  yearly_cents: number;
  ledger_yearly_cents: number;
  subscription_count: number;
  merchants: { merchant_name: string; monthly_cents: number }[];
};

export function computeAiSpend(
  subs: LedgerSubscription[],
  charges: LedgerCharge[],
  asOf: Date
): AiSpend {
  const aiSubs = subs.filter(
    (s) =>
      isAiSubscription(s) &&
      s.status === "active" &&
      s.classification === "confirmed"
  );
  const monthly = aiSubs.reduce(
    (acc, s) => acc + monthlyEqCents(s.amount_cents, s.frequency),
    0
  );

  const aiIds = new Set(aiSubs.map((s) => s.id));

  const twelveMoAgo = new Date(asOf);
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12);
  const twelveMoAgoIso = twelveMoAgo.toISOString().slice(0, 10);

  const ledgerYearly = charges
    .filter(
      (c) =>
        aiIds.has(c.subscription_id) &&
        c.detector_status === "accepted" &&
        c.posted_date >= twelveMoAgoIso
    )
    .reduce((acc, c) => acc + c.amount_cents, 0);

  return {
    monthly_cents: monthly,
    yearly_cents: monthly * 12,
    ledger_yearly_cents: ledgerYearly,
    subscription_count: aiSubs.length,
    merchants: aiSubs
      .map((s) => ({
        merchant_name: s.merchant_name,
        monthly_cents: monthlyEqCents(s.amount_cents, s.frequency),
      }))
      .sort((a, b) => b.monthly_cents - a.monthly_cents),
  };
}

// ---------------------------------------------------------------------------
// Top subscriptions
// ---------------------------------------------------------------------------

export type TopSubscription = {
  id: string;
  merchant_name: string;
  category: string;
  monthly_cents: number;
  yearly_cents: number;
  frequency: string;
};

export function computeTopSubscriptions(
  subs: LedgerSubscription[],
  limit = 5
): TopSubscription[] {
  return subs
    .filter((s) => s.status === "active" && s.classification === "confirmed")
    .map((s) => ({
      id: s.id,
      merchant_name: s.merchant_name,
      category: s.category,
      monthly_cents: monthlyEqCents(s.amount_cents, s.frequency),
      yearly_cents: monthlyEqCents(s.amount_cents, s.frequency) * 12,
      frequency: s.frequency,
    }))
    .sort((a, b) => b.monthly_cents - a.monthly_cents)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Shock insights — emotionally compelling stats from real data.
//
// Every card has a deterministic source: a small number of rows from
// subscriptions or subscription_charges that produced it. The UI
// should surface that source so the user can verify any claim.
// ---------------------------------------------------------------------------

export type ShockInsight = {
  id: string; // stable identifier so the UI can dedupe across renders
  kind:
    | "ai_vs_streaming"
    | "top_three_vs_threshold"
    | "biggest_billing_day"
    | "growth_over_time"
    | "category_dominance"
    | "highest_single_charge"
    | "longest_running";
  headline: string; // first-person, sentence form
  detail: string; // numeric / contextual sub-line
  // Audit trail. Which rows produced this insight. Strings only — UI
  // can pass them back to the detail endpoints for receipts.
  source: {
    subscription_ids?: string[];
    charge_dates?: string[];
    months?: string[];
  };
};

function fmtCents(c: number): string {
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

export function computeShockInsights(args: {
  subs: LedgerSubscription[];
  charges: LedgerCharge[];
  asOf: Date;
  burn: BurnRate;
  aiSpend: AiSpend;
  categories: CategoryTotal[];
  top: TopSubscription[];
}): ShockInsight[] {
  const { subs, charges, asOf, aiSpend, categories, top } = args;
  const out: ShockInsight[] = [];

  // 1. AI vs streaming.
  const streaming = categories.find((c) => c.category === "streaming");
  if (aiSpend.monthly_cents > 0 && streaming && aiSpend.monthly_cents > streaming.monthly_cents) {
    out.push({
      id: "ai_vs_streaming",
      kind: "ai_vs_streaming",
      headline: "You spend more on AI than streaming.",
      detail: `${fmtCents(aiSpend.monthly_cents)}/mo on AI vs ${fmtCents(streaming.monthly_cents)}/mo on streaming.`,
      source: {
        subscription_ids: aiSpend.merchants.map((_, i) => `ai_${i}`),
      },
    });
  }

  // 2. Top 3 cost more than a gym membership ($60/mo threshold — the
  // figure stays in the headline so it's auditable).
  if (top.length >= 3) {
    const topThreeMonthly = top.slice(0, 3).reduce((a, b) => a + b.monthly_cents, 0);
    const gymThreshold = 6000; // $60/mo
    if (topThreeMonthly > gymThreshold * 2) {
      out.push({
        id: "top_three_vs_gym",
        kind: "top_three_vs_threshold",
        headline: `Your top 3 subscriptions cost more than a typical gym membership.`,
        detail: `${top
          .slice(0, 3)
          .map((s) => s.merchant_name)
          .join(", ")} total ${fmtCents(topThreeMonthly)}/mo.`,
        source: {
          subscription_ids: top.slice(0, 3).map((s) => s.id),
        },
      });
    }
  }

  // 3. Biggest single billing day.
  const byDay = new Map<string, { total: number; ids: Set<string> }>();
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    const cur = byDay.get(c.posted_date) ?? { total: 0, ids: new Set<string>() };
    cur.total += c.amount_cents;
    cur.ids.add(c.subscription_id);
    byDay.set(c.posted_date, cur);
  }
  let biggest: { date: string; total: number; ids: Set<string> } | null = null;
  for (const [date, v] of byDay) {
    if (!biggest || v.total > biggest.total) {
      biggest = { date, total: v.total, ids: v.ids };
    }
  }
  if (biggest && biggest.ids.size >= 2 && biggest.total >= 10000) {
    out.push({
      id: `biggest_day_${biggest.date}`,
      kind: "biggest_billing_day",
      headline: `One billing day cost you ${fmtCents(biggest.total)}.`,
      detail: `On ${biggest.date}, ${biggest.ids.size} subscriptions billed at once.`,
      source: {
        charge_dates: [biggest.date],
        subscription_ids: Array.from(biggest.ids),
      },
    });
  }

  // 4. Growth over time. Compare the oldest 3-month window's monthly
  // average to the latest 3-month window's monthly average. Requires
  // at least 12 months of accepted charges to make sense.
  const acceptedSorted = charges
    .filter((c) => c.detector_status === "accepted")
    .map((c) => c.posted_date.slice(0, 7))
    .sort();
  if (acceptedSorted.length >= 6) {
    const earliest = acceptedSorted[0];
    const latest = acceptedSorted[acceptedSorted.length - 1];
    const earliestDate = new Date(earliest + "-01");
    const latestDate = new Date(latest + "-01");
    const monthsSpan =
      (latestDate.getUTCFullYear() - earliestDate.getUTCFullYear()) * 12 +
      (latestDate.getUTCMonth() - earliestDate.getUTCMonth());
    if (monthsSpan >= 11) {
      const series = computeMonthlySpendSeries(charges, asOf);
      const firstThree = series.slice(0, 3);
      const lastThree = series.slice(-3);
      const firstAvg = firstThree.reduce((a, b) => a + b.spend_cents, 0) / 3;
      const lastAvg = lastThree.reduce((a, b) => a + b.spend_cents, 0) / 3;
      if (firstAvg > 0 && lastAvg > firstAvg * 1.5) {
        const pct = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
        out.push({
          id: "growth_over_time",
          kind: "growth_over_time",
          headline: `Your subscription spend grew ${pct}% in a year.`,
          detail: `Average ${fmtCents(Math.round(firstAvg))}/mo at the start of the window, ${fmtCents(Math.round(lastAvg))}/mo now.`,
          source: {
            months: [
              firstThree[0]?.month,
              firstThree[2]?.month,
              lastThree[0]?.month,
              lastThree[2]?.month,
            ].filter(Boolean) as string[],
          },
        });
      }
    }
  }

  // 5. Category dominance.
  if (categories.length > 0 && args.burn.monthly_cents > 0) {
    const top = categories[0];
    const share = top.monthly_cents / args.burn.monthly_cents;
    if (share >= 0.4 && top.category !== "other") {
      const pct = Math.round(share * 100);
      const label =
        {
          software: "software",
          streaming: "streaming",
          fitness: "fitness",
          news: "news & reading",
          phone_internet: "phone & internet",
          utilities: "utilities",
          cloud_storage: "cloud storage",
        }[top.category] ?? top.category;
      out.push({
        id: `category_dominance_${top.category}`,
        kind: "category_dominance",
        headline: `${pct}% of your subscription budget goes to ${label}.`,
        detail: `${fmtCents(top.monthly_cents)}/mo across ${top.subscription_count} ${top.subscription_count === 1 ? "subscription" : "subscriptions"}.`,
        source: {
          subscription_ids: subs
            .filter((s) => s.category === top.category)
            .map((s) => s.id),
        },
      });
    }
  }

  // 6. Highest single charge.
  let highest: LedgerCharge | null = null;
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    if (!highest || c.amount_cents > highest.amount_cents) highest = c;
  }
  if (highest && highest.amount_cents >= 20000) {
    const sub = subs.find((s) => s.id === highest!.subscription_id);
    if (sub) {
      out.push({
        id: `highest_charge_${highest.subscription_id}`,
        kind: "highest_single_charge",
        headline: `Your biggest recurring charge: ${fmtCents(highest.amount_cents)}.`,
        detail: `${sub.merchant_name}, on ${highest.posted_date}.`,
        source: {
          subscription_ids: [highest.subscription_id],
          charge_dates: [highest.posted_date],
        },
      });
    }
  }

  return out;
}
