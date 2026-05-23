import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";
import { DashboardHeader } from "@/components/app/dashboard-header";
import { TimezoneCapture } from "@/components/app/timezone-capture";
import { IdentityHero } from "@/components/app/identity-hero";
import { OverviewCard } from "@/components/app/overview-card";
import { ActionCenter } from "@/components/app/action-center";
import { WhatChangedCard } from "@/components/app/what-changed-card";
import { UncertainPromptCards } from "@/components/app/uncertain-prompt-cards";
import { MonitoringAlertsCard } from "@/components/app/monitoring-alerts-card";
import { ActivateProtectionCard } from "@/components/app/activate-protection-card";
import { BillingStatusBanner } from "@/components/app/billing-status-banner";
import { ProtectionStatusPill } from "@/components/app/protection-status-pill";
import { getEntitlement } from "@/lib/billing/entitlements";
import { buildDashboardData } from "@/lib/selectors/dashboard";

// /app — the authenticated dashboard root.
//
// IA per refactor v2:
//   1. DashboardHeader
//   2. IdentityHero      (personality + share)
//   3. OverviewCard      (canonical $, donut, insights, sparkline — ONE block)
//   4. WhatChangedCard   (auto-hides)
//   5. UncertainPromptCards (auto-hides)
//   6. ActionCenter      (THE single list — 4 tabs, sort, pagination)
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
  const latestScanFinishedAt = data?.meta.last_scanned_at ?? null;

  // Entitlement check — drives the Activate Protection card above
  // IdentityHero when the user isn't currently paying, plus the
  // dunning banner for grace_period / cancelled_active / past_due.
  const entitlement = await getEntitlement(user.id);
  const showActivateCard =
    entitlement.entitlement_state === "none" ||
    entitlement.entitlement_state === "expired" ||
    entitlement.entitlement_state === "past_due";
  const activateVariant: "none" | "expired" | "past_due" =
    entitlement.entitlement_state === "expired"
      ? "expired"
      : entitlement.entitlement_state === "past_due"
        ? "past_due"
        : "none";
  const bannerVariant:
    | "grace_period"
    | "cancelled_active"
    | "past_due"
    | null =
    entitlement.entitlement_state === "grace_period"
      ? "grace_period"
      : entitlement.entitlement_state === "cancelled_active"
        ? "cancelled_active"
        : entitlement.entitlement_state === "past_due"
          ? "past_due"
          : null;

  // Top subscription gets an explicit domain so its logo can render
  // in the merged Overview "Biggest sub" pinned row.
  const topSubWithDomain =
    data && data.top_subscriptions[0]
      ? {
          ...data.top_subscriptions[0],
          domain:
            data.actions.worth_a_look.find(
              (a) => a.subscription_id === data.top_subscriptions[0].id
            )?.domain ??
            data.actions.watching.find(
              (a) => a.subscription_id === data.top_subscriptions[0].id
            )?.domain ??
            data.actions.pruned.find(
              (a) => a.subscription_id === data.top_subscriptions[0].id
            )?.domain ??
            null,
        }
      : null;

  return (
    <section className="container-page py-6 md:py-12 max-w-[1200px] space-y-5 md:space-y-8">
      <TimezoneCapture />
      <DashboardHeader lastScannedAt={latestScanFinishedAt} />

      {/* Inline status — visible signal that protection is active.
          Renders for trialing / active / cancelled_active; silent
          for grace/past_due (banner above already shouts), and for
          'none' (activate card below does the talking). */}
      <div className="-mt-2">
        <ProtectionStatusPill
          state={entitlement.entitlement_state}
          trialEndsAt={entitlement.trial_ends_at}
          expiresAt={entitlement.expires_at}
        />
      </div>

      {bannerVariant && <BillingStatusBanner variant={bannerVariant} />}
      {showActivateCard && <ActivateProtectionCard variant={activateVariant} />}

      {data && (
        <>
          <IdentityHero
            monthlySubCents={data.monthly.sub_only_cents}
            personality={data.personality}
          />

          <OverviewCard
            monthly={data.monthly}
            yearly={data.yearly}
            chart12mo={data.chart_12mo}
            categories={data.categories}
            aiSpend={data.ai_spend}
            topSubscription={topSubWithDomain}
            moneyLeaks={data.money_leaks}
            shockInsights={data.shock_insights}
          />

          {/*
            Paid-only cards. We render the monitoring/changes/learn
            surfaces only for entitled users. Free users still see
            Overview + ActionCenter — the scan IS the value demo,
            and the activate card above the hero is the upsell.
            Grouped under a clear section label so paid users can
            see exactly which features their protection unlocks.
          */}
          {!showActivateCard && (
            <div className="space-y-5 md:space-y-8">
              <div className="flex items-center gap-2">
                <span className="text-[12px] md:text-[13px] font-medium text-brand">
                  Your protection
                </span>
                <span className="text-[12px] md:text-[12.5px] text-ink-muted">
                  · features included in your Peace of Mind plan
                </span>
              </div>
              <MonitoringAlertsCard />
              <WhatChangedCard />
              <UncertainPromptCards />
            </div>
          )}

          <ActionCenter
            worth_a_look={data.actions.worth_a_look}
            watching={data.actions.watching}
            pruned={data.actions.pruned}
            hidden={data.actions.hidden}
            potential_yearly_savings_cents={
              data.actions.potential_yearly_savings_cents
            }
          />
        </>
      )}
    </section>
  );
}

// Snapshot existence check — used only by the first-scan redirect
// branch to know whether to run the inline scan and bounce to
// /app/welcome.
async function fetchLatestSnapshotRows(userId: string): Promise<unknown[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("scan_snapshots")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? [data] : [];
}
