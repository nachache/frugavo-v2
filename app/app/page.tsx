import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";
import { nextRecommendation } from "@/lib/recommendations";
import {
  SubscriptionList,
  type Subscription,
} from "@/components/app/subscription-list";
import { RecommendationBanner } from "@/components/app/recommendation-banner";
import { InsightsHero } from "@/components/app/insights-hero";
import type { SnapshotRow } from "@/lib/types/snapshot";
import {
  computeBurnRate,
  computeAiSpend,
  computeCategoryTotals,
  computeTopSubscriptions,
  computeShockInsights,
  computeMonthlySpendSeries,
  type LedgerCharge,
  type LedgerSubscription,
} from "@/lib/insights";
import { computePersonality } from "@/lib/personality";
import { computeMoneyLeaks } from "@/lib/money-leaks";

// /app — the authenticated dashboard root.
//
// Routing logic:
//   1. No bank connected → /app/connect.
//   2. Bank connected, no scan yet → run scan inline, then render list.
//   3. Bank connected, scan complete → render list with cached data and
//      let the user trigger a re-scan from the list UI.

export default async function AppHome() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  if (!supabaseAdmin) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <p className="text-[15px] text-danger">
          Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
          SUPABASE_SERVICE_ROLE_KEY in your Netlify environment variables.
        </p>
      </section>
    );
  }

  // Ensure the app_users mirror row exists.
  await supabaseAdmin.from("app_users").upsert(
    {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? "",
    },
    { onConflict: "id" }
  );

  // Step 1 — does the user have any connected bank?
  const { data: items } = await supabaseAdmin
    .from("plaid_items")
    .select("id, status, last_synced_at")
    .eq("user_id", user.id);

  if (!items || items.length === 0) {
    return (
      <section className="container-page py-16 md:py-24 max-w-[720px]">
        <span className="text-[13px] font-medium text-brand">
          Welcome to Frugavo
        </span>
        <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          Let&apos;s connect your bank.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-body">
          Frugavo connects to your bank through Plaid — the same infrastructure
          your bank app uses. We use a read-only scope: we can see your
          recurring charges, we cannot move money or send email on your behalf.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
          Bank-grade encryption. Your credentials never touch our servers. You
          can disconnect any time and your data is deleted within 30 days.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/connect"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-white hover:bg-accent-hover transition"
          >
            Connect my bank
          </Link>
          <Link
            href="/learn"
            className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            Read about how it works
          </Link>
        </div>
      </section>
    );
  }

  // Step 2 — render from the latest immutable snapshot. The snapshot
  // is the integrity source: count, list, and monthly upkeep all
  // derive from the SAME persisted row, so they cannot disagree.
  //
  // The mutable `subscriptions` table is still queried, but only to
  // resolve the DB row id + user_decision for each plaid_stream_id —
  // those carry user state forward across scans.

  let snapshotRows = await fetchLatestSnapshotRows(user.id);
  const decisions = await fetchDecisionMap(user.id);

  // First-scan path: no snapshot yet AND no prior scan has run. Kick
  // the synchronous scan now so the user sees data on first visit.
  const noScanYet = items.every((i) => !i.last_synced_at);
  if (snapshotRows.length === 0 && noScanYet) {
    await runScanForUser(user.id);
    snapshotRows = await fetchLatestSnapshotRows(user.id);
  }

  // Legacy fallback: a user whose last scan ran before migration 009
  // has no snapshot yet. Read from `subscriptions` once more so they
  // still see data; the next scan will write a snapshot and this branch
  // stops being hit.
  let subs = snapshotRows.length > 0
    ? mergeSnapshotWithDecisions(snapshotRows, decisions)
    : await fetchSubscriptions(user.id);

  const charges = await fetchCharges(user.id);
  const recommendation = await nextRecommendation(user.id);
  const latestScan = await fetchLatestScan(user.id);

  // ---- Insights layer (deterministic, ledger-derived) ----
  // Computed server-side from the same lib functions the /api/dashboard
  // /insights endpoint uses, so the hero numbers match the API exactly.
  const insights = await buildInsights(user.id);

  return (
    <section className="container-page py-12 md:py-16 max-w-[1200px]">
      <span className="text-[13px] font-medium text-brand">Dashboard</span>
      <h1 className="mt-2 font-display text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your subscriptions
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        Every recurring charge Plaid detected on your connected accounts.
        Re-scan to pull the latest.
      </p>

      {insights && (
        <div className="mt-10">
          <InsightsHero
            burn={insights.burn}
            aiSpend={insights.aiSpend}
            categories={insights.categories}
            topSubscriptions={insights.topSubscriptions}
            shockInsights={insights.shockInsights}
            personality={insights.personality}
            moneyLeaks={insights.moneyLeaks}
            chart12mo={insights.chart12mo}
          />
        </div>
      )}

      <div className="mt-10">
        <RecommendationBanner rec={recommendation} />
        <SubscriptionList
          initial={subs}
          charges={charges}
          lastScannedAt={latestScan?.finished_at ?? null}
          latestScanId={latestScan?.id ?? null}
        />
      </div>
    </section>
  );
}

