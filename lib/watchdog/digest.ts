// Daily watchdog digest selector.
//
// Builds the "while you were away" summary surfaced as an overlay on
// dashboard return visits. Reads the user's last-seen timestamp from
// app_users.watchdog_seen_at and reports any notable events created
// since then (capped at 7 days back so the very first overlay isn't
// dominated by months of backfilled activity).
//
// Returns NULL when nothing notable happened since the cutoff — that
// signals the dashboard NOT to show the overlay at all. This is the
// "every return visit, only if something happened" rule from the UX
// brief: we never want to nag with an empty digest.

import { supabaseAdmin } from "@/lib/supabase";
import { monthlyEqCents } from "@/lib/insights";

// Maximum lookback for the first-ever watchdog render. A new user
// shouldn't see a giant backfilled "we caught 47 things" splash on
// their first visit after signup; 7 days keeps the surface anchored
// to the recent past.
const MAX_LOOKBACK_DAYS = 7;

// Cooldown after dismissal. The monitoring cron generates new
// alerts every hour, so without this gate the overlay would reappear
// on every login (which would feel like a popup nag). 24h cap is
// the UX rule: "at most once a day, only when something new
// happened in the last 24h".
const SHOW_COOLDOWN_HOURS = 24;

export type WatchdogVerb =
  | "flagged"   // price hike, unusual charge, missing renewal
  | "stopped"   // trial converting, dunning
  | "caught"   // new subscription detected, duplicate detected
  | "pruned";   // user cancelled (we did the work)

export type WatchdogEvent = {
  id: string;
  verb: WatchdogVerb;
  // Pre-rendered display copy.
  title: string;   // "Netflix price increase"
  detail: string;  // "+$3 a month starting next cycle"
  when_iso: string;
  // When set, the row links to the detail page so the user can act.
  subscription_id: string | null;
};

export type WatchdogDigest = {
  // ISO timestamp the user last saw the watchdog overlay (or null if
  // never). The dismiss handler bumps this to now().
  since_iso: string;
  // Human-friendly description of the gap ("since this morning",
  // "since yesterday", "since Tuesday", "in the last 4 days"). Built
  // server-side so we don't need a clock-aware client.
  since_label: string;
  // Total notable events in the window. >= 1 by definition — when
  // there are zero, the digest itself is null (no overlay).
  total_events: number;
  // Top 4 events the overlay renders. The full feed lives at
  // /app/alerts; the overlay is the cinematic preview.
  top_events: WatchdogEvent[];
  // Dollar context for the headline line.
  caught_cents: number;   // sum of cancellations annualized
  flagged_cents: number;  // sum of price-hike deltas annualized
};

function fmtSinceLabel(sinceIso: string, now: Date): string {
  const since = new Date(sinceIso);
  const ms = now.getTime() - since.getTime();
  const hours = ms / 3_600_000;
  if (hours < 6) return "since earlier today";
  if (hours < 24) return "since this morning";
  const days = Math.round(hours / 24);
  if (days <= 1) return "since yesterday";
  if (days <= 6) {
    const dayName = since.toLocaleDateString("en-US", { weekday: "long" });
    return `since ${dayName}`;
  }
  return `in the last ${days} days`;
}

