// InsightsHero v3 — composition after PDF feedback:
//
//   1. Identity + Monthly upkeep row (2 columns on md+, stacked on mobile)
//        LEFT  → identity card SVG preview (with share buttons row below)
//        RIGHT → MonthlyUpkeepCard (big number, chart, donut, re-scan)
//   2. Stats row — AI / Biggest sub / Money leaks
//   3. More share cards — monthly / yearly / AI thumbnails
//   4. What we noticed — shock + leaks compact list
//
// The standalone burn hero is intentionally removed — its info now
// lives inside the identity card (which is itself shareable) and the
// MonthlyUpkeepCard (which carries the live numbers + chart). Removing
// it eliminates the duplication the user flagged.

import type {
  BurnRate,
  AiSpend,
  CategoryTotal,
  TopSubscription,
  ShockInsight,
  MonthBucket,
} from "@/lib/insights";
import type { Personality } from "@/lib/personality";
import type { MoneyLeak } from "@/lib/money-leaks";
import { ShareButtons } from "./share-buttons";
import { MonthlyUpkeepCard } from "./monthly-upkeep-card";
import { UncertainPromptCards } from "./uncertain-prompt-cards";

function fmtCents(c: number, opts: { withCents?: boolean } = {}): string {
  const dollars = c / 100;
  if (opts.withCents === false) {
    return `$${Math.round(dollars).toLocaleString("en-US")}`;
  }
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export type InsightsHeroProps = {
  burn: BurnRate;
  aiSpend: AiSpend;
  categories: CategoryTotal[];
  topSubscriptions: TopSubscription[];
  shockInsights: ShockInsight[];
  personality: Personality;
  moneyLeaks: MoneyLeak[];
  chart12mo: MonthBucket[];
  lastScannedAt: string | null;
};

export function InsightsHero({
  burn,
  aiSpend,
  categories,
  topSubscriptions,
  shockInsights,
  personality,
  moneyLeaks,
  chart12mo,
  lastScannedAt,
}: InsightsHeroProps) {
  const hasSubs = burn.total_active_count > 0;
  if (!hasSubs) return null;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ─── 1. IDENTITY + MONTHLY UPKEEP ROW ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        {/* LEFT: Identity card preview + share buttons */}
        <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6 animate-fadeUp">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Your identity card
          </div>
          <div className="mt-1 text-[13px] text-ink-body">
            A snapshot of your subscription self. Share it anywhere.
          </div>

          <a
            href="/api/share-card/identity"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-4 rounded-2xl overflow-hidden border border-hairline bg-ink transition hover:opacity-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/share-card/identity"
              alt="Your subscription identity card"
              className="w-full h-auto block"
              loading="eager"
            />
          </a>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <div className="font-display text-[18px] md:text-[22px] font-bold tracking-[-0.02em] text-ink leading-tight">
                {personality.label}
              </div>
              <div className="mt-0.5 text-[13px] md:text-[14px] text-ink-body">
                {personality.sub}
              </div>
            </div>
            <ShareButtons
              shareType="identity"
              shareText={`I'm "${personality.label}" — ${fmtCents(burn.monthly_cents, { withCents: false })}/mo on subscriptions. What's yours?`}
            />
          </div>
        </div>

        {/* RIGHT: Monthly upkeep + chart + donut + re-scan */}
        <MonthlyUpkeepCard
          totalMonthlyCents={burn.total_monthly_cents}
          totalYearlyCents={burn.total_yearly_cents}
          totalActiveCount={burn.total_active_count}
          chart12mo={chart12mo}
          categories={categories}
          lastScannedAt={lastScannedAt}
        />
      </div>

      {/* ─── ACTIVE LEARNING: uncertain candidates ────────────────── */}
      <UncertainPromptCards />

      {/* ─── 2. STATS ROW ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <StatCard
          eyebrow="AI stack"
          big={
            aiSpend.subscription_count === 0
              ? "$0/mo"
              : `${fmtCents(aiSpend.monthly_cents)}/mo`
          }
          detail={
            aiSpend.subscription_count === 0
              ? "No AI subscriptions detected"
              : `${aiSpend.subscription_count} tool${aiSpend.subscription_count === 1 ? "" : "s"} · ${fmtCents(aiSpend.yearly_cents, { withCents: false })}/yr`
          }
          accent="emerald"
        />
        <StatCard
          eyebrow="Biggest sub"
          big={
            topSubscriptions[0]
              ? `${fmtCents(topSubscriptions[0].monthly_cents)}/mo`
              : "—"
          }
          detail={topSubscriptions[0]?.merchant_name ?? "Nothing detected"}
          accent="orange"
        />
        <StatCard
          eyebrow="Money leaks"
          big={String(moneyLeaks.length)}
          detail={
            moneyLeaks.length === 0
              ? "Nothing flagged"
              : `${moneyLeaks.filter((l) => l.severity === "high").length} high · ${moneyLeaks.filter((l) => l.severity === "medium").length} medium`
          }
          accent="rose"
        />
      </div>

      {/* ─── 3. MORE SHARE CARDS ──────────────────────────────────── */}
      <div className="animate-fadeUp" style={{ animationDelay: "0.05s" }}>
        <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-3">
          More share cards
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <ShareCardThumb
            type="monthly_burn"
            label="Monthly burn"
            shareText={`I spend ${fmtCents(burn.monthly_cents, { withCents: false })}/mo on subscriptions.`}
          />
          <ShareCardThumb
            type="yearly_total"
            label="Yearly spend"
            shareText={`I've spent ${fmtCents(burn.ledger_yearly_cents > 0 ? burn.ledger_yearly_cents : burn.yearly_cents, { withCents: false })} on subscriptions this year.`}
          />
          {aiSpend.subscription_count > 0 && (
            <ShareCardThumb
              type="ai_stack"
              label="AI stack"
              shareText={`My AI stack costs ${fmtCents(aiSpend.monthly_cents, { withCents: false })}/mo.`}
            />
          )}
        </div>
      </div>

      {/* ─── 4. WHAT WE NOTICED ───────────────────────────────────── */}
      {(shockInsights.length > 0 || moneyLeaks.length > 0) && (
        <div
          className="rounded-2xl border border-hairline bg-surface p-5 md:p-8 animate-fadeUp"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-4">
            What we noticed
          </div>
          <div className="space-y-3 md:space-y-4">
            {shockInsights.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-brand shrink-0" />
                <div className="min-w-0">
                  <div className="text-[14px] md:text-[15px] font-medium text-ink leading-snug">
                    {s.headline}
                  </div>
                  <div className="mt-0.5 text-[12px] md:text-[13px] text-ink-body leading-relaxed">
                    {s.detail}
                  </div>
                </div>
              </div>
            ))}
            {moneyLeaks.slice(0, 4).map((leak) => (
              <div key={leak.id} className="flex items-start gap-3">
                <span
                  className={[
                    "mt-1.5 inline-block h-2 w-2 rounded-full shrink-0",
                    leak.severity === "high"
                      ? "bg-danger"
                      : leak.severity === "medium"
                      ? "bg-accent"
                      : "bg-ink-muted",
                  ].join(" ")}
                />
                <div className="min-w-0">
                  <div className="text-[14px] md:text-[15px] font-medium text-ink leading-snug">
                    {leak.headline}
                  </div>
                  <div className="mt-0.5 text-[12px] md:text-[13px] text-ink-body leading-relaxed">
                    {leak.detail}
                  </div>
                </div>
              </div>
            ))}
            {moneyLeaks.length > 4 && (
              <div className="text-[12px] md:text-[13px] text-ink-muted pl-5">
                + {moneyLeaks.length - 4} more flagged in your subscription
                list below
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Smaller share-card thumbnail (compact social buttons inline)
// ───────────────────────────────────────────────────────────────────

function ShareCardThumb({
  type,
  label,
  shareText,
}: {
  type: string;
  label: string;
  shareText: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
      <a
        href={`/api/share-card/${type}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-square bg-ink relative overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/share-card/${type}`}
          alt={`${label} share card`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </a>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="text-[13px] md:text-[14px] font-medium text-ink truncate">
          {label}
        </div>
        <ShareButtons shareType={type} shareText={shareText} compact />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Generic stat card
// ───────────────────────────────────────────────────────────────────

function StatCard({
  eyebrow,
  big,
  detail,
  accent,
}: {
  eyebrow: string;
  big: string;
  detail: string;
  accent: "emerald" | "orange" | "rose";
}) {
  const dotColor =
    accent === "emerald"
      ? "bg-brand"
      : accent === "orange"
      ? "bg-accent"
      : "bg-danger";
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-4 py-4 md:px-6 md:py-6 animate-fadeUp">
      <div className="flex items-center gap-2 text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {eyebrow}
      </div>
      <div className="mt-2 font-display text-[22px] sm:text-[26px] md:text-[30px] font-bold tracking-[-0.02em] text-ink tabular-nums leading-tight">
        {big}
      </div>
      <div className="mt-1 text-[12px] md:text-[13px] text-ink-body leading-relaxed">
        {detail}
      </div>
    </div>
  );
}
