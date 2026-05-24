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
  computeSubscriptionCategories,
  computeTopSubscriptions,
  computeRecurringCommerce,
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

  // ─── Action center tabs ──────────────────────────────────────────
  // Source of truth is user_overrides.override_type:
  //   confirmed         → watching
  //   cancelled         → pruned
  //   not_recurring     → hidden
  //   not_subscription  → hidden
  //   none / wrong_*    → worth_a_look
  // legacy subscriptions.user_decision is also honored for back-compat.
  actions: {
    worth_a_look: ActionItem[];
    watching: ActionItem[];
    pruned: ActionItem[];
    hidden: ActionItem[];
    potential_yearly_savings_cents: number;
  };

  // ─── Recurring commerce accordion ────────────────────────────────
  // Spend patterns the engine noticed but classified as commerce —
  // NOT shown in totals, NOT shown in the main list. Lives in the
  // collapsed "Recurring spending patterns" accordion below the
  // main subscription list. Each item can be promoted to a real
  // subscription via the feedback button if the user disagrees.
  recurring_commerce: TopSubscription[];

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
  // Display-derived monthly equivalent (used for the right-side $/mo
  // column in the list).
  monthly_cents: number;
  yearly_cents: number;
  // RAW amount as stored on the subscription. CancelModal consumes
  // this together with frequency to derive its own monthly/annual.
  amount_cents: number;
  currency: string;
  frequency: string;
  last_charged_at: string | null;
  next_expected_charge_at: string | null;
  status: string;
  classification: string | null;
  reason: string | null;
  tags: string[];
  // Echo of the active override so the UI knows which tab this item
  // belongs in without re-deriving from user_decision.
  override_type: string | null;
};

export async function buildDashboardData(
  userId: string
): Promise<DashboardData | null> {
  if (!supabaseAdmin) return null;
  const asOf = new Date();

  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at, next_expected_charge_at, user_decision, recurring_type, confidence_score"
    )
    .eq("user_id", userId);
  const subs = (subsData ?? []) as Array<
    LedgerSubscription & {
      user_decision: string | null;
      next_expected_charge_at: string | null;
    }
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
  // Personality derives ONLY from confirmed subscriptions — bills
  // shouldn't drag the archetype toward "The Utility Payer" and
  // commerce was already filtered out by surface-rules.
  const subscriptionCats = computeSubscriptionCategories(subs);
  const personality = computePersonality({
    categories: subscriptionCats,
    aiMonthlyCents: ai.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });
  const moneyLeaks = computeMoneyLeaks({ subs, charges, asOf });
  const chart12mo = computeMonthlySpendSeries(charges, asOf);
  // Spending-patterns accordion input. Commerce tier only.
  const recurringCommerce = computeRecurringCommerce(subs, 25);

  const decisionByMerchant = new Map<string, string | null>();
  for (const s of subs) {
    decisionByMerchant.set(s.id, s.user_decision ?? null);
  }

  // Pull user_overrides — the new source of truth for tab placement.
  // Keyed by merchant_key. We merge with the legacy user_decision
  // field below so existing kept/cancelled state still works.
  const overrideByMerchant = new Map<string, string>();
  {
    const { data: overrideRows } = await supabaseAdmin
      .from("user_overrides")
      .select("merchant_key, override_type")
      .eq("user_id", userId);
    for (const row of (overrideRows ?? []) as Array<{
      merchant_key: string;
      override_type: string;
    }>) {
      overrideByMerchant.set(row.merchant_key, row.override_type);
    }
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
    const ov = s.merchant_key ? overrideByMerchant.get(s.merchant_key) ?? null : null;
    return {
      subscription_id: s.id,
      merchant_name: s.merchant_name,
      merchant_key: s.merchant_key ?? null,
      domain: lookupDomain(s.merchant_key ?? null),
      category: s.category,
      monthly_cents: m,
      yearly_cents: m * 12,
      amount_cents: s.amount_cents,
      currency: s.currency,
      frequency: s.frequency,
      last_charged_at: s.last_charged_at,
      next_expected_charge_at:
        (s as { next_expected_charge_at?: string | null }).next_expected_charge_at ??
        null,
      status: s.status,
      classification: s.classification,
      reason: leakReasonById.get(s.id) ?? null,
      tags,
      override_type: ov,
    };
  });

  // Bucket placement priority: override_type wins over legacy
  // user_decision. Anything explicitly marked as not_subscription or
  // not_recurring goes to Hidden; the user has told us this isn't a
  // subscription so we shouldn't keep nagging them about it.
  const inWatching = (a: ActionItem) =>
    a.override_type === "confirmed" ||
    a.override_type === "wrong_amount" ||
    a.override_type === "wrong_cadence" ||
    decisionByMerchant.get(a.subscription_id) === "kept" ||
    decisionByMerchant.get(a.subscription_id) === "keep";
  const inPruned = (a: ActionItem) =>
    a.override_type === "cancelled" ||
    decisionByMerchant.get(a.subscription_id) === "cancelled" ||
    decisionByMerchant.get(a.subscription_id) === "cancel";
  const inHidden = (a: ActionItem) =>
    a.override_type === "not_subscription" ||
    a.override_type === "not_recurring";

  const watching: ActionItem[] = allActions
    .filter(inWatching)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const pruned: ActionItem[] = allActions
    .filter(inPruned)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const hidden: ActionItem[] = allActions
    .filter(inHidden)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const worth_a_look: ActionItem[] = allActions
    .filter((a) => !inWatching(a) && !inPruned(a) && !inHidden(a))
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
      hidden,
      potential_yearly_savings_cents: worth_a_look.reduce(
        (acc, a) => acc + a.yearly_cents,
        0
      ),
    },
    recurring_commerce: recurringCommerce,
    subscriptions: subs,
    burn_internal: burn,
  };
}
