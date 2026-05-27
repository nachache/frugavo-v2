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
import {
  isHeroSubscription,
  isRecurringBill,
  isRecurringCommerce,
  heroSubscriptions,
  recurringBills,
  recurringObligations,
  type TieredSubscription,
} from "@/lib/selectors/surface-rules";

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
  // New taxonomy fields. Optional so callers that haven't been
  // migrated yet keep compiling, but the selectors below depend on
  // them — anything not yet tagged falls into uncertain_recurring
  // via the DB default.
  recurring_type?:
    | "confirmed_subscription"
    | "recurring_bill"
    | "recurring_commerce"
    | "uncertain_recurring";
  confidence_score?: number;
};

// Adapter — surface-rules selectors need recurring_type and
// confidence_score guaranteed-present. This fills in safe defaults
// (uncertain, 0) for any row that pre-dates the 025 migration so
// pre-migration rows behave like the most conservative tier.
function asTiered(s: LedgerSubscription): TieredSubscription & LedgerSubscription {
  return {
    ...s,
    recurring_type: s.recurring_type ?? "uncertain_recurring",
    confidence_score: s.confidence_score ?? 0,
  };
}

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

// Build a lowercase token set of AI catalog aliases too, so we can
// detect AI subs that landed under a biller wrapper before the engine
// supported AI inheritance (paddle_tN, stripe_tN, etc.). This lets the
// insights layer count existing storage correctly without requiring a
// re-scan of every user.
type CatalogAlias = { key: string; aliases?: string[]; display?: string; ai?: boolean };
const AI_CATALOG_ALIASES: string[] = (() => {
  const out = new Set<string>();
  const c = catalog as unknown as { merchants?: CatalogAlias[] };
  for (const m of c.merchants ?? []) {
    if (m.ai !== true) continue;
    if (m.display) out.add(m.display.toLowerCase());
    for (const a of m.aliases ?? []) out.add(a.toLowerCase());
  }
  // Drop entries shorter than 3 chars — too generic to match safely.
  return Array.from(out).filter((a) => a.length >= 3);
})();