export async function buildWatchdogDigest(
  userId: string,
  now: Date = new Date()
): Promise<WatchdogDigest | null> {
  if (!supabaseAdmin) return null;

  // ── 1. Find the cutoff ─────────────────────────────────────────
  const { data: u } = await supabaseAdmin
    .from("app_users")
    .select("watchdog_seen_at, created_at")
    .eq("id", userId)
    .maybeSingle();
  const seenAt = (u?.watchdog_seen_at as string | null) ?? null;
  const userCreatedAt = (u?.created_at as string | null) ?? null;

  // ── 1a. Cooldown gate ──────────────────────────────────────────
  // If the user dismissed the overlay less than SHOW_COOLDOWN_HOURS
  // ago, suppress it entirely. The next 24h of cron-generated alerts
  // will surface in the dashboard's normal feed; the overlay reappears
  // tomorrow when there's an accumulated set of events worth a reveal.
  if (seenAt) {
    const hoursSinceSeen = (now.getTime() - new Date(seenAt).getTime()) / 3_600_000;
    if (hoursSinceSeen < SHOW_COOLDOWN_HOURS) {
      return null;
    }
  }

  const lookbackFloor = new Date(
    now.getTime() - MAX_LOOKBACK_DAYS * 86_400_000
  );
  // Use the more recent of: seen_at, lookback floor, user_created_at.
  // user_created_at protects brand-new accounts from a watchdog that
  // would otherwise span the demo data backfill.
  let cutoff = lookbackFloor;
  if (seenAt && new Date(seenAt) > cutoff) cutoff = new Date(seenAt);
  if (userCreatedAt && new Date(userCreatedAt) > cutoff) {
    cutoff = new Date(userCreatedAt);
  }
  const cutoffIso = cutoff.toISOString();

  // ── 2. Pull monitoring_alerts since cutoff ─────────────────────
  // Subs-only — bills don't generate the watchdog "trial converting"
  // / "missing renewal" energy, and including them would re-introduce
  // the noisy bill alerts we just filtered out at the protection
  // panel level.
  const { data: subRows } = await supabaseAdmin
    .from("subscriptions")
    .select("id, merchant_name, amount_cents, frequency, recurring_type")
    .eq("user_id", userId)
    .eq("recurring_type", "confirmed_subscription");
  const subIds = new Set((subRows ?? []).map((r) => r.id as string));
  const subByMerchant = new Map<
    string,
    { id: string; merchant_name: string; amount_cents: number; frequency: string }
  >();
  for (const r of subRows ?? []) {
    subByMerchant.set(r.id as string, {
      id: r.id as string,
      merchant_name: (r.merchant_name as string) ?? "a subscription",
      amount_cents: (r.amount_cents as number) ?? 0,
      frequency: (r.frequency as string) ?? "monthly",
    });
  }

  const { data: alertsRaw } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("id, alert_type, subscription_id, merchant_name, details, created_at, status")
    .eq("user_id", userId)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false });
  const alerts = (alertsRaw ?? []).filter((a) => {
    const sid = a.subscription_id as string | null;
    // Keep alerts that either belong to a confirmed-subscription row
    // we know about, OR carry no subscription_id (new_subscription
    // for a not-yet-confirmed pattern). Either way, skip alerts tied
    // to subscriptions we couldn't load — those are bills or
    // already-deleted rows.
    if (!sid) return true;
    return subIds.has(sid);
  });

  // ── 3. Pull cancellations the user made since cutoff ───────────
  const { data: cancelsRaw } = await supabaseAdmin
    .from("user_overrides")
    .select("id, subscription_id, created_at")
    .eq("user_id", userId)
    .eq("override_type", "cancelled")
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false });
  const cancels = (cancelsRaw ?? []).filter((c) =>
    subByMerchant.has(c.subscription_id as string)
  );

  if (alerts.length === 0 && cancels.length === 0) {
    return null;
  }

  // ── 4. Build the event list ────────────────────────────────────
  const events: WatchdogEvent[] = [];
  for (const a of alerts) {
    const d = (a.details as Record<string, unknown>) ?? {};
    const merchant = (a.merchant_name as string | null) ?? "a charge";
    const sid = a.subscription_id as string | null;
    const at = a.alert_type as string;

    let verb: WatchdogVerb = "caught";
    let title = merchant;
    let detail = "";
    if (at === "price_increase") {
      verb = "flagged";
      title = `${merchant} price increase`;
      const delta = typeof d.delta_cents === "number" ? (d.delta_cents as number) : 0;
      detail = delta > 0
        ? `About $${Math.round(delta / 100)} more a month.`
        : "We spotted a price change.";
    } else if (at === "trial_converting") {
      verb = "stopped";
      title = `${merchant} trial converting soon`;
      detail = "Cancel before the first charge if you don't want it.";
    } else if (at === "missing_renewal") {
      verb = "flagged";
      title = `${merchant} skipped its usual charge`;
      detail = "We're confirming whether the subscription stopped.";
    } else if (at === "new_subscription") {
      verb = "caught";
      title = `New subscription: ${merchant}`;
      detail = "Added to your watch list.";
    } else if (at === "duplicate_subscription") {
      verb = "caught";
      title = `Possible duplicate: ${merchant}`;
      detail = "Looks like you're paying for the same thing twice.";
    } else if (at === "high_charge_amount") {
      verb = "flagged";
      title = `Unusual charge from ${merchant}`;
      detail = "Bigger than your normal cycle.";
    } else if (at === "dormant_resumed") {
      verb = "caught";
      title = `${merchant} resumed charging`;
      detail = "Dormant subscription started billing again.";
    } else {
      title = merchant;
      detail = "We flagged this for review.";
    }

    events.push({
      id: `alert_${a.id}`,
      verb,
      title,
      detail,
      when_iso: a.created_at as string,
      subscription_id: sid,
    });
  }

  // Sum cancels (caught_cents) annualized and add a single row for
  // the count rather than one per cancel (which would crowd the top4).
  let caughtCents = 0;
  for (const c of cancels) {
    const meta = subByMerchant.get(c.subscription_id as string);
    if (!meta) continue;
    caughtCents += monthlyEqCents(meta.amount_cents, meta.frequency) * 12;
  }
  if (cancels.length > 0) {
    const first = subByMerchant.get(cancels[0].subscription_id as string);
    const merchantSample = first?.merchant_name ?? "a subscription";
    events.push({
      id: `cancels_${cancels[0].id}`,
      verb: "pruned",
      title:
        cancels.length === 1
          ? `You cancelled ${merchantSample}`
          : `You cancelled ${cancels.length} subscriptions`,
      detail:
        caughtCents > 0
          ? `Saving $${Math.round(caughtCents / 100).toLocaleString("en-US")} a year.`
          : "Removed from your watch list.",
      when_iso: cancels[0].created_at as string,
      subscription_id:
        cancels.length === 1 ? (cancels[0].subscription_id as string) : null,
    });
  }

  // Sort events newest first (alerts already are), then take top 4.
  events.sort((a, b) => b.when_iso.localeCompare(a.when_iso));
  const topEvents = events.slice(0, 4);

  // Sum flagged dollars across price_increase alerts.
  let flaggedCents = 0;
  for (const a of alerts) {
    if (a.alert_type !== "price_increase") continue;
    const d = (a.details as Record<string, unknown>) ?? {};
    const delta = typeof d.delta_cents === "number" ? (d.delta_cents as number) : 0;
    if (delta > 0) flaggedCents += delta * 12; // annualize
  }

  return {
    since_iso: cutoffIso,
    since_label: fmtSinceLabel(cutoffIso, now),
    total_events: alerts.length + cancels.length,
    top_events: topEvents,
    caught_cents: caughtCents,
    flagged_cents: flaggedCents,
  };
}