// Server-side insights builder. Computes the full insights payload
// using the pure functions from lib/insights, lib/personality,
// lib/money-leaks. Returns null on read errors so the page still
// renders the subscription list even if insights are unavailable.
async function buildInsights(userId: string) {
  if (!supabaseAdmin) return null;
  const asOf = new Date();

  const { data: subsData } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, merchant_key, category, amount_cents, currency, frequency, status, classification, last_charged_at"
    )
    .eq("user_id", userId);
  const ledgerSubs: LedgerSubscription[] =
    (subsData ?? []) as LedgerSubscription[];

  const ledgerCharges: LedgerCharge[] = [];
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
    ledgerCharges.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  const burn = computeBurnRate(ledgerSubs, ledgerCharges, asOf);
  const aiSpend = computeAiSpend(ledgerSubs, ledgerCharges, asOf);
  const categories = computeCategoryTotals(ledgerSubs);
  const topSubscriptions = computeTopSubscriptions(ledgerSubs, 5);
  const chart12mo = computeMonthlySpendSeries(ledgerCharges, asOf);
  const shockInsights = computeShockInsights({
    subs: ledgerSubs,
    charges: ledgerCharges,
    asOf,
    burn,
    aiSpend,
    categories,
    top: topSubscriptions,
  });
  const personality = computePersonality({
    categories,
    aiMonthlyCents: aiSpend.monthly_cents,
    totalMonthlyCents: burn.monthly_cents,
    totalSubCount: burn.active_subscription_count,
  });
  const moneyLeaks = computeMoneyLeaks({
    subs: ledgerSubs,
    charges: ledgerCharges,
    asOf,
  });

  return {
    burn,
    aiSpend,
    categories,
    topSubscriptions,
    shockInsights,
    personality,
    moneyLeaks,
    chart12mo,
  };
}

// Most recent successful (terminal `done`) scan for this user. Returns
// both id and finished_at so the dashboard can:
//   - render "Last scanned X ago" against finished_at
//   - hand the id to SubscriptionList as the "baseline" the tab-focus
//     check compares against /api/scan/latest. If a newer scan_id is
//     ever observed, the dashboard refreshes itself.
// Hits the partial index from migration 008, so this is a single-row
// lookup even at scale.
async function fetchLatestScan(
  userId: string
): Promise<{ id: string; finished_at: string | null } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("scan_runs")
    .select("id, finished_at")
    .eq("user_id", userId)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    finished_at: (data.finished_at as string | null) ?? null,
  };
}

// Reads the most recent scan snapshot's row array. This is the
// integrity source — count, list, and totals all come from here. If
// no snapshot exists yet (very first scan after migration 009, or a
// fresh user) returns an empty array.
async function fetchLatestSnapshotRows(userId: string): Promise<SnapshotRow[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("scan_snapshots")
    .select("payload")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return [];
  const payload = (data.payload ?? {}) as { rows?: SnapshotRow[] };
  return payload.rows ?? [];
}

