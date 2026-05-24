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
import { ActivateProtectionCard } from "@/components/app/activate-protection-card";
import { BillingStatusBanner } from "@/components/app/billing-status-banner";
import { ProtectionStatusPill } from "@/components/app/protection-status-pill";
import { ProtectionCoverageCard } from "@/components/app/protection-coverage-card";
import { ProtectionPanel } from "@/components/app/protection-panel";
import { buildProtectionPanelData } from "@/lib/protection/panel";
import { ProtectionLockedCard } from "@/components/app/protection-locked-card";
import { SpendingPatternsAccordion } from "@/components/app/spending-patterns-accordion";
import { DashboardTabs } from "@/components/app/dashboard-tabs";
import { getOrCreatePublicSlug } from "@/lib/users/public-slug";
import { maybeNotifySignup } from "@/lib/users/signup-notify";
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

type AppSearchParams = { tab?: string };

export default async function AppHome({
  searchParams,
}: {
  searchParams?: AppSearchParams;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Tab state lives in the URL so it's bookmarkable + shareable.
  // Defaults to subscriptions; ?tab=bills swaps the hero / donut /
  // action list to the bills tier.
  const activeTab: "subscriptions" | "bills" =
    searchParams?.tab === "bills" ? "bills" : "subscriptions";

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

  // One-time ops notification to hello@frugavo.com. Idempotent —
  // sets app_users.signup_notified_at on first run so reloads don't
  // double-send. Best-effort: any failure logs and continues.
  void maybeNotifySignup({
    clerkUserId: user.id,
    email: user.emailAddresses[0]?.emailAddress ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  });

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

  // Public share slug — lazily provisioned on first dashboard view.
  // Drives the canonical /u/<slug> URL the share buttons attach to
  // navigator.share so social previews unfurl personalized.
  const publicSlug = await getOrCreatePublicSlug(user.id);

  // Entitlement check — drives the Activate Protection card above
  // IdentityHero when the user isn't currently paying, plus the
  // dunning banner for grace_period / cancelled_active / past_due.
  const entitlement = await getEntitlement(user.id);

  // New ProtectionPanel data — replaces the legacy coverage card.
  // Scoped to the active tab so "Guarding $X/mo" always reconciles
  // with the tab hero number.
  const protectionPanelData = await buildProtectionPanelData(user.id, {
    tier: activeTab,
  });
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
      <DashboardHeader
        lastScannedAt={latestScanFinishedAt}
        reveal={{
          // Numbers the ScanRevealOverlay animates TO when the user
          // hits Re-scan. Always uses the CURRENT view (subs only on
          // subs tab, bills only on bills tab) so the overlay matches
          // what the user is already looking at.
          monthly_cents:
            activeTab === "bills"
              ? data?.monthly.other_recurring_cents ?? 0
              : data?.monthly.sub_only_cents ?? 0,
          annual_savings_cents:
            data?.actions.potential_yearly_savings_cents ?? 0,
          top_rows: (activeTab === "bills"
            ? data?.top_bills ?? []
            : data?.top_subscriptions ?? []
          )
            .slice(0, 4)
            .map((t) => ({
              name: t.merchant_name,
              monthly_cents: t.monthly_cents,
            })),
        }}
      />

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
          {/*
            Desktop layout: IdentityHero on the LEFT (5 cols),
            Protection rail on the RIGHT (7 cols). Mobile stacks
            normally — IdentityHero first, Protection block below.

            For paid users the Protection rail holds Coverage +
            monitoring/changes/learn cards. For free users it holds
            the locked preview card.
          */}
          {/* Tab strip — Subscriptions / Bills. URL-driven. Sits
              above the hero grid so the user always sees which lens
              they're in. */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DashboardTabs
              active={activeTab}
              subCount={data.monthly.sub_only_count}
              billCount={data.monthly.other_recurring_count}
            />
            <div className="text-[11.5px] md:text-[12px] text-ink-muted">
              {activeTab === "subscriptions"
                ? "Things you subscribe to. Cancel-able."
                : "Recurring obligations. Watched, not cancel-able."}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">
            {/* IdentityHero only renders on the Subscriptions tab —
                personality archetypes derive from subscriptions and
                shouldn't appear when the user is looking at bills. */}
            {activeTab === "subscriptions" && (
              <div className="lg:col-span-5">
                <IdentityHero
                  monthlySubCents={data.monthly.sub_only_cents}
                  personality={data.personality}
                  publicSlug={publicSlug}
                  firstName={user.firstName ?? null}
                />
              </div>
            )}

            <div
              className={
                activeTab === "subscriptions"
                  ? "lg:col-span-7 space-y-5 md:space-y-6"
                  : "lg:col-span-12 space-y-5 md:space-y-6"
              }
            >
              {!showActivateCard ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] md:text-[13px] font-medium text-brand">
                      Your protection
                    </span>
                    <span className="text-[12px] md:text-[12.5px] text-ink-muted">
                      · Peace of Mind plan
                    </span>
                  </div>
                  <ProtectionPanel
                    data={protectionPanelData}
                    state="active"
                  />
                  {/* MonitoringAlertsCard removed — its data is now
                      fused into the ProtectionPanel's 'What we're
                      watching' subsection. The full alerts inbox
                      still lives at /app/alerts via the panel CTA. */}
                  <WhatChangedCard />
                  <UncertainPromptCards />
                </>
              ) : (
                <ProtectionLockedCard
                  title="Continuous monitoring"
                  body="Daily checks across every connected account — new charges, price hikes, trial conversions, and unusual recurring activity."
                  sampleRows={[
                    {
                      dot: "#10b981",
                      title: "New subscription detected",
                      sub: "Notion AI started billing $10/mo on May 12.",
                    },
                    {
                      dot: "#f59e0b",
                      title: "Price increase caught",
                      sub: "Netflix went from $15.49 → $17.99/mo.",
                    },
                    {
                      dot: "#dc2626",
                      title: "Trial converting in 2 days",
                      sub: "Apple Music will charge $10.99/mo on May 28.",
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {activeTab === "subscriptions" ? (
            <OverviewCard
              mode="subscriptions"
              monthly={{
                total_cents: data.monthly.sub_only_cents,
                total_count: data.monthly.sub_only_count,
                sub_only_cents: data.monthly.sub_only_cents,
                sub_only_count: data.monthly.sub_only_count,
                other_recurring_cents: 0,
                other_recurring_count: 0,
              }}
              yearly={{
                total_cents: data.yearly.sub_only_cents,
                ledger_actual_cents: data.yearly.ledger_actual_cents,
              }}
              chart12mo={data.chart_12mo}
              categories={data.subscription_categories}
              aiSpend={data.ai_spend}
              topSubscription={topSubWithDomain}
              moneyLeaks={data.money_leaks}
              shockInsights={data.shock_insights}
              allSubscriptions={data.subscriptions
                .filter(
                  (s) =>
                    (s.recurring_type as string | undefined) ===
                      "confirmed_subscription" &&
                    s.status === "active" &&
                    s.classification === "confirmed"
                )
                .map((s) => ({
                  merchant_name: s.merchant_name,
                  category: s.category,
                  monthly_cents: s.amount_cents,
                }))}
            />
          ) : (
            <OverviewCard
              mode="bills"
              monthly={{
                total_cents: data.monthly.other_recurring_cents,
                total_count: data.monthly.other_recurring_count,
                sub_only_cents: 0,
                sub_only_count: 0,
                other_recurring_cents: data.monthly.other_recurring_cents,
                other_recurring_count: data.monthly.other_recurring_count,
              }}
              yearly={{
                total_cents: data.monthly.other_recurring_cents * 12,
                ledger_actual_cents: 0,
              }}
              chart12mo={data.chart_12mo}
              categories={data.bill_categories}
              aiSpend={data.ai_spend}
              topSubscription={
                data.top_bills[0]
                  ? { ...data.top_bills[0], domain: null }
                  : null
              }
              moneyLeaks={[]}
              shockInsights={[]}
              allSubscriptions={data.subscriptions
                .filter(
                  (s) =>
                    (s.recurring_type as string | undefined) ===
                      "recurring_bill" &&
                    s.status === "active" &&
                    s.classification === "confirmed"
                )
                .map((s) => ({
                  merchant_name: s.merchant_name,
                  category: s.category,
                  monthly_cents: s.amount_cents,
                }))}
            />
          )}

          {activeTab === "subscriptions" ? (
            <ActionCenter
              worth_a_look={data.actions.worth_a_look}
              watching={data.actions.watching}
              pruned={data.actions.pruned}
              hidden={data.actions.hidden}
              potential_yearly_savings_cents={
                data.actions.potential_yearly_savings_cents
              }
            />
          ) : (
            <ActionCenter
              mode="bills"
              worth_a_look={data.bill_actions.worth_a_look}
              watching={data.bill_actions.watching}
              pruned={data.bill_actions.pruned}
              hidden={data.bill_actions.hidden}
              potential_yearly_savings_cents={0}
            />
          )}

          {/* Recurring spending patterns — collapsed accordion.
              Only shown on the Subscriptions tab. Commerce isn't
              relevant when the user is reviewing bills. */}
          {activeTab === "subscriptions" && (
            <SpendingPatternsAccordion
              items={data.recurring_commerce.map((c) => ({
                id: c.id,
                merchant_name: c.merchant_name,
                monthly_cents: c.monthly_cents,
              }))}
            />
          )}
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
