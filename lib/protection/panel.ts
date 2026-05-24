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

// Upcoming charge the watchdog is monitoring. Used by the "what
// we're watching" subsection on the protection panel.
export type WatchingItem = {
  id: string;
  alert_id: string;             // monitoring_alerts.id for ack/dismiss
  merchant_name: string;
  subscription_id: string | null;
  // Human-readable timing: 'renews tomorrow', 'renews in 4 days',
  // '9 days late', 'starting next week'.
  when_label: string;
  // Why we're watching: 'renewal_upcoming', 'trial_converting',
  // 'missing_renewal', 'new_subscription'.
  reason: string;
  // Amount we expect on this cycle, if known.
  amount_cents: number | null;
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
  // panel; the full history lives at /app/alerts. Subs only — bills
  // get filtered out at the DB query level.
  recent_actions: RecentAction[];
  // "What we're watching for you" — upcoming renewals + trial
  // conversions + missing renewals the watchdog is monitoring right
  // now. Lets the user act ("Cancel before tomorrow") instead of
  // discovering the charge after it hits.
  watching: WatchingItem[];
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
  watching: [],
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
  // Add recent alerts — SUBS ONLY. Bill / commerce alerts should
  // never appear in the protection feed; protection is about
  // catching subscription surprises. We pull the user's sub-tier
  // subscription IDs once and exclude alerts pointing at any other
  // tier.
  const { data: nonSubIdRows } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .neq("recurring_type", "confirmed_subscription");
  const nonSubIds = new Set(
    (nonSubIdRows ?? []).map((r) => r.id as string)
  );
  const { data: recentAlertsRaw } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, subscription_id, alert_type, merchant_name, details, created_at, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40); // pull more, filter, then trim
  const recentAlerts = (recentAlertsRaw ?? []).filter(
    (a) =>
      !a.subscription_id || !nonSubIds.has(a.subscription_id as string)
  );
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

  // Sort by recency.
  recent.sort((a, b) => (a.when < b.when ? 1 : -1));

  // GROUP DUPLICATES — when 3+ alerts of the same verb landed within
  // a 24h window, collapse them into a single summary row to avoid
  // the "5 New subscription detected" spam pattern the dashboard
  // critic flagged. Keeps the most recent timestamp + an aggregated
  // detail line: "5 new charges detected today — review".
  const collapsed: RecentAction[] = [];
  const DAY_MS = 86_400_000;
  let i = 0;
  while (i < recent.length) {
    const head = recent[i];
    // Look ahead for same-verb items within 24h of the head.
    let j = i + 1;
    while (
      j < recent.length &&
      recent[j].verb === head.verb &&
      new Date(head.when).getTime() - new Date(recent[j].when).getTime() <
        DAY_MS
    ) {
      j++;
    }
    const groupSize = j - i;
    if (groupSize >= 3) {
      const verbLabel: Record<string, string> = {
        stopped: "trials caught",
        flagged: "things flagged",
        caught: "new charges detected",
        watching: "things being watched",
        pruned: "subscriptions cancelled",
      };
      collapsed.push({
        id: `group_${head.verb}_${head.when}`,
        verb: head.verb,
        title: `${groupSize} ${verbLabel[head.verb] ?? "items"} today`,
        detail: `Tap "See everything caught" to review individually.`,
        when: head.when,
      });
    } else {
      // Group too small to collapse — emit each individually.
      for (let k = i; k < j; k++) collapsed.push(recent[k]);
    }
    i = j;
  }
  const recentTrimmed = collapsed.slice(0, 5);

  // ── Watching list: actionable alerts only ──────────────────────
  // Critic round 2: the watching list was duplicating the subscription
  // grid (Amazon Prime, AMC, Disney+ etc. appearing twice on the same
  // page). The fix: scope this section to items where the user can
  // meaningfully ACT before the next charge:
  //
  //   - trial_converting   → cancel before the trial bills
  //   - missing_renewal    → confirm whether the sub stopped
  //
  // Dropped from this section (they live in the main subs list now):
  //   - renewal_upcoming   → normal renewal, no action needed
  //   - new_subscription   → informational, already detected
  //
  // When nothing actionable is in flight, the entire panel section
  // hides (length === 0) so we don't show a "we're watching" header
  // over an empty list.
  const WATCHING_TYPES = new Set([
    "trial_converting",
    "missing_renewal",
  ]);
  const watchingList: WatchingItem[] = [];
  for (const a of recentAlerts) {
    if (a.status !== "active") continue;
    if (!WATCHING_TYPES.has(a.alert_type as string)) continue;
    const d = (a.details as Record<string, unknown>) ?? {};
    let whenLabel = "soon";
    if (a.alert_type === "renewal_upcoming") {
      const date = (d.next_charge_date as string) ?? (d.expected_date as string);
      whenLabel = date ? humanWhen(date) : "soon";
    } else if (a.alert_type === "trial_converting") {
      const date = (d.converts_at as string) ?? (d.expected_date as string);
      whenLabel = date ? humanWhen(date) : "converting soon";
    } else if (a.alert_type === "missing_renewal") {
      const date = (d.expected_date as string) ?? null;
      whenLabel = date ? `${daysSince(date)} days late` : "missing this cycle";
    } else if (a.alert_type === "new_subscription") {
      whenLabel = "new — confirming pattern";
    }
    const amount =
      (typeof d.amount_cents === "number" ? d.amount_cents : null) ??
      (typeof d.expected_amount_cents === "number"
        ? (d.expected_amount_cents as number)
        : null);
    watchingList.push({
      id: `watch_${a.id}`,
      alert_id: a.id as string,
      merchant_name: (a.merchant_name as string | null) ?? "a charge",
      subscription_id: (a.subscription_id as string | null) ?? null,
      when_label: whenLabel,
      reason: a.alert_type as string,
      amount_cents: amount,
    });
  }
  // Most urgent first (missing_renewal > trial_converting).
  const urgency: Record<string, number> = {
    missing_renewal: 0,
    trial_converting: 1,
  };
  watchingList.sort(
    (a, b) => (urgency[a.reason] ?? 9) - (urgency[b.reason] ?? 9)
  );

  // Collapse 3+ missing_renewal entries into one row. Critic round 2:
  // four near-identical "hasn't billed this cycle" entries read like
  // a log file. One synthetic row points the user at the alerts page
  // where they can review them individually.
  const missing = watchingList.filter((w) => w.reason === "missing_renewal");
  const others = watchingList.filter((w) => w.reason !== "missing_renewal");
  const collapsedWatching: WatchingItem[] = [];
  if (missing.length >= 3) {
    collapsedWatching.push({
      id: `watch_group_missing_${missing[0].alert_id}`,
      alert_id: missing[0].alert_id,
      merchant_name: `${missing.length} subscriptions skipped this cycle`,
      // No specific subscription_id — clicking "Review" should take
      // the user to the filtered alerts inbox, not a single sub.
      subscription_id: null,
      when_label: "Review individually on the alerts page",
      reason: "missing_renewal",
      amount_cents: null,
    });
  } else {
    collapsedWatching.push(...missing);
  }
  collapsedWatching.push(...others);
  const watchingTrimmed = collapsedWatching.slice(0, 4);

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
    watching: watchingTrimmed,
    since_signup: {
      user_since_iso: userSince,
      days_protected: daysProtected,
      total_caught_cents: totalCaughtCents,
      total_events: (allCancels ?? []).length,
    },
  };
}

// ── Date helpers for watching labels ───────────────────────────────
function humanWhen(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const ms = target - now;
  const day = 86_400_000;
  const days = Math.round(ms / day);
  if (days <= 0) return "today";
  if (days === 1) return "renews tomorrow";
  if (days <= 14) return `renews in ${days} days`;
  if (days <= 60) return `renews in ${Math.round(days / 7)} weeks`;
  return `renews ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function daysSince(iso: string): number {
  return Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  );
}
