// Protection panel data — feeds the redesigned ProtectionPanel
// component on the dashboard.
//
// Designed around the user-facing message: "we did this work for you
// this month." Numbers must be CONSERVATIVE — if any one figure feels
// inflated, the whole panel loses credibility. Specifically:
//
//   - "Caught this month" only counts events where the user took a
//     concrete action (cancelled). A flagged price hike the user
//     ignored is reported separately as "flagged" / "at risk" — never
//     as savings.
//   - "Charges checked since you joined" is a real count from
//     subscription_charges, not a guesstimate.
//   - "Surprises slipped past us" is 0 by design today (we have no
//     signal for "user noticed before we did"). When we add that
//     telemetry, this number starts climbing honestly.
//
// All math is best-effort. Where data is missing we surface 0, never
// fabricate.

import { supabaseAdmin } from "@/lib/supabase";
import { monthlyEqCents } from "@/lib/insights";

export type PanelVerb =
  | "stopped"   // trial / sub stopped before charging
  | "flagged"   // price hike or unusual charge surfaced
  | "caught"    // generic catch (duplicate, new sub)
  | "watching"  // uncertain item being observed
  | "pruned";   // user cancelled

export type RecentAction = {
  id: string;
  verb: PanelVerb;
  title: string;
  detail: string;
  when: string;
};

export type ProtectionPanelData = {
  // Top-line guarding figure. Scoped to the active dashboard tab —
  // caller passes the right `tier_filter` to choose subs vs bills vs
  // both. Avoids the "$1,847 Guarding" vs "$173/mo Subscriptions"
  // cognitive whiplash by ensuring both numbers reconcile.
  guarding: {
    monthly_cents: number;
    charges_count: number;
  };
  // Stats grid (4 boxes).
  stats: {
    // CONSERVATIVE: only money from cancellations the user actually
    // committed to in the last 30 days. Price hikes are NOT counted
    // here — they appear under flagged.
    caught_this_month_cents: number;
    caught_this_month_events: number;
    // Money the engine flagged for the user's review but where the
    // user hasn't taken action yet. Reported separately so the
    // "caught" number stays honest.
    flagged_this_month_cents: number;
    // Total charges the engine has inspected since signup.
    charges_checked_total: number;
    // Items the engine is still confirming (uncertain or needs_review).
    watching_count: number;
    // Unattributed unusual charges that we didn't catch in advance.
    // Placeholder 0 today; instrumentation TBD.
    surprises_count: number;
  };
  // Recent verb-led timeline. Most recent first. Cap at 5 for the
  // panel; the full history lives at /app/alerts.
  recent_actions: RecentAction[];
  // Cumulative since-signup figures for empty / quiet months. Lets
  // the panel never look dead even when nothing happened this month.
  since_signup: {
    user_since_iso: string | null;
    days_protected: number;
    total_caught_cents: number;
    total_events: number;
  };
};

const EMPTY: ProtectionPanelData = {
  guarding: { monthly_cents: 0, charges_count: 0 },
  stats: {
    caught_this_month_cents: 0,
    caught_this_month_events: 0,
    flagged_this_month_cents: 0,
    charges_checked_total: 0,
    watching_count: 0,
    surprises_count: 0,
  },
  recent_actions: [],
  since_signup: {
    user_since_iso: null,
    days_protected: 0,
    total_caught_cents: 0,
    total_events: 0,
  },
};

