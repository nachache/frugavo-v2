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
  computeBillCategories,
  computeTopSubscriptions,
  computeTopBills,
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
import {
  computeConcentrationInsight,
  type ConcentrationInsight,
} from "@/lib/intelligence/concentration";
import { computeBadges, type Badge } from "@/lib/intelligence/badges";
import {
  computeHealthScore,
  type HealthScore,
} from "@/lib/intelligence/health-score";
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
  // Subs-only and bills-only category breakdowns. Drive the donut
  // when the dashboard tab is set to subscriptions or bills
  // respectively. Combined `categories` is kept for the legacy view.
  subscription_categories: CategoryTotal[];
  bill_categories: CategoryTotal[];

  // ─── Pinned insight tiles + lists ────────────────────────────────
  ai_spend: AiSpend;
  top_subscriptions: TopSubscription[];
  top_bills: TopSubscription[];
  shock_insights: ShockInsight[];     // → Patterns column
  money_leaks: MoneyLeak[];           // → Alerts column

  // ─── Identity ─────────────────────────────────────────────────────
  personality: Personality;
  health_score: HealthScore;
  concentration: ConcentrationInsight;

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

  // ─── Bills action center (mirror of `actions` filtered to bills) ─
  // Used by the Bills tab on the dashboard. Same shape; data is
  // recurring_bill tier only.
  bill_actions: {
    worth_a_look: ActionItem[];
    watching: ActionItem[];
    pruned: ActionItem[];
    hidden: ActionItem[];
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
  // FORWARD-LOOKING projection: monthly × 12. Useful for "if you cancel
  // this, you save $X/yr" decisions. Always present.
  yearly_cents: number;
  // ACTUAL trailing-12-months paid (sum of accepted charges in the
  // last 365 days). For new bank connections with only N months of
  // history, this is the real amount paid so far — much smaller than
  // yearly_cents. The UI shows this with "$Y over Nmo" framing when
  // months_observed < 12 so the math matches the data span.
  paid_recent_cents: number;
  // Number of distinct calendar months in which this subscription
  // has at least one accepted charge, capped at 12. Drives the UI's
  // choice of "/yr" vs "over Nmo" label.
  months_observed: number;
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
  // Dynamic behavioral badges (price increased, likely forgotten,
  // annual trap, essential, stable for N months, etc). Up to 2.
  badges: Badge[];
};

// Dedupe subscription rows that point at the same real merchant.
// See use site in buildDashboardData for full rationale.
function dedupeByMerchantAndAmount<
  T extends {
    merchant_name: string;
    amount_cents: number;
    updated_at?: string | null;
  },
