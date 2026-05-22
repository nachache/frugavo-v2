// InsightsHero — the new dashboard hero that turns Frugavo from
// "subscription detection" into "emotional financial insight."
//
// Server component. Receives a pre-computed insights payload (server-
// side from lib/insights, lib/personality, lib/money-leaks). No client
// JS is needed for this to render.
//
// Visual language follows the existing Frugavo design system:
//   canvas: #FAF8F4 (warm off-white)
//   ink:    #0A0A0A
//   brand:  emerald
//   accent: orange
// Hero cards are full-width on mobile, two-column at md, with the big
// numbers reading like a magazine cover — not a spreadsheet.

import type {
  BurnRate,
  AiSpend,
  CategoryTotal,
  TopSubscription,
  ShockInsight,
} from "@/lib/insights";
import type { Personality } from "@/lib/personality";
import type { MoneyLeak } from "@/lib/money-leaks";

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
};

export function InsightsHero({
  burn,
  aiSpend,
  topSubscriptions,
  shockInsights,
  personality,
  moneyLeaks,
}: InsightsHeroProps) {
  const hasSubs = burn.active_subscription_count > 0;
  if (!hasSubs && burn.other_recurring_count === 0) {
    // Empty state — let the existing list render its own empty UI.
    return null;
  }

  const topShock = shockInsights.slice(0, 3);
  const topLeaks = moneyLeaks.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Personality identity */}
      <div className="rounded-2xl border border-hairline bg-surface px-6 py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
          Your subscription personality
        </div>
        <div className="mt-2 font-display text-[28px] md:text-[36px] font-bold tracking-[-0.02em] text-ink leading-tight">
          {personality.label}
        </div>
        <div className="mt-1.5 text-[14px] md:text-[15px] text-ink-body leading-relaxed">
          {personality.sub}
        </div>
      </div>

      {/* Burn — the emotional anchor */}
      <div className="rounded-2xl border border-hairline bg-ink text-canvas px-6 py-7 md:px-10 md:py-10 overflow-hidden relative">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand opacity-20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-canvas/60">
            You spend
          </div>
          <div className="mt-3 font-display font-bold tracking-[-0.04em] leading-[0.95] text-[64px] md:text-[96px] tabular-nums">
            {fmtCents(burn.monthly_cents, { withCents: false })}
            <span className="text-[36px] md:text-[44px] font-medium text-canvas/60">
              /mo
            </span>
          </div>
          <div className="mt-3 text-[16px] md:text-[18px] text-canvas/80">
            {fmtCents(burn.yearly_cents, { withCents: false })}/yr · across{" "}
            {burn.active_subscription_count} subscription
            {burn.active_subscription_count === 1 ? "" : "s"}
          </div>

          {burn.ledger_yearly_cents > 0 && (
            <div className="mt-1 text-[13px] text-canvas/50">
              {fmtCents(burn.ledger_yearly_cents, { withCents: false })}{" "}
              actually paid over the last 12 months
            </div>
          )}

          {burn.other_recurring_count > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-canvas/15 bg-canvas/5 px-4 py-2 text-[13px] text-canvas/80">
              <span>+ {fmtCents(burn.other_recurring_monthly_cents, { withCents: false })}/mo</span>
              <span className="text-canvas/40">in other recurring</span>
              <span className="text-canvas/40">
                · {burn.other_recurring_count} item
                {burn.other_recurring_count === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AI stack */}
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
              : `${aiSpend.subscription_count} AI tool${aiSpend.subscription_count === 1 ? "" : "s"} running · ${fmtCents(aiSpend.yearly_cents, { withCents: false })}/yr`
          }
          accent="emerald"
        />
        <StatCard
          eyebrow="Top subscription"
          big={
            topSubscriptions[0]
              ? `${fmtCents(topSubscriptions[0].monthly_cents)}/mo`
              : "—"
          }
          detail={
            topSubscriptions[0]?.merchant_name ?? "Nothing detected yet"
          }
          accent="orange"
        />
        <StatCard
          eyebrow="Hidden leaks"
          big={String(moneyLeaks.length)}
          detail={
            moneyLeaks.length === 0
              ? "Nothing flagged"
              : `${moneyLeaks.filter((l) => l.severity === "high").length} high · ${moneyLeaks.filter((l) => l.severity === "medium").length} medium`
          }
          accent="rose"
        />
      </div>

      {/* Shock insights */}
      {topShock.length > 0 && (
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-3">
            This shocked us
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topShock.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-hairline bg-surface p-5 md:p-6"
              >
                <div className="font-display text-[18px] md:text-[20px] font-bold tracking-[-0.01em] text-ink leading-snug">
                  {s.headline}
                </div>
                <div className="mt-2 text-[14px] text-ink-body leading-relaxed">
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Money leaks */}
      {topLeaks.length > 0 && (
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted mb-3">
            Money leaks
          </div>
          <div className="space-y-2">
            {topLeaks.map((leak) => (
              <div
                key={leak.id}
                className="rounded-xl border border-hairline bg-surface p-4 md:p-5 flex items-start gap-3"
              >
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
                  <div className="text-[15px] font-medium text-ink leading-snug">
                    {leak.headline}
                  </div>
                  <div className="mt-1 text-[13px] text-ink-body leading-relaxed">
                    {leak.detail}
                  </div>
                </div>
              </div>
            ))}
            {moneyLeaks.length > topLeaks.length && (
              <div className="text-[13px] text-ink-muted pl-5">
                + {moneyLeaks.length - topLeaks.length} more leak
                {moneyLeaks.length - topLeaks.length === 1 ? "" : "s"} below the
                fold
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="rounded-2xl border border-hairline bg-surface px-5 py-5 md:px-6 md:py-6">
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {eyebrow}
      </div>
      <div className="mt-2 font-display text-[28px] md:text-[32px] font-bold tracking-[-0.02em] text-ink tabular-nums leading-tight">
        {big}
      </div>
      <div className="mt-1 text-[13px] text-ink-body leading-relaxed">
        {detail}
      </div>
    </div>
  );
}
