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
import { DashboardHeader } from "@/components/app/dashboard-header";
import { OverviewCard } from "@/components/app/overview-card";
import { InsightsCard } from "@/components/app/insights-card";
import { ActionCenter } from "@/components/app/action-center";
import { WhatChangedCard } from "@/components/app/what-changed-card";
import { UncertainPromptCards } from "@/components/app/uncertain-prompt-cards";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import type { SnapshotRow } from "@/lib/types/snapshot";

// /app — the authenticated dashboard root.
//
// IA per the dashboard refactor ticket:
//   1. DashboardHeader
//   2. OverviewCard       (canonical monthly upkeep, sparkline, donut)
//   3. InsightsCard       (alerts + patterns + pinned stat rows)
//   4. WhatChangedCard    (auto-hides when nothing to show)
//   5. UncertainPromptCards (auto-hides when no candidates)
//   6. ActionCenter       (worth a look / watching / pruned)
//   7. SubscriptionsList  (default sort = most expensive)
//
// All numerical surfaces read from buildDashboardData(). The selector
// owns the canonical Monthly Upkeep value — there is exactly one.

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

  // First-scan path — kick scan and bounce to /app/welcome for the
  // emotional reveal.
  let snapshotRows = await fetchLatestSnapshotRows(user.id);
  const noScanYet = items.every((i) => !i.last_synced_at);
  if (snapshotRows.length === 0 && noScanYet) {
    await runScanForUser(user.id);
    redirect("/app/welcome");
  }

  // Pull the canonical dashboard payload.
  const data = await buildDashboardData(user.id);
  const decisions = await fetchDecisionMap(user.id);

  const subsForList: Subscription[] =
    snapshotRows.length > 0
      ? mergeSnapshotWithDecisions(snapshotRows, decisions)
      : await fetchSubscriptionsFallback(user.id);

  const charges = await fetchCharges(user.id);
  const recommendation = await nextRecommendation(user.id);
  const latestScanFinishedAt = data?.meta.last_scanned_at ?? null;
  const latestScan = await fetchLatestScan(user.id);

  return (
    <section className="container-page py-8 md:py-12 max-w-[1200px] space-y-8 md:space-y-10">
      <DashboardHeader lastScannedAt={latestScanFinishedAt} />

      {data && (
        <>
          <OverviewCard
            monthly={data.monthly}
            yearly={data.yearly}
            chart12mo={data.chart_12mo}
            categories={data.categories}
          />

          <InsightsCard
            aiSpend={data.ai_spend}
            topSubscription={data.top_subscriptions[0] ?? null}
            moneyLeakCount={data.money_leaks.length}
            alerts={data.money_leaks}
            patterns={data.shock_insights}
          />

          <WhatChangedCard />
          <UncertainPromptCards />

          <ActionCenter
            worth_a_look={data.actions.worth_a_look}
            watching={data.actions.watching}
            pruned={data.actions.pruned}
            potential_yearly_savings_cents={
              data.actions.potential_yearly_savings_cents
            }
          />
        </>
      )}

      <div>
        <h2 className="section-title">Currently running</h2>
        <p className="mt-1 text-[13px] md:text-[14px] text-ink-muted">
          Every recurring charge we detected — sorted by what costs you most.
        </p>
        <div className="mt-5">
          <RecommendationBanner rec={recommendation} />
          <SubscriptionList
            initial={subsForList}
            charges={charges}
            lastScannedAt={latestScan?.finished_at ?? null}
            latestScanId={latestScan?.id ?? null}
          />
        </div>
      </div>
    </section>
  );
}

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

async function fetchDecisionMap(
  userId: string
): Promise<Map<string, { id: string; user_decision: Subscription["user_decision"] }>> {
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

async function fetchSubscriptionsFallback(userId: string): Promise<Subscription[]> {
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