>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) {
    const normName = (r.merchant_name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!normName) {
      // No name to dedupe on; pass through with a unique key.
      seen.set(`__noname_${(r as { id?: string }).id ?? Math.random()}`, r);
      continue;
    }
    // Amount bucket: $1 granularity. Matching merchant + same dollar
    // bucket = same product. A real price increase ($14.99 → $17.99)
    // changes the bucket and stays as two distinct rows, which is
    // correct — the engine treats those as different streams.
    const bucket = Math.round(Math.abs(r.amount_cents) / 100);
    const key = `${normName}__${bucket}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
    } else {
      // Keep the most-recently-updated row.
      const aTime = new Date(existing.updated_at ?? 0).getTime();
      const bTime = new Date(r.updated_at ?? 0).getTime();
      if (bTime >= aTime) seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

export async function buildDashboardData(
  userId: string
): Promise<DashboardData | null> {
  if (!supabaseAdmin) return null;
  const asOf = new Date();

  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      // Phase F — brand_verdict_likelihood + confidence (0..1) are
      // the cutover signals the new baseActions filter reads. Keep
      // legacy fields (classification, recurring_type, confidence_score)
      // as fallback for rows that predate Phase B.
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at, next_expected_charge_at, user_decision, recurring_type, confidence_score, updated_at, brand_verdict_likelihood, confidence, canonical_merchant_key, source_key"
    )
    .eq("user_id", userId);
  const subsRaw = (subsData ?? []) as Array<
    LedgerSubscription & {
      user_decision: string | null;
      next_expected_charge_at: string | null;
      updated_at?: string | null;
    }
  >;

  // Dedupe rows that represent the same underlying merchant. Legacy
  // scans wrote slightly different merchant_keys for the same merchant
  // ('planet_fitness' vs 'planetfitness'), producing two subscription
  // rows with two different subscription_keys (hash of merchant_key)
  // that the upsert can't collapse on the next scan.
  //
  // Dedupe key: normalize merchant_name (lowercase, strip spaces +
  // punctuation) + amount_cents bucket. When duplicates exist, keep
  // the most-recently-updated row.
  const subsDeduped = dedupeByMerchantAndAmount(subsRaw);

  // ─── User-override pre-pass ───────────────────────────────────────
  //
  // Fetch user_overrides FIRST and inject their effect into each
  // subscription's recurring_type BEFORE feeding into computeBurnRate
  // / heroSubscriptions / category / personality / chart / everything.
  //
  // Without this, the OverviewCard's monthly total would only count
  // engine-confirmed subscriptions — user confirms via "Keep" or
  // "Real sub" (Quick Checks) wouldn't change the headline number
  // until the next scan re-classified the row. This was the
  // "I clicked Keep but the dashboard didn't update" bug.
  //
  // Mapping:
  //   override='confirmed'        → recurring_type='confirmed_subscription' (counts in)
  //   override='not_subscription' → recurring_type='uncertain_recurring' (filtered out)
  //   override='not_recurring'    → recurring_type='uncertain_recurring' (filtered out)
  //   override='cancelled'        → leave recurring_type; ActionCenter handles pruning
  //   no override                 → leave as engine-assigned
  const { data: earlyOverrideRows } = await supabaseAdmin
    .from("user_overrides")
    .select("merchant_key, override_type")
    .eq("user_id", userId);
  const earlyOverrideByMerchant = new Map<string, string>();
  for (const row of (earlyOverrideRows ?? []) as Array<{
    merchant_key: string;
    override_type: string;
  }>) {
    earlyOverrideByMerchant.set(row.merchant_key, row.override_type);
  }
  const subs = subsDeduped.map((s) => {
    if (!s.merchant_key) return s;
    const ov = earlyOverrideByMerchant.get(s.merchant_key);
    if (!ov) return s;
    if (ov === "confirmed") {
      return {
        ...s,
        recurring_type: "confirmed_subscription" as const,
      };
    }
    if (ov === "not_subscription" || ov === "not_recurring") {
      return {
        ...s,
        recurring_type: "uncertain_recurring" as const,
      };
    }
    return s;
  });

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

  // ─── Chart + insight sync ─────────────────────────────────────────
  //
  // Build a Set of subscription_ids the user CURRENTLY treats as
  // active subs (after override pre-pass). Filter the raw charges
  // array down to charges linked to those subs only, then pass the
  // filtered set to every downstream calculation that aggregates
  // money flow — chart, money leaks, shock insights, AI spend.
  //
  // Without this, marking a sub as "not a sub" hid it from the
  // total + sub count but its historical charges still pumped the
  // monthly-spend chart. Now chart, donut, total, list, AI stack,
  // and money leaks all agree on what counts.
  const visibleSubIds = new Set(
    subs
      .filter(
        (s) =>
          s.recurring_type === "confirmed_subscription" ||
          s.recurring_type === "recurring_bill"
      )
      .map((s) => s.id as string)
  );
  const visibleCharges = charges.filter((c) =>
    visibleSubIds.has(c.subscription_id)
  );

  const burn = computeBurnRate(subs, visibleCharges, asOf);
  const ai = computeAiSpend(subs, visibleCharges, asOf);
  const categories = computeCategoryTotals(subs);
  const top = computeTopSubscriptions(subs, 5);
  const topBills = computeTopBills(subs, 10);
  const shock = computeShockInsights({
    subs,
    charges: visibleCharges,
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
  // Bill-only category breakdown for the Bills tab donut.
  const billCats = computeBillCategories(subs);
  const personality = computePersonality({
    categories: subscriptionCats,
    aiMonthlyCents: ai.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });
  const moneyLeaks = computeMoneyLeaks({ subs, charges: visibleCharges, asOf });
  const chart12mo = computeMonthlySpendSeries(visibleCharges, asOf);
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
  //
  // CRITICAL TIER FILTER. Per the trust-rebuild brief: the action
  // center must NEVER show commerce items (CVS, Starbucks, Sephora,
  // Olive Garden, Whole Foods). Those live in the collapsed
  // "Recurring spending patterns" accordion ONLY. Confirmed
  // subscriptions and bills are the things the user wants to review,
  // cancel, keep, or hide. Uncertain items are internal-only.
  //
  // If the user later promotes a commerce item via the accordion's
  // "Actually a subscription?" button, the override sets recurring_type
  // → confirmed_subscription on the next render and it will appear
  // here. The filter is safe across that round-trip.
  // Phase F cutover — the dashboard now reads Claude's brand verdict
  // + engine confidence as the PRIMARY signal, falling back to the
  // legacy classifier columns only for rows that predate Phase B (no
  // brand_verdict_likelihood populated yet).
  //
  // Rules, in order:
  //   1. user_override wins outright.
  //      - 'confirmed' → include
  //      - 'not_subscription' / 'not_recurring' → exclude
  //   2. brand_verdict_likelihood (Claude's per-merchant judgment)
  //      - 'never'     → exclude (gas, fees, ATM — never a sub)
  //      - 'always'    → include (Netflix, Spotify, etc)
  //      - 'sometimes' → include only when confidence ≥ 0.85.
  //                      Lower-confidence rows live in the doubt
  //                      surface (QuickChecks) until the user
  //                      resolves them or the 7-day auto-promote
  //                      fires.
  //   3. NULL brand_verdict (pre-Phase-B scan) → legacy fallback:
  //      classification='confirmed' AND recurring_type in the old
  //      allowed set.
  const CUTOVER_CONFIDENCE_AUTO_CONFIRM = 0.85;
  const baseActions = subs
    .filter((s) => {
      // Defensive: a row without merchant_key has no overrides + no
      // brand verdict to consult; defer to legacy classifier below.
      const override = s.merchant_key
        ? overrideByMerchant.get(s.merchant_key)
        : undefined;
      if (override === "not_subscription" || override === "not_recurring") {
        return false;
      }
      if (override === "confirmed") return true;

      // Brand verdict path.
      const likelihood = (s as { brand_verdict_likelihood?: string | null })
        .brand_verdict_likelihood;
      const confidence =
        (s as { confidence?: number | null }).confidence ?? 0.5;
      if (likelihood === "never") return false;
      if (likelihood === "always") return true;
      if (likelihood === "sometimes") {
        return confidence >= CUTOVER_CONFIDENCE_AUTO_CONFIRM;
      }

      // Legacy fallback — pre-Phase-B scans only.
      if (s.classification !== "confirmed") return false;
      const tier = s.recurring_type ?? null;
      if (tier === "recurring_commerce") return false;
      if (tier === "uncertain_recurring") return false;
      return true;
    })
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

  // Build per-subscription real spend + observation span maps so each
  // action item carries an HONEST number alongside the projection.
  //
  // paid_recent_cents = sum of accepted charges in the trailing 365 days.
  // months_observed   = count of distinct YYYY-MM buckets in which this
  //                     sub has at least one accepted charge in the same
  //                     window (capped at 12).
  //
  // For a 3-month-old bank connection these correctly land at e.g.
  // $1,874 / 3, not the m × 12 projection of $7,496 / 12. The UI uses
  // these to render "/yr" or "over Nmo" depending on which is honest.
  const yearAgoIso = (() => {
    const d = new Date(asOf);
    d.setDate(d.getDate() - 365);
    return d.toISOString().slice(0, 10);
  })();
  const paidBySub = new Map<string, number>();
  const monthsBySub = new Map<string, Set<string>>();
  for (const c of charges) {
    if (c.detector_status !== "accepted") continue;
    if (c.posted_date < yearAgoIso) continue;
    const sid = c.subscription_id;
    paidBySub.set(sid, (paidBySub.get(sid) ?? 0) + c.amount_cents);
    let set = monthsBySub.get(sid);
    if (!set) {
      set = new Set<string>();
      monthsBySub.set(sid, set);
    }
    set.add(c.posted_date.slice(0, 7));
  }

  // "Unused 90+ days" — renamed from "Might be forgotten" and raised
  // from 60 → 90 days. Critic round 2: when 7 of 7 items said "Might
  // be forgotten" the label meant nothing. Two changes:
  //   1. Threshold is now 90 days so the tag only catches truly
  //      dormant subscriptions, not normal billing-cycle gaps.
  //   2. Even among qualifiers, we cap the tag to the top 3 stalest
  //      subs (longest gap since last_charged_at). Three is enough
  //      to draw the eye without spamming the grid.
  const ninetyDaysAgo = new Date(asOf);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);

  // Build the qualifying-stale set, sort by oldest last_charged_at
  // first, take the top 3 ids — only these get the badge.
  const staleQualifiers = baseActions
    .filter(
      ({ sub: s }) =>
        s.last_charged_at &&
        s.last_charged_at < cutoff &&
        s.status === "active"
    )
    .sort((a, b) =>
      (a.sub.last_charged_at ?? "").localeCompare(b.sub.last_charged_at ?? "")
    );
  const staleTaggedIds = new Set(staleQualifiers.slice(0, 3).map((q) => q.sub.id));

  // Rank by YEARLY equivalent for the high_yearly_impact badge.
  // baseActions already monthly-sorted; mirror it as yearly for clarity.
  const yearlyRankedIds = new Map<string, number>();
  [...baseActions]
    .sort((a, b) => b.monthly * 12 - a.monthly * 12)
    .forEach(({ sub: s }, idx) => {
      yearlyRankedIds.set(s.id, idx + 1);
    });

  // Duplicate detection — same category + similar normalized merchant
  // name = candidates for "possible duplicate". We compare the two
  // tokenized merchant names; if either is a prefix of the other or
  // they share a meaningful 4+ char token, flag both.
  const normName = (name: string): string =>
    (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const dupByMerchant = new Map<string, string>();
  for (let i = 0; i < baseActions.length; i++) {
    const a = baseActions[i].sub;
    if (!a.merchant_name || dupByMerchant.has(a.id)) continue;
    const na = normName(a.merchant_name);
    for (let j = i + 1; j < baseActions.length; j++) {
      const b = baseActions[j].sub;
      if (a.category !== b.category) continue;
      const nb = normName(b.merchant_name);
      if (na.length >= 4 && nb.length >= 4) {
        if (na.startsWith(nb) || nb.startsWith(na)) {
          dupByMerchant.set(a.id, b.merchant_name);
          dupByMerchant.set(b.id, a.merchant_name);
          break;
        }
      }
    }
  }

  const allActions: ActionItem[] = baseActions.map(({ sub: s, monthly: m }) => {
    const tags: string[] = [];
    if (biggestIds.has(s.id)) tags.push("Biggest line item");
    if (staleTaggedIds.has(s.id)) {
      tags.push("Unused 90+ days");
    }
    const ov = s.merchant_key ? overrideByMerchant.get(s.merchant_key) ?? null : null;
    const paidRecent = paidBySub.get(s.id) ?? 0;
    const monthsObs = Math.min(12, monthsBySub.get(s.id)?.size ?? 0);
    const yearlyRank = yearlyRankedIds.get(s.id);
    const badges = computeBadges({
      sub: {
        id: s.id,
        merchant_name: s.merchant_name,
        category: s.category,
        amount_cents: s.amount_cents,
        frequency: s.frequency,
        last_charged_at: s.last_charged_at,
      },
      charges,
      yearlyRank: yearlyRank && yearlyRank <= 3 ? yearlyRank : undefined,
      duplicateOfMerchant: dupByMerchant.get(s.id) ?? null,
      asOf,
    });
    return {
      subscription_id: s.id,
      merchant_name: s.merchant_name,
      merchant_key: s.merchant_key ?? null,
      domain: lookupDomain(s.merchant_key ?? null),
      category: s.category,
      monthly_cents: m,
      yearly_cents: m * 12,
      paid_recent_cents: paidRecent,
      months_observed: monthsObs,
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
      badges,
    };
  });

  // Bucket placement priority: override_type wins over legacy
  // user_decision. Anything explicitly marked as not_subscription or
  // not_recurring goes to Hidden; the user has told us this isn't a
  // subscription so we shouldn't keep nagging them about it.
  //
  // NOTE: override_type='confirmed' is NOT in inWatching anymore.
  // The QuickChecks "Real sub" chip writes override_type='confirmed'
  // — that means "yes this is a real subscription" but NOT "I've
  // decided to keep it." Conflating those routed every confirmed
  // sub into the Watching tab, hiding them from the user's
  // primary Worth a look view. Watching now means "I've explicitly
  // marked this as kept" via the dashboard's keep button OR the
  // legacy user_decision='kept' field. Confirmed-only subs flow
  // into worth_a_look like any other detected sub, so users
  // actually see what they confirmed.
  const inWatching = (a: ActionItem) =>
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

  // Split into subscription rows and bill rows so the Bills tab on
  // the dashboard has its own action center. We keep the SAME bucket
  // rules (Watching / Pruned / Hidden / Worth a look) — only the
  // input set differs by tier.
  const subActions: ActionItem[] = [];
  const billActions: ActionItem[] = [];
  for (const a of allActions) {
    // Look up the source subscription's recurring_type to route the
    // action item. Subs tier-mixed allActions split by tier here.
    const src = subs.find((s) => s.id === a.subscription_id);
    const tier = (src?.recurring_type as string | undefined) ?? "";
    if (tier === "recurring_bill") billActions.push(a);
    else subActions.push(a);
  }

  const watching: ActionItem[] = subActions
    .filter(inWatching)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const pruned: ActionItem[] = subActions
    .filter(inPruned)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const hidden: ActionItem[] = subActions
    .filter(inHidden)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  const worth_a_look: ActionItem[] = subActions
    .filter((a) => !inWatching(a) && !inPruned(a) && !inHidden(a))
    .sort((a, b) => b.monthly_cents - a.monthly_cents);

  // ─── Intelligence layer (concentration + health score) ───────────
  // Concentration over subscription-only category totals — the
  // donut already shows those, so the insight headline mirrors it.
  const concentration = computeConcentrationInsight(subscriptionCats);

  // Engagement signal — count distinct override actions in the last
  // 30 days. This is the "you've been actively reviewing" proxy that
  // feeds the engagement factor of the health score.
  let overrideCount = 0;
  {
    const thirtyAgo = new Date(asOf);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const { count } = await supabaseAdmin
      .from("user_overrides")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", thirtyAgo.toISOString());
    overrideCount = count ?? 0;
  }

  const healthScore = computeHealthScore({
    subs: subs.map((s) => ({
      id: s.id,
      amount_cents: s.amount_cents,
      frequency: s.frequency,
      last_charged_at: s.last_charged_at,
      category: s.category,
    })),
    charges: visibleCharges,
    categories: subscriptionCats,
    overrideCount,
    asOf,
  });

  // Same bucket logic, bills tier only.
  const billWatching: ActionItem[] = billActions
    .filter(inWatching)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);
  const billPruned: ActionItem[] = billActions
    .filter(inPruned)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);
  const billHidden: ActionItem[] = billActions
    .filter(inHidden)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);
  const billWorthALook: ActionItem[] = billActions
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
    subscription_categories: subscriptionCats,
    bill_categories: billCats,
    ai_spend: ai,
    top_subscriptions: top,
    top_bills: topBills,
    shock_insights: shock,
    money_leaks: moneyLeaks,
    personality,
    health_score: healthScore,
    concentration,
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
    bill_actions: {
      worth_a_look: billWorthALook,
      watching: billWatching,
      pruned: billPruned,
      hidden: billHidden,
    },
    recurring_commerce: recurringCommerce,
    subscriptions: subs,
    burn_internal: burn,
  };
}