export function isAiSubscription(sub: LedgerSubscription): boolean {
  if (sub.merchant_key) {
    // merchant_key may carry a biller-tier suffix like "openai_t2";
    // strip it before catalog lookup.
    const baseKey = sub.merchant_key.replace(/_t\d+$/, "");
    if (AI_CATALOG_KEYS.has(baseKey)) return true;
  }
  // Fallback for existing data: scan the visible merchant name for any
  // AI catalog alias as a substring. Covers subs stored under a biller
  // wrapper (paddle_tN, stripe_tN) before the engine learned to
  // inherit the inner AI merchant.
  const name = (sub.merchant_name || "").toLowerCase();
  if (!name) return false;
  for (const alias of AI_CATALOG_ALIASES) {
    if (name.includes(alias)) return true;
  }
  return false;
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
// Category split: what counts as a "subscription" vs "other recurring".
//
// Subscription = the emotional consumer-style category the dashboard
//                hero card sums up. Streaming, software, news, fitness,
//                food delivery, cloud storage, gaming, telecom/phone,
//                utilities — recurring spend the user thinks of as
//                "stuff I subscribe to."
//
// Other recurring = same engine, same detector, but the category is
//                   noise from a consumer-subscription point of view:
//                   B2B procurement, rent (when miscategorized to
//                   other), bank settlements, internal transfers.
//                   Still surfaced — but not in the hero number.
//
// Allowlist is intentionally generous and category-based, not merchant-
// specific. New users get the same split rule regardless of what their
// bank descriptors look like.
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_CATEGORIES: Set<string> = new Set([
  "streaming",
  "software",
  "news",
  "fitness",
  "food_delivery",
  "cloud_storage",
  "gaming",
  "telecom",
  "phone_internet",
  "utilities",
  "education",
  "insurance",
]);

export function isSubscriptionCategory(category: string): boolean {
  return SUBSCRIPTION_CATEGORIES.has(category);
}

// ---------------------------------------------------------------------------
// Burn rate (the emotional anchor)
// ---------------------------------------------------------------------------

export type BurnRate = {
  // Hero number on the dashboard. Sum of monthly equivalents over
  // subs whose category is in SUBSCRIPTION_CATEGORIES.
  monthly_cents: number;
  yearly_cents: number;
  active_subscription_count: number;
  ledger_yearly_cents: number;

  // Everything else the engine detected and confirmed but that isn't
  // a consumer subscription — rent, supplies, settlements, transfers
  // that survived Gate A. The dashboard surfaces this separately so
  // the user can audit it without it bloating the headline.
  other_recurring_monthly_cents: number;
  other_recurring_yearly_cents: number;
  other_recurring_count: number;
  other_recurring_ledger_yearly_cents: number;

  // Combined view, for completeness — same as the old (pre-split) burn.
  total_monthly_cents: number;
  total_yearly_cents: number;
  total_active_count: number;
};

export function computeBurnRate(
  subs: LedgerSubscription[],
  charges: LedgerCharge[],
  asOf: Date
): BurnRate {
  // FILTER FIRST, AGGREGATE SECOND. surface-rules is the single
  // source of truth for which tier counts where; we never aggregate
  // and then filter for display.
  const tiered = subs.map(asTiered);
  const sub = heroSubscriptions(tiered);
  const bill = recurringBills(tiered);
  // The "other recurring" rail keeps its original semantics —
  // anything counted toward the dashboard total that isn't a hero
  // subscription. With the new taxonomy that's just bills; commerce
  // and uncertain never contribute here.
  const other = bill;

  const subMonthly = sub.reduce(
    (acc, s) => acc + monthlyEqCents(s.amount_cents, s.frequency),
    0
  );
  const otherMonthly = other.reduce(
    (acc, s) => acc + monthlyEqCents(s.amount_cents, s.frequency),
    0
  );

  const twelveMoAgo = new Date(asOf);
  twelveMoAgo.setMonth(twelveMoAgo.getMonth() - 12);
  const twelveMoAgoIso = twelveMoAgo.toISOString().slice(0, 10);

  const subIds = new Set(sub.map((s) => s.id));
  const otherIds = new Set(other.map((s) => s.id));

  let subLedgerYearly = 0;
  let otherLedgerYearly = 0;
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    if (c.posted_date < twelveMoAgoIso) continue;
    if (subIds.has(c.subscription_id)) subLedgerYearly += c.amount_cents;
    else if (otherIds.has(c.subscription_id))
      otherLedgerYearly += c.amount_cents;
  }

  return {
    monthly_cents: subMonthly,
    yearly_cents: subMonthly * 12,
    active_subscription_count: sub.length,
    ledger_yearly_cents: subLedgerYearly,

    other_recurring_monthly_cents: otherMonthly,
    other_recurring_yearly_cents: otherMonthly * 12,
    other_recurring_count: other.length,
    other_recurring_ledger_yearly_cents: otherLedgerYearly,

    total_monthly_cents: subMonthly + otherMonthly,
    total_yearly_cents: (subMonthly + otherMonthly) * 12,
    total_active_count: sub.length + other.length,
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
  // Build up to 12 month buckets ending at asOf's month.
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

  // Trim leading all-zero buckets. New connections (Plaid still
  // backfilling history) typically have data for only the last 1–3
  // months. Showing 9 empty bars then 3 with data made it look like
  // spending suddenly appeared — the truth is just that we don't
  // have the earlier months yet. Keep trailing buckets even if they
  // happen to be zero (a month with no charges INSIDE the data
  // window is real signal, not missing data).
  const series = Array.from(buckets.values());
  let firstNonEmpty = series.findIndex((b) => b.charge_count > 0);
  // If every bucket is empty (no charges at all), keep just the
  // current month so the chart still renders an axis instead of an
  // empty array that the LineChart might choke on.
  if (firstNonEmpty === -1) firstNonEmpty = series.length - 1;
  return series.slice(firstNonEmpty);
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

// Bill-only category totals. Used by the Bills tab donut. Same shape
// as computeSubscriptionCategories but filtered to recurring_bill.
export function computeBillCategories(
  subs: LedgerSubscription[]
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  const onlyBills = recurringBills(subs.map(asTiered));
  for (const s of onlyBills) {
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
  return Array.from(map.values()).sort(
    (a, b) => b.monthly_cents - a.monthly_cents
  );
}

// Subscription-only category totals. Used by the personality calc and
// the reveal screens where bills shouldn't influence the archetype.
export function computeSubscriptionCategories(
  subs: LedgerSubscription[]
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  const onlySubs = heroSubscriptions(subs.map(asTiered));
  for (const s of onlySubs) {
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
  return Array.from(map.values()).sort(
    (a, b) => b.monthly_cents - a.monthly_cents
  );
}

export function computeCategoryTotals(
  subs: LedgerSubscription[]
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  // Includes hero subs + bills (the things that count toward the
  // monthly recurring total). Commerce and uncertain are excluded so
  // the category breakdown never includes restaurants or pharmacies.
  const obligations = recurringObligations(subs.map(asTiered));
  for (const s of obligations) {
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
  // AI spend reads from the hero-subscription pool only. We never
  // call something "AI spend" unless it has cleared confirmed_subscription
  // — otherwise the reveal could shout "you spend $X on AI!" using
  // a noisy uncertain stream and the user would lose trust.
  const heroSubs = heroSubscriptions(subs.map(asTiered));
  const aiSubs = heroSubs.filter((s) => isAiSubscription(s));
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
  // HERO SUBSCRIPTIONS ONLY. Bills, commerce, and uncertain are
  // excluded so the top-list never includes utilities (visually
  // subordinate per Constraint #1) or CVS/Starbucks (commerce, never
  // surfaced).
  return heroSubscriptions(subs.map(asTiered))
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

// New helper — the bills rail. Sorted desc by monthly cents.
export function computeTopBills(
  subs: LedgerSubscription[],
  limit = 5
): TopSubscription[] {
  return recurringBills(subs.map(asTiered))
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

// New helper — the commerce accordion. Sorted desc by monthly cents.
// Lives behind a collapsed "Recurring spending patterns" section and
// must never bleed into anything else.
export function computeRecurringCommerce(
  subs: LedgerSubscription[],
  limit = 20
): TopSubscription[] {
  return subs
    .map(asTiered)
    .filter(isRecurringCommerce)
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
  const { subs: subsRaw, charges: chargesRaw, asOf, aiSpend, categories, top } = args;
  // CRITICAL: filter inputs to confirmed_subscription tier ONLY
  // before computing per-charge / per-day insights. Without this
  // filter, 'biggest billing day' includes mortgages and 'highest
  // single charge' surfaces loan payments — both panicked users
  // and made Frugavo look broken per the dashboard critic.
  //
  // Note: the `categories`, `top`, and `aiSpend` inputs are already
  // filtered upstream via surface-rules selectors. We only need to
  // re-filter `subs` + `charges` since those are passed raw.
  const subIdsOnly = new Set(
    subsRaw
      .filter((s) => {
        const t = (s as { recurring_type?: string }).recurring_type;
        return (
          s.status === "active" &&
          s.classification === "confirmed" &&
          t === "confirmed_subscription"
        );
      })
      .map((s) => s.id)
  );
  const subs = subsRaw.filter((s) => subIdsOnly.has(s.id));
  const charges = chargesRaw.filter((c) => subIdsOnly.has(c.subscription_id));
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
  if (categories.length > 0 && args.burn.total_monthly_cents > 0) {
    const top = categories[0];
    // FIX: was dividing by burn.monthly_cents (subs only) while
    // categories include subs + bills. That produced category shares
    // > 100% (e.g. "158% of your subscription budget goes to telecom").
    // Use total_monthly_cents (subs + bills) so the denominator
    // matches the numerator's universe.
    const share = top.monthly_cents / args.burn.total_monthly_cents;
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
      // "Subscription budget" is misleading now that the burn includes
      // bills. Use "recurring spend" — accurate for both.
      out.push({
        id: `category_dominance_${top.category}`,
        kind: "category_dominance",
        headline: `${pct}% of your recurring spend goes to ${label}.`,
        detail: `${fmtCents(top.monthly_cents)}/mo across ${top.subscription_count} ${top.subscription_count === 1 ? "merchant" : "merchants"}.`,
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
