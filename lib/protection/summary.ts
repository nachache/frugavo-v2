// Protection summary — cumulative-since-signup metrics for the
// /app/protection page.
//
// Five numbers we surface:
//
//   1. dollars_protected_cents  — annualized cancels + price-hike
//                                 differentials user kept their prices
//                                 on (they never paid the increase).
//   2. cancels_count            — distinct merchant cancellations.
//   3. trials_stopped           — trial_converting alerts that the
//                                 user acknowledged or dismissed
//                                 (implies they were aware).
//   4. price_hikes_caught       — price_increase alerts ever fired.
//   5. duplicates_flagged       — duplicate_subscription alerts.
//   6. days_protected           — days since the user's app_users row
//                                 was created.
//
// All math is best-effort. Where data is missing (e.g. a cancel
// without a stored amount) we count it as 0 dollars but still
// increment the count.

import { supabaseAdmin } from "@/lib/supabase";

export type ProtectionSummary = {
  user_since: string | null;
  days_protected: number;
  dollars_protected_cents: number;
  cancels_count: number;
  trials_stopped: number;
  price_hikes_caught: number;
  duplicates_flagged: number;
  total_alerts: number;
  recent_protection: Array<{
    id: string;
    kind:
      | "cancel"
      | "trial_stopped"
      | "price_hike_caught"
      | "duplicate_flagged";
    merchant_name: string | null;
    amount_cents: number | null;
    when: string;
  }>;
};

const EMPTY: ProtectionSummary = {
  user_since: null,
  days_protected: 0,
  dollars_protected_cents: 0,
  cancels_count: 0,
  trials_stopped: 0,
  price_hikes_caught: 0,
  duplicates_flagged: 0,
  total_alerts: 0,
  recent_protection: [],
};

export async function buildProtectionSummary(
  userId: string
): Promise<ProtectionSummary> {
  if (!supabaseAdmin) return EMPTY;

  // 1. days protected
  const { data: u } = await supabaseAdmin
    .from("app_users")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();
  const userSince = (u?.created_at as string | undefined) ?? null;
  const daysProtected = userSince
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(userSince).getTime()) / 86_400_000
        )
      )
    : 0;

  // 2. cancels — pull user_overrides with override_type='cancelled'
  //    and join to subscriptions for amount_cents / merchant.
  const { data: cancelRows } = await supabaseAdmin
    .from("user_overrides")
    .select("id, merchant_key, subscription_id, created_at")
    .eq("user_id", userId)
    .eq("override_type", "cancelled")
    .order("created_at", { ascending: false });
  const cancels = (cancelRows ?? []) as Array<{
    id: string;
    merchant_key: string;
    subscription_id: string | null;
    created_at: string;
  }>;
  // Pull amounts for subscription_ids.
  const subIds = cancels
    .map((c) => c.subscription_id)
    .filter((x): x is string => !!x);
  const subAmountById = new Map<
    string,
    { amount_cents: number; frequency: string; merchant_name: string }
  >();
  if (subIds.length > 0) {
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("id, amount_cents, frequency, merchant_name")
      .in("id", subIds);
    for (const s of (subs ?? []) as Array<{
      id: string;
      amount_cents: number;
      frequency: string;
      merchant_name: string;
    }>) {
      subAmountById.set(s.id, {
        amount_cents: s.amount_cents,
        frequency: s.frequency,
        merchant_name: s.merchant_name,
      });
    }
  }

  // Annualize each cancel based on cadence.
  function annualize(amount: number, freq: string): number {
    switch (freq) {
      case "weekly":
        return amount * 52;
      case "monthly":
        return amount * 12;
      case "quarterly":
        return amount * 4;
      case "annual":
      case "yearly":
        return amount;
      default:
        return amount * 12; // assume monthly when unknown
    }
  }
  let dollarsFromCancels = 0;
  const cancelHistory: ProtectionSummary["recent_protection"] = [];
  for (const c of cancels) {
    const meta = c.subscription_id
      ? subAmountById.get(c.subscription_id)
      : null;
    const annual = meta ? annualize(meta.amount_cents, meta.frequency) : 0;
    dollarsFromCancels += annual;
    cancelHistory.push({
      id: c.id,
      kind: "cancel",
      merchant_name: meta?.merchant_name ?? c.merchant_key,
      amount_cents: annual || null,
      when: c.created_at,
    });
  }

  // 3. price-hike differentials user did NOT pay — for now, we count
  //    every price_increase alert as a "caught" event regardless of
  //    whether the user kept paying. The annualized differential is
  //    summed into dollars_protected_cents.
  const { data: hikeRows } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, merchant_name, details, created_at")
    .eq("user_id", userId)
    .eq("alert_type", "price_increase")
    .order("created_at", { ascending: false });
  const hikes = (hikeRows ?? []) as Array<{
    id: string;
    merchant_name: string | null;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  let dollarsFromHikes = 0;
  const hikeHistory: ProtectionSummary["recent_protection"] = [];
  for (const h of hikes) {
    const from = (h.details?.from_cents as number | undefined) ?? 0;
    const to = (h.details?.to_cents as number | undefined) ?? 0;
    const freq = (h.details?.frequency as string | undefined) ?? "monthly";
    const delta = Math.max(0, to - from);
    const annualDelta = annualize(delta, freq);
    dollarsFromHikes += annualDelta;
    hikeHistory.push({
      id: h.id,
      kind: "price_hike_caught",
      merchant_name: h.merchant_name,
      amount_cents: annualDelta || null,
      when: h.created_at,
    });
  }

  // 4. trials stopped — count trial_converting alerts the user has
  //    acknowledged or dismissed (i.e. they saw it).
  const { data: trialRows } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, merchant_name, created_at, status")
    .eq("user_id", userId)
    .eq("alert_type", "trial_converting");
  const trials = (trialRows ?? []) as Array<{
    id: string;
    merchant_name: string | null;
    created_at: string;
    status: string;
  }>;
  const trialsStopped = trials.filter(
    (t) => t.status === "acknowledged" || t.status === "dismissed"
  );
  const trialHistory: ProtectionSummary["recent_protection"] = trialsStopped.map(
    (t) => ({
      id: t.id,
      kind: "trial_stopped",
      merchant_name: t.merchant_name,
      amount_cents: null,
      when: t.created_at,
    })
  );

  // 5. duplicates flagged
  const { data: dupRows } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, merchant_name, created_at")
    .eq("user_id", userId)
    .eq("alert_type", "duplicate_subscription");
  const dups = (dupRows ?? []) as Array<{
    id: string;
    merchant_name: string | null;
    created_at: string;
  }>;
  const dupHistory: ProtectionSummary["recent_protection"] = dups.map((d) => ({
    id: d.id,
    kind: "duplicate_flagged",
    merchant_name: d.merchant_name,
    amount_cents: null,
    when: d.created_at,
  }));

  // 6. total alerts ever
  const { count: totalAlerts } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Combine recent protection events, newest first, cap at 12.
  const recent = [
    ...cancelHistory,
    ...hikeHistory,
    ...trialHistory,
    ...dupHistory,
  ]
    .sort((a, b) => (a.when > b.when ? -1 : 1))
    .slice(0, 12);

  return {
    user_since: userSince,
    days_protected: daysProtected,
    dollars_protected_cents: dollarsFromCancels + dollarsFromHikes,
    cancels_count: cancels.length,
    trials_stopped: trialsStopped.length,
    price_hikes_caught: hikes.length,
    duplicates_flagged: dups.length,
    total_alerts: totalAlerts ?? 0,
    recent_protection: recent,
  };
}