// Per-stream user decisions (keep / cancel) + DB row id, keyed by
// subscription_key. subscription_key is the stable identity introduced
// by migration 010 — it survives Plaid stream_id drift, so a "Kept"
// decision from one scan carries forward to the next.
//
// Backward compat: rows that pre-date migration 010 have their
// subscription_key backfilled by the migration itself. Anything with a
// null subscription_key is silently skipped (would not match a snapshot
// row anyway).
async function fetchDecisionMap(
  userId: string
): Promise<
  Map<string, { id: string; user_decision: Subscription["user_decision"] }>
> {
  const m = new Map<
    string,
    { id: string; user_decision: Subscription["user_decision"] }
  >();
  if (!supabaseAdmin) return m;
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("id, subscription_key, user_decision")
    .eq("user_id", userId)
    .not("subscription_key", "is", null);
  for (const row of data ?? []) {
    m.set(row.subscription_key as string, {
      id: row.id as string,
      user_decision: (row.user_decision ?? null) as Subscription["user_decision"],
    });
  }
  return m;
}

// Merge snapshot rows with the decision map.
//
// Snapshot wins on every display field. We use the snapshot's
// `plaid_stream_id` field — which the new engine stores AS the
// subscription_key — to look up the matching subscriptions row for
// `id` + `user_decision`. Legacy snapshots stored a real plaid_stream_id
// here; in those cases the lookup misses and we fall back to the
// snapshot's own key as the React key. No data is lost either way.
function mergeSnapshotWithDecisions(
  rows: SnapshotRow[],
  decisions: Map<string, { id: string; user_decision: Subscription["user_decision"] }>
): Subscription[] {
  return rows.map((r) => {
    const d = decisions.get(r.plaid_stream_id);
    return {
      id: d?.id ?? r.plaid_stream_id,
      merchant_name: r.merchant_name,
      normalized_name: r.merchant_name,
      category: r.category,
      amount_cents: r.amount_cents,
      currency: r.currency,
      frequency: r.frequency,
      last_charged_at: r.last_charged_at,
      next_expected_charge_at: r.next_expected_charge_at,
      regret_score: r.regret_score,
      status: r.status,
      user_decision: d?.user_decision ?? null,
      classification: r.classification,
    } as Subscription;
  });
}

// Legacy fallback when no scan_snapshot exists yet. Reads subscriptions
// directly. The active scan path writes snapshots so this only triggers
// for users whose last scan ran before migration 009.
async function fetchSubscriptions(userId: string): Promise<Subscription[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, merchant_name, normalized_name, category, amount_cents, currency, frequency, last_charged_at, next_expected_charge_at, regret_score, status, user_decision, classification, subscription_key"
    )
    .eq("user_id", userId)
    .order("status", { ascending: true })
    .order("amount_cents", { ascending: false });

  return (data ?? []) as Subscription[];
}

// Trailing-13-month window of charges. Drives the hero area chart. We
// bound by date to keep the payload small even for users with years of
// history in production.
//
// Phase 4 renamed the ledger date column from charged_at to posted_date
// (and added detector_status). We select against the new schema here
// and map to the legacy ChargeRow shape the existing chart component
// expects, so the column rename is invisible to the UI.
async function fetchCharges(
  userId: string
): Promise<{ amount_cents: number; charged_at: string }[]> {
  if (!supabaseAdmin) return [];
  const since = new Date();
  since.setMonth(since.getMonth() - 13);
  const { data } = await supabaseAdmin
    .from("subscription_charges")
    .select("amount_cents, posted_date, detector_status")
    .eq("user_id", userId)
    .eq("detector_status", "accepted")
    .gte("posted_date", since.toISOString().slice(0, 10))
    .order("posted_date", { ascending: true });
  return ((data ?? []) as Array<{
    amount_cents: number;
    posted_date: string;
  }>).map((r) => ({
    amount_cents: r.amount_cents,
    charged_at: r.posted_date,
  }));
}
