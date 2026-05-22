// InsightsHero v2 — first-glance layout:
//
//   1. Burn hero (dominant, dark) — big monthly number + personality
//   2. Chart row — 12-month real spend bars + category donut
//   3. Identity card preview + share to social media
//   4. Stats row — AI / top sub / leaks count
//   5. Standalone share cards (monthly / yearly / AI) with social buttons
//   6. What we noticed — compact insights strip
//
// All sections are mobile-first: stack vertically on small screens,
// reflow on md+. Big numbers auto-scale via clamp() and breakpoint
// font sizes.
//
// Server component. No client JS for the layout itself; the share
// buttons are <a target="_blank"> intent links plus a small inline
// client island for "copy link" handling.

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
}: InsightsHeroProps) {
  const hasSubs = burn.active_subscription_count > 0;
  if (!hasSubs && burn.other_recurring_count === 0) return null;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ─── 1. BURN HERO ─────────────────────────────────────────── */}
      <div className="rounded-3xl border border-hairline bg-ink text-canvas px-5 py-7 md:px-12 md:py-12 overflow-hidden relative">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-accent opacity-10 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-canvas/15 bg-canvas/5 px-3 py-1 text-[12px] font-medium text-canvas/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
              {personality.label}
            </span>
          </div>

          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-canvas/50">
            You spend
          </div>
          <div className="mt-2 font-display font-bold tracking-[-0.04em] leading-[0.95] text-[56px] sm:text-[80px] md:text-[112px] tabular-nums break-words">
            {fmtCents(burn.monthly_cents, { withCents: false })}
            <span className="text-[28px] sm:text-[36px] md:text-[48px] font-medium text-canvas/50">
              /mo
            </span>
          </div>
          <div className="mt-3 md:mt-4 text-[14px] sm:text-[16px] md:text-[18px] text-canvas/80">
            {fmtCents(burn.yearly_cents, { withCents: false })} a year, across{" "}
            {burn.active_subscription_count} subscription
            {burn.active_subscription_count === 1 ? "" : "s"}.
          </div>
          <div className="mt-1 text-[13px] md:text-[14px] text-canvas/50">
            {personality.sub}
          </div>

          {burn.other_recurring_count > 0 && (
            <div className="mt-6 md:mt-8 inline-flex flex-wrap items-center gap-1.5 md:gap-2 rounded-full border border-canvas/15 bg-canvas/5 px-3 md:px-4 py-1.5 md:py-2 text-[12px] md:text-[13px] text-canvas/70">
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

      {/* ─── 2. CHART + DONUT ROW ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-hairline bg-surface p-5 md:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
                12-month spend
              </div>
              <div className="mt-1 text-[13px] text-ink-body">
                Real charges from your accounts
              </div>
            </div>
          </div>
          <ChartBars data={chart12mo} />
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            By category
          </div>
          <div className="mt-1 text-[13px] text-ink-body mb-4">
            Where your subscription money goes
          </div>
          <CategoryDonut categories={categories} subOnly />
        </div>
      </div>

      {/* ─── 3. IDENTITY CARD + SOCIAL SHARE ──────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Your identity card
            </div>
            <div className="mt-1 text-[13px] text-ink-body">
              A snapshot of your subscription self. Share it anywhere.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
          {/* Live preview thumbnail */}
          <a
            href="/api/share-card/identity"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border border-hairline bg-ink"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/share-card/identity"
              alt="Your subscription identity card"
              className="w-full h-auto block"
            />
          </a>

          {/* Share controls */}
          <div className="space-y-4">
            <div>
              <div className="font-display text-[22px] md:text-[26px] font-bold tracking-[-0.02em] text-ink leading-tight">
                {personality.label}
              </div>
              <div className="mt-1 text-[14px] text-ink-body">
                {personality.sub}
              </div>
            </div>
            <ShareButtons
              shareType="identity"
              shareText={`I'm "${personality.label}" — ${fmtCents(burn.monthly_cents, { withCents: false })}/mo on subscriptions. What's yours?`}
            />
          </div>
        </div>
      </div>

      {/* ─── 4. STATS ROW ─────────────────────────────────────────── */}
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

      {/* ─── 5. MORE SHARE CARDS ──────────────────────────────────── */}
      <div>
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

      {/* ─── 6. WHAT WE NOTICED ───────────────────────────────────── */}
      {(shockInsights.length > 0 || moneyLeaks.length > 0) && (
        <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-8">
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
// 12-month bar chart (pure SVG, mobile-friendly)
// ───────────────────────────────────────────────────────────────────

function ChartBars({ data }: { data: MonthBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="text-[13px] text-ink-muted py-8 text-center">
        No charge history yet. Re-scan to populate.
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.spend_cents));
  const W = 100; // viewBox width % per bar slot
  const barWidth = W / data.length;
  return (
    <div>
      <svg
        viewBox={`0 0 100 32`}
        preserveAspectRatio="none"
        className="w-full h-32 md:h-40"
        aria-label="12-month spend chart"
      >
        {data.map((d, i) => {
          const h = (d.spend_cents / max) * 28;
          const x = i * barWidth + barWidth * 0.18;
          const w = barWidth * 0.64;
          const y = 30 - h;
          return (
            <rect
              key={d.month}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="0.4"
              fill="currentColor"
              className="text-brand opacity-90"
            />
          );
        })}
        <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" strokeWidth="0.2" className="text-hairline" />
      </svg>
      <div className="mt-2 grid grid-cols-12 text-[10px] md:text-[11px] text-ink-muted tabular-nums">
        {data.map((d, i) => {
          const monthAbbr = new Date(d.month + "-01").toLocaleDateString("en-US", {
            month: "short",
          });
          // On mobile only show every other label.
          const showOnMobile = i % 2 === 0;
          return (
            <div
              key={d.month}
              className={`text-center ${showOnMobile ? "" : "hidden md:block"}`}
            >
              {monthAbbr}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Category donut (top categories, SVG)
// ───────────────────────────────────────────────────────────────────

function CategoryDonut({
  categories,
  subOnly = true,
}: {
  categories: CategoryTotal[];
  subOnly?: boolean;
}) {
  // Allow only subscription-like categories so the donut matches the
  // burn hero number. The dashboard splits the "other recurring" bucket
  // out separately.
  const SUB_CATS = new Set([
    "streaming",
    "software",
    "news",
    "fitness",
    "food_delivery",
    "cloud_storage",
    "gaming",
    "telecom",
    "phone_internet",
    "utilities",
    "education",
    "insurance",
  ]);
  const filtered = subOnly
    ? categories.filter((c) => SUB_CATS.has(c.category))
    : categories;
  const total = filtered.reduce((acc, c) => acc + c.monthly_cents, 0);
  if (total === 0) {
    return (
      <div className="text-[13px] text-ink-muted py-8 text-center">
        No categorized spend yet.
      </div>
    );
  }
  // Top 6 plus "other" rollup.
  const top = filtered.slice(0, 6);
  const otherRest = filtered.slice(6).reduce((a, c) => a + c.monthly_cents, 0);
  if (otherRest > 0) {
    top.push({
      category: "other_sub",
      monthly_cents: otherRest,
      yearly_cents: otherRest * 12,
      subscription_count: 0,
    });
  }
  // Color palette — emerald spectrum.
  const COLORS = [
    "#047857",
    "#10b981",
    "#34d399",
    "#6ee7b7",
    "#ea580c",
    "#f97316",
    "#fbbf24",
  ];

  // Build SVG donut paths.
  const cx = 100;
  const cy = 100;
  const r = 80;
  const stroke = 28;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center md:items-stretch md:flex-row gap-4 md:gap-5">
      <svg
        viewBox="0 0 200 200"
        className="w-44 h-44 md:w-40 md:h-40 shrink-0"
        aria-label="Category breakdown"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#f5f5f5"
          strokeWidth={stroke}
        />
        {top.map((c, i) => {
          const fraction = c.monthly_cents / total;
          const dash = fraction * circumference;
          const seg = (
            <circle
              key={c.category}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return seg;
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="12"
          fill="#737373"
          fontWeight="500"
        >
          per month
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="22"
          fontWeight="800"
          fill="#0a0a0a"
        >
          ${Math.round(total / 100).toLocaleString("en-US")}
        </text>
      </svg>
      <div className="flex-1 space-y-1.5 min-w-0">
        {top.map((c, i) => {
          const pct = Math.round((c.monthly_cents / total) * 100);
          return (
            <div
              key={c.category}
              className="flex items-center gap-2 text-[12px] md:text-[13px]"
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-ink truncate flex-1 min-w-0">
                {categoryLabel(c.category)}
              </span>
              <span className="text-ink-muted tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    streaming: "Streaming",
    software: "Software",
    news: "News",
    fitness: "Fitness",
    food_delivery: "Food delivery",
    cloud_storage: "Cloud storage",
    gaming: "Gaming",
    telecom: "Telecom",
    phone_internet: "Phone & internet",
    utilities: "Utilities",
    education: "Education",
    insurance: "Insurance",
    other: "Other",
    other_sub: "Other categories",
    bank_fees: "Bank fees",
  };
  return map[cat] ?? cat;
}

// ───────────────────────────────────────────────────────────────────
// Smaller share-card thumbnail + social share buttons.
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
// Generic stat card.
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
    <div className="rounded-2xl border border-hairline bg-surface px-4 py-4 md:px-6 md:py-6">
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
