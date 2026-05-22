// Single canonical dashboard selector.
//
// One function. One return shape. Every component on /app reads from
// the result of this selector — no parallel paths, no duplicate
// computations, no inconsistent totals.
//
// Eliminates the "$10,054 / 32 subs vs $10,032 / 40 subs" class of
// bugs by making the data flow downhill: page reads selector once,
// passes the resulting DashboardData down. Children render from
// fields, never recompute from raw tables.

import { supabaseAdmin } from "@/lib/supabase";
import {
  computeBurnRate,
  computeAiSpend,
  computeCategoryTotals,
  computeTopSubscriptions,
  computeShockInsights,
  computeMonthlySpendSeries,
  type BurnRate,
  type AiSpend,
  type CategoryTotal,
  type LedgerCharge,
  type LedgerSubscription,
  type MonthBucket,
  type ShockInsight,
  type TopSubscription,
} from "@/lib/insights";
import { computePersonality, type Personality } from "@/lib/personality";
import { computeMoneyLeaks, type MoneyLeak } from "@/lib/money-leaks";
import catalog from "@/lib/data/merchant-catalog.json";

// ───────────────────────────────────────────────────────────────────
// Output shape — the ONLY shape the dashboard reads.
// ───────────────────────────────────────────────────────────────────

export type DashboardData = {
  meta: {
    user_id: string;
    as_of_iso: string;
    last_scanned_at: string | null;
    scanner_version: string | null;
  };

  // ─── Canonical monthly upkeep ─────────────────────────────────────
  // total_*  fields are THE canonical Monthly Upkeep numbers.
  // sub_* and other_* are explicitly labeled splits — only render
  // them as secondary, never as the headline.
  monthly: {
    total_cents: number;
    total_count: number;
    sub_only_cents: number;
    sub_only_count: number;
    other_recurring_cents: number;
    other_recurring_count: number;
  };
  yearly: {
    total_cents: number;       // = monthly.total_cents * 12
    sub_only_cents: number;    // = sub_only_cents * 12
    ledger_actual_cents: number; // accepted-charge sum over trailing 12mo
  };

  // ─── Chart + breakdown ────────────────────────────────────────────
  chart_12mo: MonthBucket[];
  categories: CategoryTotal[];

  // ─── Pinned insight tiles + lists ────────────────────────────────
  ai_spend: AiSpend;
  top_subscriptions: TopSubscription[];
  shock_insights: ShockInsight[];     // → Patterns column
  money_leaks: MoneyLeak[];           // → Alerts column

  // ─── Identity ─────────────────────────────────────────────────────
  personality: Personality;

  // ─── Action center tab counts ────────────────────────────────────
  // worth_a_look: subscriptions the user hasn't acted on (no decision).
  // watching: user_decision = 'kept' (or equivalent).
  // pruned: user_decision = 'cancelled'.
  // Each list is the actual subset of subscription ids the tab shows.
  actions: {
    worth_a_look: ActionItem[];
    watching: ActionItem[];
    pruned: ActionItem[];
    potential_yearly_savings_cents: number;
  };

  // ─── Raw passthrough for the SubscriptionsList component ─────────
  subscriptions: LedgerSubscription[];
  burn_internal: BurnRate;
};

export type ActionItem = {
  subscription_id: string;
  merchant_name: string;
  merchant_key: string | null;
  domain: string | null;
  category: string;
  monthly_cents: number;
  yearly_cents: number;
  frequency: string;
  last_charged_at: string | null;
  status: string;
  classification: string | null;
  reason: string | null;
  // Display-only tags surfaced inline next to the merchant name
  // ("Biggest line item", "Might be forgotten").
  tags: string[];
};

