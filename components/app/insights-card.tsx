"use client";

// InsightsCard — merged "What we noticed" + the three floating stat
// tiles (AI Stack, Biggest Sub, Money Leaks).
//
// Layout:
//   • Top: 3 pinned stat tiles as compact rows (no longer floating
//     above the card).
//   • Middle: Alerts (orange dot) — money leaks. Right-aligned
//     "Review" button per row, links to the subscription detail
//     page when an ID is attached.
//   • Bottom: Patterns (green dot) — shock insights. Plain rows.
//   • Each list caps at 5 visible items + "Show all" toggle.

import { useState } from "react";
import Link from "next/link";
import type { AiSpend, ShockInsight, TopSubscription } from "@/lib/insights";
import type { MoneyLeak } from "@/lib/money-leaks";

type Props = {
  aiSpend: AiSpend;
  topSubscription: TopSubscription | null;
  moneyLeakCount: number;
  alerts: MoneyLeak[];
  patterns: ShockInsight[];
};

function fmt(c: number, opts: { withCents?: boolean } = {}): string {
  const v = c / 100;
  if (opts.withCents === false) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const CAP = 5;

export function InsightsCard({
  aiSpend,
  topSubscription,
  moneyLeakCount,
  alerts,
  patterns,
}: Props) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  const alertsVisible = showAllAlerts ? alerts : alerts.slice(0, CAP);
  const patternsVisible = showAllPatterns ? patterns : patterns.slice(0, CAP);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <h2 className="font-display text-[18px] md:text-[22px] font-bold tracking-[-0.01em] text-ink leading-tight">
        Insights
      </h2>

      {/* Pinned stat rows */}
      <div className="mt-4 divide-y divide-hairline border-y border-hairline">
        <StatRow
          dotColor="bg-brand"
          label="AI stack"
          value={
            aiSpend.subscription_count === 0
              ? "$0/mo"
              : `${fmt(aiSpend.monthly_cents)}/mo`
          }
          detail={
            aiSpend.subscription_count === 0
              ? "No AI subscriptions detected"
              : `${aiSpend.subscription_count} tool${aiSpend.subscription_count === 1 ? "" : "s"} · ${fmt(aiSpend.yearly_cents, { withCents: false })}/yr`
          }
        />
        <StatRow
          dotColor="bg-accent"
          label="Biggest sub"
          value={topSubscription ? `${fmt(topSubscription.monthly_cents)}/mo` : "—"}
          detail={topSubscription?.merchant_name ?? "Nothing detected"}
        />
        <StatRow
          dotColor="bg-danger"
          label="Money leaks"
          value={String(moneyLeakCount)}
          detail={
            moneyLeakCount === 0
              ? "Nothing flagged"
              : `${alerts.filter((l) => l.severity === "high").length} high · ${alerts.filter((l) => l.severity === "medium").length} medium`
          }
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="flex items-center gap-2 text-[12px] md:text-[13px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              Alerts
              <span className="text-ink-muted/60 normal-case tracking-normal">
                {alerts.length}
              </span>
            </h3>
            {alerts.length > CAP && (
              <button
                type="button"
                onClick={() => setShowAllAlerts((v) => !v)}
                className="text-[12px] text-ink-muted hover:text-ink transition"
              >
                {showAllAlerts ? "Show less" : `Show all (${alerts.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {alertsVisible.map((leak) => {
              const sid = leak.source.subscription_ids?.[0];
              return (
                <InsightRow
                  key={leak.id}
                  headline={leak.headline}
                  detail={leak.detail}
                  dot={
                    leak.severity === "high"
                      ? "bg-danger"
                      : leak.severity === "medium"
                        ? "bg-accent"
                        : "bg-ink-muted"
                  }
                  action={
                    sid
                      ? {
                          href: `/app/subscriptions/${sid}`,
                          label: "Review",
                        }
                      : null
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="flex items-center gap-2 text-[12px] md:text-[13px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              Patterns
              <span className="text-ink-muted/60 normal-case tracking-normal">
                {patterns.length}
              </span>
            </h3>
            {patterns.length > CAP && (
              <button
                type="button"
                onClick={() => setShowAllPatterns((v) => !v)}
                className="text-[12px] text-ink-muted hover:text-ink transition"
              >
                {showAllPatterns ? "Show less" : `Show all (${patterns.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {patternsVisible.map((s) => (
              <InsightRow
                key={s.id}
                headline={s.headline}
                detail={s.detail}
                dot="bg-brand"
                action={null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({
  dotColor,
  label,
  value,
  detail,
}: {
  dotColor: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 md:py-4">
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted w-[120px] md:w-[140px] shrink-0">
        {label}
      </div>
      <div className="text-[14px] md:text-[15px] font-display font-bold tabular-nums text-ink shrink-0">
        {value}
      </div>
      <div className="text-[12px] md:text-[13px] text-ink-body truncate flex-1 min-w-0">
        {detail}
      </div>
    </div>
  );
}

function InsightRow({
  headline,
  detail,
  dot,
  action,
}: {
  headline: string;
  detail: string;
  dot: string;
  action: { href: string; label: string } | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-canvas/40 px-3 py-3 md:px-4 md:py-3.5">
      <span className={`mt-1.5 inline-block h-2 w-2 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] md:text-[15px] font-medium text-ink leading-snug">
          {headline}
        </div>
        <div className="mt-0.5 text-[12px] md:text-[13px] text-ink-body leading-relaxed">
          {detail}
        </div>
      </div>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border border-hairline bg-surface hover:bg-ink/[0.04] text-ink text-[12px] font-medium transition"
        >
          {action.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </div>
  );
}
