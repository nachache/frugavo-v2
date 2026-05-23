import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { loadPreferences } from "@/lib/notifications/preferences";

// Always-visible "what your protection is watching" card. Server
// component — pulls live counts so the user sees the actual
// monitoring activity, not just static marketing copy.
//
// Why this exists: the dashboard's other paid-only cards
// (MonitoringAlertsCard, WhatChangedCard, UncertainPromptCards)
// all auto-hide when there's no data. A brand-new paid user
// therefore saw the "Your protection" header with NOTHING under
// it. This card fills that void with explicit coverage detail
// and current activity, so the user always sees value.

type CoverageRow = {
  label: string;
  body: string;
  count: number;
  href: string;
};

async function fetchCoverage(userId: string): Promise<CoverageRow[]> {
  // Defaults in case Supabase is unreachable — never show a broken
  // card. Static rows still describe the protection.
  const fallback: CoverageRow[] = [
    {
      label: "New subscriptions",
      body: "Frugavo alerts you the first time a new recurring charge appears on any connected account.",
      count: 0,
      href: "/app/alerts",
    },
    {
      label: "Price increases",
      body: "We catch when a subscription quietly raises its price — even small ones over 5%.",
      count: 0,
      href: "/app/alerts",
    },
    {
      label: "Trial conversions",
      body: "We alert you 24 hours before a free trial converts to a paid charge.",
      count: 0,
      href: "/app/alerts",
    },
    {
      label: "Unusual + duplicate charges",
      body: "Dormant subscriptions resuming, duplicate services, or higher-than-normal amounts.",
      count: 0,
      href: "/app/alerts",
    },
  ];

  if (!supabaseAdmin) return fallback;

  const { data, error } = await supabaseAdmin
    .from("monitoring_alerts")
    .select("alert_type")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !data) return fallback;

  let newSubs = 0;
  let priceHikes = 0;
  let trials = 0;
  let unusual = 0;
  for (const row of data) {
    switch (row.alert_type) {
      case "new_subscription":
        newSubs++;
        break;
      case "price_increase":
        priceHikes++;
        break;
      case "trial_converting":
        trials++;
        break;
      default:
        unusual++;
        break;
    }
  }

  return [
    { ...fallback[0], count: newSubs },
    { ...fallback[1], count: priceHikes },
    { ...fallback[2], count: trials },
    { ...fallback[3], count: unusual },
  ];
}

// Friendly summary of the user's current digest cadence — shown
// inline on the Coverage card so the user always sees "here's how
// many emails Frugavo plans to send you" without digging into
// settings. Reduces churn pressure from notification overload.
function cadenceSummary(cadence: "daily" | "weekly" | "monthly" | "off"): {
  label: string;
  rough: string;
} {
  switch (cadence) {
    case "daily":
      return { label: "Daily digest", rough: "~30 emails / month" };
    case "weekly":
      return { label: "Weekly digest", rough: "~4 emails / month" };
    case "monthly":
      return { label: "Monthly digest", rough: "1 email / month" };
    case "off":
      return { label: "Digest off", rough: "urgent alerts only" };
  }
}

export async function ProtectionCoverageCard({ userId }: { userId: string }) {
  const [rows, prefs] = await Promise.all([
    fetchCoverage(userId),
    loadPreferences(userId),
  ]);
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const cad = cadenceSummary(prefs.digest_cadence);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[12px] md:text-[13px] font-medium text-brand">
              Coverage
            </div>
            <span className="inline-flex items-center rounded-full border border-brand/25 bg-brand/[0.08] px-1.5 h-[18px] text-[9.5px] font-medium uppercase tracking-[0.1em] text-brand leading-none">
              Protection
            </span>
          </div>
          <h2 className="mt-1 font-display text-[20px] md:text-[24px] font-bold tracking-[-0.02em] leading-tight text-ink">
            What your protection is watching
          </h2>
        </div>
        <div className="text-right">
          <div className="font-display text-[24px] md:text-[28px] font-bold tabular-nums text-ink leading-none">
            {total}
          </div>
          <div className="text-[11.5px] md:text-[12px] text-ink-muted">
            active alert{total === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className="group rounded-xl border border-hairline px-4 py-3 hover:bg-ink/[0.02] transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13.5px] md:text-[14px] font-medium text-ink">
                {r.label}
              </div>
              <div
                className={`shrink-0 inline-flex items-center justify-center rounded-full px-2 h-5 text-[11px] font-medium tabular-nums leading-none ${
                  r.count > 0
                    ? "bg-brand/10 text-brand"
                    : "bg-ink/5 text-ink-muted"
                }`}
              >
                {r.count}
              </div>
            </div>
            <div className="mt-1 text-[12px] md:text-[12.5px] text-ink-body leading-snug">
              {r.body}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-hairline">
        {/* Cadence chip — tells the user exactly how often Frugavo
            will email them. Click to change in settings. */}
        <Link
          href="/app/settings/notifications"
          className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas/40 px-3 h-8 text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand"
            aria-hidden="true"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
          <span>
            {cad.label}
            <span className="text-ink-muted font-normal"> · {cad.rough}</span>
          </span>
          <span className="text-[10.5px] text-ink-muted font-normal">
            Change
          </span>
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] md:text-[12.5px] text-ink-muted">
          <Link
            href="/app/alerts"
            className="text-brand hover:underline"
          >
            See all alerts →
          </Link>
          <span className="text-ink-muted">·</span>
          <Link
            href="/app/protection"
            className="text-brand hover:underline"
          >
            See what we&apos;ve caught for you →
          </Link>
        </div>
      </div>
    </div>
  );
}