export async function buildDashboardData(
  userId: string
): Promise<DashboardData | null> {
  if (!supabaseAdmin) return null;
  const asOf = new Date();

  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at, user_decision"
    )
    .eq("user_id", userId);
  const subs = (subsData ?? []) as Array<
    LedgerSubscription & { user_decision: string | null }
  >;

  const charges: LedgerCharge[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (offset < 100_000) {
    const { data, error } = await supabaseAdmin
      .from("subscription_charges")
      .select(
        "subscription_id, posted_date, amount_cents, detector_status, cadence_cycle_id"
      )
      .eq("user_id", userId)
      .order("posted_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const page = (data ?? []) as LedgerCharge[];
    charges.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  const { data: latestScan } = await supabaseAdmin
    .from("scan_runs")
    .select("finished_at, scanner_version")
    .eq("user_id", userId)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const burn = computeBurnRate(subs, charges, asOf);
  const ai = computeAiSpend(subs, charges, asOf);
  const categories = computeCategoryTotals(subs);
  const top = computeTopSubscriptions(subs, 5);
  const shock = computeShockInsights({
    subs,
    charges,
    asOf,
    burn,
    aiSpend: ai,
    categories,
    top,
  });
  const personality = computePersonality({
    categories,
    aiMonthlyCents: ai.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });
  const moneyLeaks = computeMoneyLeaks({ subs, charges, asOf });
  const chart12mo = computeMonthlySpendSeries(charges, asOf);

  const decisionByMerchant = new Map<string, string | null>();
  for (const s of subs) {
    decisionByMerchant.set(s.id, s.user_decision ?? null);
  }
  const leakReasonById = new Map<string, string>();
  for (const leak of moneyLeaks) {
    for (const sid of leak.source.subscription_ids ?? []) {
      if (!leakReasonById.has(sid)) {
        leakReasonById.set(sid, leak.headline);
      }
    }
  }
  const monthlyEq = (amount: number, freq: string): number => {
    switch (freq) {
      case "weekly":
        return Math.round((amount * 52) / 12);
      case "biweekly":
        return Math.round((amount * 26) / 12);
      case "semi_monthly":
        return amount * 2;
      case "monthly":
        return amount;
      case "quarterly":
        return Math.round(amount / 3);
      case "annually":
        return Math.round(amount / 12);
      default:
        return amount;
    }
  };

  // Domain lookup: walk the catalog once and build a merchant_key →
  // domain map. Strip biller-tier suffixes (e.g. paypal_t4) before
  // matching so amount-bucketed merchant_keys still resolve.
  type CatalogEntry = { key: string; domains?: string[] };
  type CatalogShape = { merchants?: CatalogEntry[]; billers?: CatalogEntry[] };
  const c = catalog as unknown as CatalogShape;
  const domainByKey = new Map<string, string>();
  for (const e of [...(c.merchants ?? []), ...(c.billers ?? [])]) {
    if (e.domains && e.domains.length > 0) {
      domainByKey.set(e.key, e.domains[0]);
    }
  }
  const lookupDomain = (key: string | null | undefined): string | null => {
    if (!key) return null;
    const stripped = key.replace(/_t\d+$/, "");
    return domainByKey.get(stripped) ?? null;
  };

  // First pass — build action items WITHOUT tags so we can rank them
  // by monthly cost and assign "Biggest line item" to top N.
  const baseActions = subs
    .filter((s) => s.classification === "confirmed")
    .map((s) => {
      const m = monthlyEq(s.amount_cents, s.frequency);
      return {
        sub: s,
        monthly: m,
      };
    });

  const rankedByPrice = [...baseActions].sort(
    (a, b) => b.monthly - a.monthly
  );
  const biggestIds = new Set(
    rankedByPrice.slice(0, 3).map((b) => b.sub.id)
  );

  // "Might be forgotten" — no charge in 30+ days but still active.
  const thirtyDaysAgo = new Date(asOf);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const allActions: ActionItem[] = baseActions.map(({ sub: s, monthly: m }) => {
    const tags: string[] = [];
    if (biggestIds.has(s.id)) tags.push("Biggest line item");
    if (
      s.last_charged_at &&
      s.last_charged_at < cutoff &&
      s.status === "active"
    ) {
      tags.push("Might be forgotten");
    }
    return {
      subscription_id: s.id,
      merchant_name: s.merchant_name,
      merchant_key: s.merchant_key ?? null,
      domain: lookupDomain(s.merchant_key ?? null),
      category: s.category,
      monthly_cents: m,
      yearly_cents: m * 12,
      frequency: s.frequency,
      last_charged_at: s.last_charged_at,
      status: s.status,
      classification: s.classification,
      reason: leakReasonById.get(s.id) ?? null,
      tags,
    };
  });

  const worth_a_look: ActionItem[] = allActions
    .filter((a) => {
      const decision = decisionByMerchant.get(a.subscription_id);
      return !decision || decision === "needs_review" || decision === "uncertain";
    })
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const watching: ActionItem[] = allActions
    .filter((a) => {
      const d = decisionByMerchant.get(a.subscription_id);
      return d === "kept" || d === "keep";
    })
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const pruned: ActionItem[] = allActions
    .filter((a) => {
      const d = decisionByMerchant.get(a.subscription_id);
      return d === "cancelled" || d === "cancel";
    })
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  return {
    meta: {
      user_id: userId,
      as_of_iso: asOf.toISOString(),
      last_scanned_at: latestScan?.finished_at ?? null,
      scanner_version: (latestScan?.scanner_version as string | undefined) ?? null,
    },
    monthly: {
      total_cents: burn.total_monthly_cents,
      total_count: burn.total_active_count,
      sub_only_cents: burn.monthly_cents,
      sub_only_count: burn.active_subscription_count,
      other_recurring_cents: burn.other_recurring_monthly_cents,
      other_recurring_count: burn.other_recurring_count,
    },
    yearly: {
      total_cents: burn.total_yearly_cents,
      sub_only_cents: burn.yearly_cents,
      ledger_actual_cents: burn.ledger_yearly_cents,
    },
    chart_12mo: chart12mo,
    categories,
    ai_spend: ai,
    top_subscriptions: top,
    shock_insights: shock,
    money_leaks: moneyLeaks,
    personality,
    actions: {
      worth_a_look,
      watching,
      pruned,
      potential_yearly_savings_cents: worth_a_look.reduce(
        (acc, a) => acc + a.yearly_cents,
        0
      ),
    },
    subscriptions: subs,
    burn_internal: burn,
  };
}
