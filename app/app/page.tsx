import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runScanForUser } from "@/lib/scan";
import { TimezoneCapture } from "@/components/app/timezone-capture";
import { DashboardSessionPinger } from "@/components/app/dashboard-session-pinger";
import { FounderFeedbackChip } from "@/components/app/founder-feedback-chip";
import { AppIntro } from "@/components/app/app-intro";
import { InstallFrugavoRow } from "@/components/app/install-frugavo-row";
import { BillingStatusBanner } from "@/components/app/billing-status-banner";
import { buildWatchdogDigest } from "@/lib/watchdog/digest";
import { WatchdogOverlay } from "@/components/app/watchdog-overlay";
import { maybeNotifySignup } from "@/lib/users/signup-notify";
import { getEntitlement } from "@/lib/billing/entitlements";
import { buildDashboardData } from "@/lib/selectors/dashboard";
import { isEffectivelyPaid } from "@/lib/billing/beta";
import { computeIngestionState } from "@/lib/ingestion-state";
import { PreparingScreen } from "@/components/app/preparing-screen";
import { NeedsReauthScreen } from "@/components/app/needs-reauth-screen";
import { composeFindings } from "@/lib/selectors/findings";
import {
  HomeHeroBand,
  HomeLiveStatusStrip,
  NoticedSectionHeader,
  MoneySectionHeader,
  DiscoverSectionHeader,
  FeaturedNoticedCard,
  RenewalsCard,
  SpendingCard,
  InsightsCard,
  YourCardCard,
  ShareCard,
} from "@/components/app/home-switchboard";

