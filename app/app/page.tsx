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
import { buildWatchdogDigest } from "@/lib/watchdog/digest";
import { WatchdogOverlay } from "@/components/app/watchdog-overlay";
import { ProtectionLockedCard } from "@/components/app/protection-locked-card";
import { SpendingPatternsAccordion } from "@/components/app/spending-patterns-accordion";
import { DashboardTabs } from "@/components/app/dashboard-tabs";
import { getOrCreatePublicSlug } from "@/lib/users/public-slug";
import { maybeNotifySignup } from "@/lib/users/signup-notify";
import { getEntitlement } from "@/lib/billing/entitlements";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { SHOW_BILLS_SURFACE } from "@/lib/feature-flags";
import { computeIngestionState } from "@/lib/ingestion-state";
import { PreparingScreen } from "@/components/app/preparing-screen";
import { NeedsReauthScreen } from "@/components/app/needs-reauth-screen";

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
  //
  // SHOW_BILLS_SURFACE feature flag: when false (current default),
  // the Bills tab is hidden entirely and activeTab is pinned to
  // subscriptions regardless of the URL param. Bills are still
  // detected + persisted by the engine — only the UI surface is
  // hidden. Flip the flag in lib/feature-flags.ts to re-expose.
  const activeTab: "subscriptions" | "bills" = SHOW_BILLS_SURFACE
    ? searchParams?.tab === "bills"
      ? "bills"
      : "subscriptions"
    : "subscriptions";

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
    // No bank connected yet — skip the intermediate "Welcome / Let's
    // connect your bank" screen and send the user straight to the
    // redesigned /app/connect page. That page does all the trust
    // signaling and value-prop work above-the-fold, so a separate
    // landing card here was pure friction (extra click, no info gain).
    redirect("/app/connect");
  }

  // First-scan path — bounce to /app/welcome for the emotional
  // reveal. The /app/connect flow already runs the scan via
  // /app/scanning before redirecting back here, so by the time we
  // hit this code there's always a scan_snapshot. The gate is
  // app_users.welcomed_at — null means the user has never completed
  // the welcome reveal, so they get sent there once. The welcome
  // page stamps welcomed_at on first reveal-stage render so a
  // mid-flow refresh doesn't ricochet.
  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("welcomed_at")
    .eq("id", user.id)
    .maybeSingle();

  // v8 — Bug #2 fix: entitlement check moved ABOVE the welcomed_at
  // guard so the guard can use it. Two interlocking failure modes
  // both produced the "Activate Protection loops back" symptom:
  //   1. markWelcomed() was fire-and-forget; the welcomed_at write
  //      could die when window.location.href tore down the page.
  //   2. Even after that race is closed (await markWelcomed() in
  //      onboarding-reveal.tsx), a future race could still leave
  //      welcomed_at null while entitlement is active.
  // The defensive layer: if the user is PROTECTED (trialing/active/
  // cancelled_active), they came from billing-success. Treat them
  // as welcomed regardless of the flag's state. Backfill the flag
  // so subsequent renders are stable and the entitlement check
  // never re-runs as a workaround.
  const entitlement = await getEntitlement(user.id);
  const isProtected =
    entitlement.entitlement_state === "active" ||
    entitlement.entitlement_state === "trialing" ||
    entitlement.entitlement_state === "cancelled_active";

  if (!userRow?.welcomed_at && isProtected) {
    // Self-heal: the user is protected (paid through Stripe) but
    // welcomed_at slipped through one of the race windows. Stamp
    // it now so the loop never recurs for this user, then continue
    // rendering the dashboard normally.
    await supabaseAdmin
      .from("app_users")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("welcomed_at", null);
  } else if (!userRow?.welcomed_at) {
    // Defensive: if somehow there are no snapshots yet, kick one
    // off synchronously so the reveal has data to render.
    const snapshotRows = await fetchLatestSnapshotRows(user.id);
    if (snapshotRows.length === 0) {
      await runScanForUser(user.id);
    }
    redirect("/app/welcome");
  }

  // ---- STATE-AWARE DASHBOARD ROUTE ----
  //
  // /app is now a state machine over ingestion progress, not over
  // "do we have data right now." Six states; only two render the
  // actual dashboard cards:
  //
  //   preparing / syncing / analyzing → <PreparingScreen/>
  //       Real milestone strip ("Connected to {bank}" → "Fetching
  //       transactions (N)" → "Analyzing patterns" → "Building your
  //       dashboard") + skeleton card layout below. Polls every 4s.
  //
  //   needs_reauth → <NeedsReauthScreen/>
  //       Plaid wants the user to re-link. Polls for resolution.
  //
  //   ready_with_results / ready_but_empty → full dashboard below.
  //       Numbers are trustable. The two cases diverge only in the
  //       empty-state copy inside the cards.
  //
  // Critical rule: once app_users.first_ready_at is set on this user,
  // computeIngestionState NEVER returns preparing/syncing/analyzing
  // again. Subsequent re-scans surface as ready_with_results
  // (refreshing=true) — the user always sees their cached dashboard
  // with a small "updating" indicator, never a blank waiting screen.
  // The "never empty after first ready" guarantee that fintech
  // dashboards (Mercury / Brex / Ramp / Copilot) all maintain.
  const ingestion = await computeIngestionState(user.id);

  if (ingestion.state === "needs_reauth") {
    return <NeedsReauthScreen bankNames={ingestion.diagnostics.bankNames} />;
  }

  if (
    ingestion.state === "preparing" ||
    ingestion.state === "syncing" ||
    ingestion.state === "analyzing"
  ) {
    const diag = ingestion.diagnostics;
    const initialTxnCount =
      ingestion.state === "syncing" || ingestion.state === "analyzing"
        ? ingestion.txnCount
        : 0;
    return (
      <PreparingScreen
        initialState={ingestion.state}
        bankNames={diag.bankNames}
        initialTxnCount={initialTxnCount}
        classicLikely={diag.items.some((i) => i.classicLikely)}
        noSuccessfulUpdateYet={diag.noSuccessfulUpdateYet}
      />
    );
  }

  // ready_with_results or ready_but_empty — fall through to the
  // normal dashboard render. The dashboard cards themselves handle
  // the empty-state copy when buildDashboardData returns zeros.
  const ingestionRefreshing =
    (ingestion.state === "ready_with_results" ||
      ingestion.state === "ready_but_empty") &&
    ingestion.refreshing;
  void ingestionRefreshing; // surfaced below via a small badge

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
  // (Fetched earlier in the welcomed-backfill block.)

  // Single source of truth for "is this user a paying customer right
  // now?" — drives the row-level Cancel button visibility, the
  // Re-scan icon affordance, and any other paid-only surface area.
  // Treat trialing as paid: they have full access until the trial
  // converts or lapses. cancelled_active = cancelled but still inside
  // the paid period → also full access until expiry. Mirrors the
  // isProtected calculation above; kept as a separate variable so
  // any future divergence in semantics is explicit.
  const isPaid = isProtected;

  // Auto re-scan on /app open for paid users, capped at once per 24h.
  // Fire-and-forget — we don't await it, so the dashboard renders
  // immediately with the existing snapshot. The next render (or the
  // watchdog overlay) picks up newly-discovered items. Free users
  // skip this entirely; their "Re-scan" surface area is the locked
  // icon in DashboardHeader.
  if (isPaid && latestScanFinishedAt) {
    const lastScanMs = new Date(latestScanFinishedAt).getTime();
    const staleAfterMs = 24 * 60 * 60 * 1000; // 24h
    if (Date.now() - lastScanMs > staleAfterMs) {
      // No await — the scan can take 5–15s and we don't want to block
      // first paint. runScanForUser's internal Plaid path is idempotent
      // and the rate-limit on /api/plaid/scan protects against accidental
      // concurrent triggers if the user refreshes mid-scan.
      void runScanForUser(user.id, "auto");
    }
  }

  // New ProtectionPanel data — replaces the legacy coverage card.
  // Scoped to the active tab so "Guarding $X/mo" always reconciles
  // with the tab hero number.
  const protectionPanelData = await buildProtectionPanelData(user.id, {
    tier: activeTab,
  });

  // Daily watchdog — overlay that shows "while you were away" on
  // return visits when notable events have occurred since the last
  // view. Null when nothing happened; the component never renders.
  // Skipped entirely on first-scan paths (we only reach here after
  // the welcome reveal, but the lookback is bounded so a brand-new
  // user won't see a giant backfilled splash).
  const watchdogDigest = await buildWatchdogDigest(user.id);
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
      {/* Daily watchdog reveal — portals itself into <body>, so the
          DOM position here doesn't matter visually. It only renders
          when buildWatchdogDigest returns a non-null payload (i.e.
          something notable happened since the user's last view). On
          dismiss, POST /api/watchdog/seen bumps watchdog_seen_at so
          the overlay doesn't reappear until new events accrue. */}
      {watchdogDigest && <WatchdogOverlay digest={watchdogDigest} />}
      <DashboardHeader
        lastScannedAt={latestScanFinishedAt}
        isPaid={isPaid}
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
          // Sign-up date powers the "Protected since [date]" pill.
          // Clerk createdAt is a number (ms) — convert to ISO so the
          // pill can render a consistent short date.
          protectionStartedAt={
            user.createdAt
              ? new Date(user.createdAt).toISOString()
              : null
          }
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
              they're in. Hidden when SHOW_BILLS_SURFACE=false; with
              the Bills lens gone there's only one view, so the
              switcher would be a stub. */}
          {SHOW_BILLS_SURFACE && (
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
          )}

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
                  // Hard guard against the share card disagreeing
                  // with the dashboard. When the payload has zero
                  // confirmed subs the /api/share-card/identity SVG
                  // returns 204; without this flag the <img> would
                  // break and the personality copy would still
                  // show "Quietly Watching $0/mo". With it,
                  // IdentityHero renders its own skeleton.
                  hasData={
                    data.monthly.sub_only_count > 0 &&
                    data.monthly.sub_only_cents > 0
                  }
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
              isPaid={isPaid}
            />
          ) : (
            <ActionCenter
              mode="bills"
              worth_a_look={data.bill_actions.worth_a_look}
              watching={data.bill_actions.watching}
              pruned={data.bill_actions.pruned}
              hidden={data.bill_actions.hidden}
              potential_yearly_savings_cents={0}
              isPaid={isPaid}
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
