// InsightsHero — the new dashboard hero. Tightened layout: one
// dominant burn card with the personality + share affordance inside,
// a single stats row, visible share-card thumbnails, and the
// shock/leaks content folded into a single insights strip below.
//
// Visual hierarchy:
//   1. Burn hero (dominant, dark, magazine-cover styling)
//   2. Stats row (3 small cards)
//   3. Share cards (3 visible thumbnails — the social object)
//   4. Insights strip (shock + leaks, compact list)
//
// Server component. No client JS needed.

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
  if (!hasSubs && burn.other_recurring_count === 0) return null;

  // Decide which share cards make sense given the data.
  type ShareCard = { type: string; label: string };
  const shareCards: ShareCard[] = [
    { type: "monthly_burn", label: "Monthly burn" },
    { type: "yearly_total", label: "Yearly spend" },
  ];
  if (aiSpend.subscription_count > 0) {
    shareCards.push({ type: "ai_stack", label: "AI stack" });
  }

  return (
    <div className="space-y-8">
      {/* ─── 1. BURN HERO ─────────────────────────────────────────── */}
      <div className="rounded-3xl border border-hairline bg-ink text-canvas px-6 py-8 md:px-12 md:py-12 overflow-hidden relative">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-accent opacity-10 blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Personality chip */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-canvas/15 bg-canvas/5 px-3 py-1 text-[12px] font-medium text-canvas/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
              {personality.label}
            </span>
          </div>

          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-canvas/50">
            You spend
          </div>
          <div className="mt-2 font-display font-bold tracking-[-0.04em] leading-[0.95] text-[72px] md:text-[112px] tabular-nums">
            {fmtCents(burn.monthly_cents, { withCents: false })}
            <span className="text-[36px] md:text-[48px] font-medium text-canvas/50">
              /mo
            </span>
          </div>
          <div className="mt-4 text-[16px] md:text-[18px] text-canvas/80">
            {fmtCents(burn.yearly_cents, { withCents: false })} a year, across{" "}
            {burn.active_subscription_count} subscription
            {burn.active_subscription_count === 1 ? "" : "s"}.
          </div>
          <div className="mt-1 text-[14px] text-canvas/50">
            {personality.sub}
          </div>

          {burn.other_recurring_count > 0 && (
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-canvas/15 bg-canvas/5 px-4 py-2 text-[13px] text-canvas/70">
              <span className="text-canvas/90 font-medium">
                + {fmtCents(burn.other_recurring_monthly_cents, { withCents: false })}/mo
              </span>
              <span className="text-canvas/40">in other recurring</span>
              <span className="text-canvas/40">
                ({burn.other_recurring_count} item
                {burn.other_recurring_count === 1 ? "" : "s"})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. STATS ROW ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              : `${aiSpend.subscription_count} AI tool${aiSpend.subscription_count === 1 ? "" : "s"} · ${fmtCents(aiSpend.yearly_cents, { withCents: false })}/yr`
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

      {/* ─── 3. SHARE CARDS (visible) ─────────────────────────────── */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Share your numbers
            </div>
            <div className="mt-1 text-[14px] text-ink-body">
              Tap any card to open it in a new tab. Save the image. Post it
              anywhere.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shareCards.map((card) => (
            <a
              key={card.type}
              href={`/api/share-card/${card.type}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-hairline bg-surface overflow-hidden transition hover:shadow-soft"
            >
              <div className="aspect-square bg-ink relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/share-card/${card.type}`}
                  alt={`${card.label} share card`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-[14px] font-medium text-ink">
                  {card.label}
                </div>
                <div className="text-[12px] text-ink-muted group-hover:text-ink transition">
                  Open →
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ─── 4. INSIGHTS STRIP (shock + leaks, compact) ───────────── */}
      {(shockInsights.length > 0 || moneyLeaks.length > 0) && (
        <div className="rounded-2xl border border-hairline bg-surface p-6 md:p-8">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-5">
            What we noticed
          </div>
          <div className="space-y-4">
            {shockInsights.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-brand shrink-0" />
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink leading-snug">
                    {s.headline}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-body leading-relaxed">
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
                  <div className="text-[15px] font-medium text-ink leading-snug">
                    {leak.headline}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-body leading-relaxed">
                    {leak.detail}
                  </div>
                </div>
              </div>
            ))}
            {moneyLeaks.length > 4 && (
              <div className="text-[13px] text-ink-muted pl-5">
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
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {eyebrow}
      </div>
      <div className="mt-2 font-display text-[26px] md:text-[30px] font-bold tracking-[-0.02em] text-ink tabular-nums leading-tight">
        {big}
      </div>
      <div className="mt-1 text-[13px] text-ink-body leading-relaxed">
        {detail}
      </div>
    </div>
  );
}