// /app — the authenticated dashboard home.
//
// REBUILT as a calm switchboard of heterogeneous cards. Surface stays
// simple; richness (findings, calendar, full breakdowns) lives one
// or two taps deeper at /app/noticed, /app/renewals, /app/spending,
// /app/insights, /app/card, /app/share.
//
// Upstream logic preserved:
//   • currentUser + Clerk redirect
//   • supabaseAdmin guard
//   • app_users mirror row upsert
//   • maybeNotifySignup ops ping
//   • plaid_items existence → /app/connect redirect
//   • welcomed_at self-heal for paid users
//   • IngestionState routing → PreparingScreen / NeedsReauthScreen
//   • Welcome reveal redirect when ready_with_results
//   • buildDashboardData (single source of truth for numbers)
//   • Auto re-scan (24h cap)
//   • BillingStatusBanner (dunning)
//   • WatchdogOverlay (return-visit reveal)
//   • AppIntro + DashboardSessionPinger

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

  // One-time ops notification to hello@frugavo.com. Best-effort.
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
    redirect("/app/connect");
  }

  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("welcomed_at, dashboard_first_session_at")
    .eq("id", user.id)
    .maybeSingle();

  const entitlement = await getEntitlement(user.id);
  const isProtected = isEffectivelyPaid(entitlement);

  // Self-heal: stamp welcomed_at for paid users so the loop never
  // recurs across the race windows.
  if (!userRow?.welcomed_at && isProtected) {
    await supabaseAdmin
      .from("app_users")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("welcomed_at", null);
  }

  // State-aware ingestion routing.
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

  // First-scan welcome reveal — only after ingestion truly settled.
  if (!userRow?.welcomed_at && ingestion.state === "ready_but_empty") {
    await supabaseAdmin
      .from("app_users")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("welcomed_at", null);
  } else if (
    !userRow?.welcomed_at &&
    ingestion.state === "ready_with_results"
  ) {
    redirect("/app/welcome");
  }

  // Pull the canonical dashboard payload.
  const data = await buildDashboardData(user.id);
  const latestScanFinishedAt = data?.meta.last_scanned_at ?? null;

  // Auto re-scan, capped at once per 24h. Fire-and-forget.
  if (isProtected && latestScanFinishedAt) {
    const lastScanMs = new Date(latestScanFinishedAt).getTime();
    const staleAfterMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastScanMs > staleAfterMs) {
      void runScanForUser(user.id, "auto");
    }
  }

  // Daily watchdog overlay — null when nothing notable accrued.
  const watchdogDigest = await buildWatchdogDigest(user.id);

  // Dunning banner for grace_period / cancelled_active / past_due.
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

  // ─── Derive switchboard inputs ───────────────────────────────

  // Findings feed — single verb-led list. Top item drives the
  // featured card; the rest live on /app/noticed.
  // Pass actionItems so the aggregator can look up sub.confidence
  // and months_observed to compute a REAL per-finding score.
  // Resolved findings are filtered out — fetched below before
  // composing.
  const resolvedFindingIds = await loadResolvedFindingIds(
    supabaseAdmin,
    user.id
  );
  const findings = data
    ? composeFindings({
        moneyLeaks: data.money_leaks,
        shockInsights: data.shock_insights,
        concentration: data.concentration,
        actionItems: [
          ...data.actions.worth_a_look,
          ...data.actions.watching,
        ],
        resolvedFindingIds,
      })
    : [];
  const topFinding = findings[0] ?? null;

  // Renewals — actions with a predicted next_expected_charge_at in
  // the next 14 days. The deep view (/app/renewals) shows the full
  // month.
  const now = new Date();
  const fourteenAhead = new Date(now);
  fourteenAhead.setDate(now.getDate() + 14);
  const upcomingRenewals = data
    ? [...data.actions.worth_a_look, ...data.actions.watching].filter(
        (a) =>
          a.next_expected_charge_at &&
          new Date(a.next_expected_charge_at) >= now &&
          new Date(a.next_expected_charge_at) <= fourteenAhead &&
          a.override_type !== "cancelled" &&
          a.override_type !== "not_subscription" &&
          a.override_type !== "not_recurring"
      )
    : [];
  const renewalsTotalCents = upcomingRenewals.reduce(
    (acc, a) => acc + a.monthly_cents,
    0
  );
  // Bar ticks — normalize each upcoming day to 0..1 across the 14-day
  // window for the segmented hint bar.
  const barTicks = upcomingRenewals
    .map((a) => {
      const ms = new Date(a.next_expected_charge_at as string).getTime();
      const t = (ms - now.getTime()) / (14 * 24 * 60 * 60 * 1000);
      return Math.max(0, Math.min(1, t));
    })
    .sort((a, b) => a - b);

  // Spending — monthly subs total + concentration line as conclusion.
  const monthlySubCents = data?.monthly.sub_only_cents ?? 0;
  const monthlySubCount = data?.monthly.sub_only_count ?? 0;
  const spendingConclusion = data?.concentration
    ? data.concentration.headline
    : null;

  const personality = data?.personality ?? null;
  const monitoringCharges = monthlySubCount;
  const watchingRenewals = upcomingRenewals.length;

  return (
    <>
      {/* AppIntro — first-paint splash, one-shot per session. */}
      <AppIntro firstName={user.firstName ?? null} />
      <TimezoneCapture />
      <DashboardSessionPinger
        alreadySet={!!userRow?.dashboard_first_session_at}
      />
      {watchdogDigest && <WatchdogOverlay digest={watchdogDigest} />}

      {/* BillingStatusBanner — dunning. Sticky at top of content. */}
      {bannerVariant && <BillingStatusBanner variant={bannerVariant} />}

      {/* ─── Hero band — bleeds under sticky header ─────────── */}
      <HomeHeroBand monitoringCharges={monitoringCharges} />

      {/* ─── LIVE status strip — sticky, overlaps hero ──────── */}
      <HomeLiveStatusStrip
        lastScanIso={latestScanFinishedAt}
        monitoringCharges={monitoringCharges}
        watchingRenewals={watchingRenewals}
      />

      {/* ─── Switchboard cards ───────────────────────────────── */}
      <section className="container-page max-w-[1100px] mt-6 md:mt-8 space-y-8 md:space-y-10 pb-16">
        {/* "Frugavo noticed" — featured card */}
        <div>
          <NoticedSectionHeader count={findings.length} />
          {topFinding ? (
            <FeaturedNoticedCard
              totalFindings={findings.length}
              topHeadline={topFinding.headline}
              topConclusion={topFinding.conclusion}
            />
          ) : (
            // Empty state — nothing flagged. Calm placeholder so the
            // section header doesn't dangle.
            <div className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
              <div className="text-[14px] font-medium text-ink">
                Nothing flagged right now
              </div>
              <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
                We&apos;ll surface findings here as soon as something
                changes — price moves, new recurring charges, overlaps.
              </p>
            </div>
          )}
        </div>

        {/* "Your money" — 2-up */}
        <div>
          <MoneySectionHeader />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RenewalsCard
              upcomingCount={upcomingRenewals.length}
              estimatedTotalCents={renewalsTotalCents}
              barTicks={barTicks}
            />
            <SpendingCard
              monthlyCents={monthlySubCents}
              subCount={monthlySubCount}
              conclusion={spendingConclusion}
            />
          </div>
        </div>

        {/* "Discover more" — 3-up */}
        <div>
          <DiscoverSectionHeader />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InsightsCard insightCount={findings.length} />
            {personality ? (
              <YourCardCard personality={personality} />
            ) : (
              <div className="rounded-2xl border border-hairline bg-white p-5 md:p-6">
                <div className="text-[12.5px] text-ink-muted">
                  Your subscription personality appears once your first
                  analysis completes.
                </div>
              </div>
            )}
            <ShareCard />
          </div>
        </div>

        {/* Footer — install + talk to Nabil. Quiet, non-competing. */}
        <div className="pt-6 mt-2 border-t border-hairline/60 space-y-4">
          <InstallFrugavoRow />
          <div className="pt-4 border-t border-hairline/60 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11.5px] text-ink-muted leading-relaxed max-w-[480px]">
              Frugavo is in early access. If something confuses or surprises
              you, tell us — every note shapes what we build next.
            </p>
            <FounderFeedbackChip />
          </div>
        </div>
      </section>
    </>
  );
}

// ─── helpers ────────────────────────────────────────────────────

// Load the set of finding_ids the user has resolved (either
// "look_into_it" or "looks_fine"). Read from feedback_finding_resolve
// (introduced in migration 038). Best-effort: if the table is missing
// or the query fails, returns an empty set so the feed degrades to
// "show everything" rather than breaking the render.
type SupabaseLike = NonNullable<typeof supabaseAdmin>;
async function loadResolvedFindingIds(
  supabase: SupabaseLike,
  clerkUserId: string
): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from("feedback_finding_resolve")
      .select("finding_id")
      .eq("clerk_user_id", clerkUserId);
    const out = new Set<string>();
    for (const row of (data ?? []) as Array<{ finding_id: string }>) {
      out.add(row.finding_id);
    }
    return out;
  } catch {
    return new Set<string>();
  }
}