export async function buildProtectionPanelData(
  userId: string,
  args: {
    // Which tier the dashboard is showing. Drives the "Guarding" total.
    tier: "subscriptions" | "bills" | "combined";
  }
): Promise<ProtectionPanelData> {
  if (!supabaseAdmin) return EMPTY;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // ── since signup ────────────────────────────────────────────────
  const { data: u } = await supabaseAdmin
    .from("app_users")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();
  const userSince = (u?.created_at as string | undefined) ?? null;
  const daysProtected = userSince
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(userSince).getTime()) / 86_400_000)
      )
    : 0;

  // ── guarding total (scoped to tier) ─────────────────────────────
  const tierFilter =
    args.tier === "subscriptions"
      ? "confirmed_subscription"
      : args.tier === "bills"
        ? "recurring_bill"
        : null;
  let guardingQuery = supabaseAdmin
    .from("subscriptions")
    .select("amount_cents, frequency, recurring_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("classification", "confirmed");
  if (tierFilter) guardingQuery = guardingQuery.eq("recurring_type", tierFilter);
  else guardingQuery = guardingQuery.in("recurring_type", [
    "confirmed_subscription",
    "recurring_bill",
  ]);
  const { data: guardingRows } = await guardingQuery;
  const guardingMonthly = (guardingRows ?? []).reduce(
    (sum, r) =>
      sum +
      monthlyEqCents(
        (r.amount_cents as number) ?? 0,
        (r.frequency as string) ?? "monthly"
      ),
    0
  );
  const guardingCount = (guardingRows ?? []).length;

  // ── caught this month — cancels only, honest definition ─────────
  const { data: cancels30d } = await supabaseAdmin
    .from("user_overrides")
    .select("id, subscription_id, created_at")
    .eq("user_id", userId)
    .eq("override_type", "cancelled")
    .gte("created_at", thirtyDaysAgo);
  const subIds = (cancels30d ?? [])
    .map((c) => c.subscription_id as string | null)
    .filter((x): x is string => !!x);
  const subAmtMap = new Map<string, { amount_cents: number; frequency: string }>();
  if (subIds.length > 0) {
    const { data: subAmts } = await supabaseAdmin
      .from("subscriptions")
      .select("id, amount_cents, frequency")
      .in("id", subIds);
    for (const r of (subAmts ?? []) as Array<{
      id: string;
      amount_cents: number;
      frequency: string;
    }>) {
      subAmtMap.set(r.id, { amount_cents: r.amount_cents, frequency: r.frequency });
    }
  }
  let caughtCents = 0;
  for (const c of cancels30d ?? []) {
    const m = subAmtMap.get(c.subscription_id as string);
    if (!m) continue;
    caughtCents += monthlyEqCents(m.amount_cents, m.frequency) * 12; // annualized saving
  }
  const caughtEvents = (cancels30d ?? []).length;

  // ── flagged this month — price hikes + trial alerts ─────────────
  // Sum of estimated price differential annualized. Conservative:
  // when an alert doesn't carry a $ figure, count it for the EVENT
  // tally but not the dollar total.
  const { data: hikeAlerts } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, alert_type, details, created_at")
    .eq("user_id", userId)
    .in("alert_type", ["price_increase", "trial_converting"])
    .gte("created_at", thirtyDaysAgo);
  let flaggedCents = 0;
  for (const a of hikeAlerts ?? []) {
    const d = a.details as { delta_cents?: number; amount_cents?: number };
    if (typeof d?.delta_cents === "number") flaggedCents += d.delta_cents * 12;
    else if (typeof d?.amount_cents === "number")
      flaggedCents += d.amount_cents * 12;
  }

  // ── charges checked total ───────────────────────────────────────
  const { count: chargesChecked } = await supabaseAdmin
    .from("subscription_charges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // ── watching — uncertain items still being confirmed ────────────
  const { count: watchingCount } = await supabaseAdmin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .or("classification.eq.needs_review,recurring_type.eq.uncertain_recurring");

  // ── surprises (placeholder) ─────────────────────────────────────
  // Today: 0. Future: count of alerts where user_first_noticed_at <
  // alert.created_at. We don't track that signal yet.
  const surprisesCount = 0;

  // ── recent actions feed (last 5 across all sources) ─────────────
  const recent: RecentAction[] = [];

  // Add recent cancels as pruned.
  for (const c of cancels30d ?? []) {
    const m = subAmtMap.get(c.subscription_id as string);
    const annual = m ? monthlyEqCents(m.amount_cents, m.frequency) * 12 : 0;
    recent.push({
      id: `cancel_${c.id}`,
      verb: "pruned",
      title: "You cancelled a subscription",
      detail: annual > 0 ? `Saved $${Math.round(annual / 100)}/yr.` : "Pruned from your watch list.",
      when: c.created_at as string,
    });
  }
  // Add recent alerts.
  const { data: recentAlerts } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, alert_type, merchant_name, details, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  for (const a of recentAlerts ?? []) {
    const merchant =
      (a.merchant_name as string | null) ?? "a subscription";
    const d = (a.details as Record<string, unknown>) ?? {};
    let verb: PanelVerb = "caught";
    let title = "Caught something";
    let detail = merchant;
    switch (a.alert_type as string) {
      case "trial_converting":
        verb = "stopped";
        title = "Flagged a trial about to convert";
        detail = `${merchant} — reminded you in advance`;
        break;
      case "price_increase":
        verb = "flagged";
        title = "Flagged a price increase";
        if (
          typeof d.from_cents === "number" &&
          typeof d.to_cents === "number"
        ) {
          detail = `${merchant} went $${((d.from_cents as number) / 100).toFixed(2)} → $${((d.to_cents as number) / 100).toFixed(2)}`;
        } else {
          detail = `${merchant} — price changed`;
        }
        break;
      case "new_subscription":
        verb = "caught";
        title = "New subscription detected";
        detail = merchant;
        break;
      case "duplicate_subscription":
        verb = "caught";
        title = "Caught a duplicate";
        detail = `Two active ${merchant} plans — one may be unused`;
        break;
      case "renewal_upcoming":
        verb = "watching";
        title = "Renewal coming up";
        detail = `${merchant} renews soon`;
        break;
      case "missing_renewal":
        verb = "watching";
        title = "Skipped its usual charge";
        detail = `${merchant} hasn't billed this cycle`;
        break;
      case "dormant_resumed":
        verb = "caught";
        title = "Dormant sub resumed";
        detail = `${merchant} billed again after a pause`;
        break;
      case "high_charge_amount":
        verb = "flagged";
        title = "Unusual charge amount";
        detail = `${merchant} — bigger than the usual cycle`;
        break;
    }
    recent.push({
      id: `alert_${a.id}`,
      verb,
      title,
      detail,
      when: a.created_at as string,
    });
  }

  // Sort by recency, cap at 5.
  recent.sort((a, b) => (a.when < b.when ? 1 : -1));
  const recentTrimmed = recent.slice(0, 5);

  // ── cumulative totals ───────────────────────────────────────────
  // Sum of all cancels ever, annualized.
  const { data: allCancels } = await supabaseAdmin
    .from("user_overrides")
    .select("id, subscription_id")
    .eq("user_id", userId)
    .eq("override_type", "cancelled");
  const allSubIds = (allCancels ?? [])
    .map((c) => c.subscription_id as string | null)
    .filter((x): x is string => !!x);
  const allSubAmtMap = new Map<
    string,
    { amount_cents: number; frequency: string }
  >();
  if (allSubIds.length > 0) {
    const { data: allSubAmts } = await supabaseAdmin
      .from("subscriptions")
      .select("id, amount_cents, frequency")
      .in("id", allSubIds);
    for (const r of (allSubAmts ?? []) as Array<{
      id: string;
      amount_cents: number;
      frequency: string;
    }>) {
      allSubAmtMap.set(r.id, {
        amount_cents: r.amount_cents,
        frequency: r.frequency,
      });
    }
  }
  let totalCaughtCents = 0;
  for (const c of allCancels ?? []) {
    const m = allSubAmtMap.get(c.subscription_id as string);
    if (!m) continue;
    totalCaughtCents += monthlyEqCents(m.amount_cents, m.frequency) * 12;
  }

  return {
    guarding: {
      monthly_cents: guardingMonthly,
      charges_count: guardingCount,
    },
    stats: {
      caught_this_month_cents: caughtCents,
      caught_this_month_events: caughtEvents,
      flagged_this_month_cents: flaggedCents,
      charges_checked_total: chargesChecked ?? 0,
      watching_count: watchingCount ?? 0,
      surprises_count: surprisesCount,
    },
    recent_actions: recentTrimmed,
    since_signup: {
      user_since_iso: userSince,
      days_protected: daysProtected,
      total_caught_cents: totalCaughtCents,
      total_events: (allCancels ?? []).length,
    },
  };
}
