"use client";

// OverviewCard v2 — single hero block that absorbed the "What we
// noticed" insights surface per IA refactor v2 #3 + #5.
//
// Desktop layout:
//   ┌─────────────────────────────────────────────────────────────┐
//   │  [stats column]   [donut + legend]   [insights list]        │
//   │  [────────── full-width 12-month soft sparkline ─────────]  │
//   └─────────────────────────────────────────────────────────────┘
//
// Mobile: stacks. Donut grows from 140px → 240px. Sparkline uses a
// smooth Catmull-Rom-like curve, 1.5px stroke, 20% gradient fill,
// no dots unless hovered. Donut slices fan in on mount and respond
// to hover with thickening + center label update.

import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "framer-motion";
import Link from "next/link";
import type {
  CategoryTotal,
  MonthBucket,
  AiSpend,
  ShockInsight,
  TopSubscription,
} from "@/lib/insights";
import type { MoneyLeak } from "@/lib/money-leaks";
import type { ConcentrationInsight } from "@/lib/intelligence/concentration";
import { MerchantLogo } from "./merchant-logo";

type Props = {
  monthly: {
    total_cents: number;
    total_count: number;
    sub_only_cents: number;
    sub_only_count: number;
    other_recurring_cents: number;
    other_recurring_count: number;
  };
  yearly: {
    total_cents: number;
    ledger_actual_cents: number;
  };
  chart12mo: MonthBucket[];
  categories: CategoryTotal[];
  // Merged insights inputs:
  aiSpend: AiSpend;
  topSubscription: (TopSubscription & { domain?: string | null }) | null;
  moneyLeaks: MoneyLeak[];
  shockInsights: ShockInsight[];
  // Mode controls which tier this card is rendering for. The caller
  // passes the right `monthly` / `categories` / `topSubscription` for
  // the mode; this card only adjusts labels and what optional panels
  // it shows (e.g. AI stack panel hides on Bills mode).
  mode?: "subscriptions" | "bills" | "combined";
  // Optional roster — when provided, clicking a donut slice reveals
  // the subs in that category. Each item: { merchant_name, category,
  // monthly_cents }. The OverviewCard filters by category client-side.
  allSubscriptions?: {
    merchant_name: string;
    category: string;
    monthly_cents: number;
  }[];
  // Interpretation line that sits under the donut: instead of the
  // generic "5 categories" the donut center used to print, this is
  // a one-line meaning ("Telecom dominates", "Mostly essentials",
  // "Spending diversified"). Computed once server-side.
  concentration?: ConcentrationInsight | null;
};

const DONUT_COLORS = [
  "var(--brand-green)",
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#ea580c",
  "#f97316",
  "#fbbf24",
];

function fmtBig(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtRound(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

export function OverviewCard({
  monthly,
  yearly,
  chart12mo,
  categories,
  aiSpend,
  topSubscription,
  moneyLeaks,
  shockInsights,
  mode = "combined",
  allSubscriptions = [],
  concentration = null,
}: Props) {
  // Donut click → category drill-down. When set, a list of subs
  // matching that category appears below the donut/legend.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const eyebrowLabel =
    mode === "subscriptions"
      ? "Monthly subscriptions"
      : mode === "bills"
        ? "Monthly bills"
        : "Monthly recurring";
  const itemNoun =
    mode === "bills" ? "bills" : mode === "subscriptions" ? "subscriptions" : "items";
  // Scroll-triggered animation gate. Animations (counter spin, donut
  // fan-in) start only when the card is at least 100px into view, so
  // the user actually witnesses them instead of missing the moment
  // because the card animated before they scrolled to it.
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-100px" });
  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-hairline bg-surface p-4 md:p-7 animate-fadeUp"
    >
      {/* Top row: stats | donut | insights */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_280px_1.2fr] gap-5 md:gap-6 lg:gap-8 items-start">
        {/* COL 1 — stats.
            Per Constraint #7 / "perceived correctness over inflation":
            removed the speculative "≈ $X over 5 years" extrapolation —
            multiplying today's monthly by 60 made the number feel
            invented. Annual is grounded in the same monthly × 12 the
            user can do in their head; that stays. */}
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {eyebrowLabel}
          </div>
          <div className="mt-2 font-display font-bold tracking-[-0.03em] leading-[1] text-[40px] sm:text-[52px] md:text-[60px] tabular-nums break-words text-brand">
            <CountUp targetCents={monthly.total_cents} start={inView} />
            <span className="text-[20px] sm:text-[24px] md:text-[26px] font-medium text-ink-muted">
              /mo
            </span>
          </div>
          <div className="mt-3 text-[14px] md:text-[15px] text-ink-body">
            {fmtRound(yearly.total_cents)}/yr · {monthly.total_count}{" "}
            {monthly.total_count === 1 ? itemNoun.replace(/s$/, "") : itemNoun}
          </div>
          {mode === "combined" && monthly.other_recurring_count > 0 && (
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-hairline bg-canvas/40 px-3 py-1.5 text-[12px] text-ink-body">
              <span className="font-medium text-ink">{fmtRound(monthly.sub_only_cents)}</span>
              <span className="text-ink-muted">{monthly.sub_only_count === 1 ? "sub" : "subs"}</span>
              <span className="text-ink-muted/40">+</span>
              <span className="font-medium text-ink">{fmtRound(monthly.other_recurring_cents)}</span>
              <span className="text-ink-muted">{monthly.other_recurring_count === 1 ? "bill" : "bills"}</span>
            </div>
          )}
        </div>

        {/* COL 2 — donut */}
        <div className="min-w-0 flex flex-col items-center gap-3">
          <Donut
            categories={categories}
            start={inView}
            activeCategory={activeCategory}
            onSliceClick={(c) =>
              setActiveCategory((prev) => (prev === c ? null : c))
            }
          />
          {/* Concentration interpretation — replaces the generic
              "5 categories" SaaS placeholder. One headline, one
              short fact, tone-coded color rail. Sits between the
              legend and the drill-down so it's always visible
              without competing with the slice click affordance. */}
          {concentration && (
            <ConcentrationLine insight={concentration} />
          )}
          {/* Drill-down list — shows the subs in the clicked
              category. Click the same slice again to close. */}
          {activeCategory && (
            <DrillDown
              category={activeCategory}
              subs={allSubscriptions}
              onClose={() => setActiveCategory(null)}
            />
          )}
        </div>

        {/* COL 3 — insights merged in. Wrapped in a softer
            sub-card visual to break the density. Each section
            (stats / donut / insights) now reads as its own chunk
            instead of one wall of numbers. */}
        <div className="min-w-0 rounded-xl bg-canvas/40 border border-hairline/60 p-4 md:p-5">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-3">
            What we noticed
          </div>
          <InsightsColumn
            aiSpend={aiSpend}
            topSubscription={topSubscription}
            moneyLeaks={moneyLeaks}
            shockInsights={shockInsights}
          />
        </div>
      </div>

      {/* Soft divider + sparkline gets its own visual chunk. Extra
          top margin + a hairline rule makes it feel like a separate
          "and here's the trend" section rather than another row of
          the same wall. Eyebrow span is dynamic (chartEyebrow) so
          users with 1-11 months of Plaid history see "Since {Mon}"
          instead of a 12-month label that contradicts the chart. */}
      <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-hairline/70">
        <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
          {chartEyebrow(chart12mo)}
        </div>
        <Sparkline data={chart12mo} />
      </div>
    </div>
  );
}

// Dynamic eyebrow that reflects the chart's actual span. Matches the
// helper in monthly-upkeep-card.tsx — kept duplicated rather than
// shared because the rest of these chart components are intentionally
// self-contained.
function chartEyebrow(series: MonthBucket[]): string {
  if (series.length >= 12) return "Last 12 months";
  if (series.length <= 1) return "This month";
  const first = series[0]?.month;
  if (!first) return `Last ${series.length} months`;
  const label = new Date(first + "-01").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `Since ${label}`;
}

// ─── Count-up ──────────────────────────────────────────────────────

function CountUp({
  targetCents,
  start = true,
}: {
  targetCents: number;
  // Gate the animation on visibility. Defaults to true for backward
  // compat with any caller that doesn't pass it. When false, the
  // number renders as 0 until start flips true.
  start?: boolean;
}) {
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!start) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(targetCents);
      return;
    }
    let raf = 0;
    const duration = 1100;
    const startTime = performance.now();
    startRef.current = startTime;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(targetCents * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetCents, start]);
  // Hero number is shown as whole dollars — $163.91 → $164. The
  // cents tend to look noisy on a 60-pixel display ($163.91/mo
  // visually reads less clean than $164/mo, and the precision is
  // false anyway — monthly cost shifts up/down with each new charge).
  // Per-row amounts in the Action Center keep their cents.
  return <>{fmtRound(shown)}</>;
}

// ─── Sparkline (smooth curve, soft fill) ───────────────────────────

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  // Catmull-Rom → cubic Bezier conversion. Produces a calm,
  // non-overshooting curve. Tension 0.5 gives a gentle bow.
  const t = 0.5;
  const out: string[] = [`M ${points[0].x},${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * t;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * t;
    out.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return out.join(" ");
}

function Sparkline({ data: dataRaw }: { data: MonthBucket[] }) {
  const W = 1000;
  const H = 240;
  const PAD = 8;
  // Drop the trailing point when it represents the current month and
  // we're not yet far enough into it for the partial total to look
  // honest. The old chart ended with a dramatic crash to zero in the
  // current month (e.g. May 1st showing $0) which read as "did I
  // lose my subscriptions?". Cutoff: keep the partial month only if
  // ≥ 80% of the way through; otherwise hide it.
  const data = useMemo(() => {
    if (dataRaw.length === 0) return dataRaw;
    const last = dataRaw[dataRaw.length - 1];
    const now = new Date();
    const thisMonth =
      now.toISOString().slice(0, 7); // YYYY-MM
    if (last.month === thisMonth) {
      const dom = now.getDate();
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      if (dom / daysInMonth < 0.8) {
        return dataRaw.slice(0, -1);
      }
    }
    return dataRaw;
  }, [dataRaw]);
  const max = Math.max(1, ...data.map((d) => d.spend_cents));

  const points = useMemo(() => {
    if (data.length === 0) return [];
    const stepX = (W - 2 * PAD) / Math.max(1, data.length - 1);
    return data.map((d, i) => ({
      x: PAD + i * stepX,
      y: H - PAD - (d.spend_cents / max) * (H - 2 * PAD),
      ...d,
    }));
  }, [data, max]);

  const pathD = useMemo(() => smoothPath(points), [points]);
  const fillD = useMemo(() => {
    if (points.length === 0) return "";
    const line = smoothPath(points);
    return `${line} L ${points[points.length - 1].x},${H - PAD} L ${points[0].x},${H - PAD} Z`;
  }, [points]);

  const [hover, setHover] = useState<number | null>(null);
  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let dx = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - relX);
      if (d < dx) {
        dx = d;
        best = i;
      }
    }
    setHover(best);
  }

  if (data.length === 0) {
    return (
      <div className="h-24 md:h-28 flex items-center justify-center text-[13px] text-ink-muted">
        No charge history yet.
      </div>
    );
  }

  const h = hover !== null ? points[hover] : null;
  // Stroke-dasharray length for draw-in animation. Pick a generous
  // length; dasharray clamps cleanly.
  const PATH_LENGTH = 2800;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-24 md:h-32 touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={handleMove}
      >
        <defs>
          {/* Richer gradient — three stops give the area more depth
              without losing the airy feel. */}
          <linearGradient id="ovsk-fill-v2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.28" />
            <stop offset="60%" stopColor="var(--brand-green)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle horizontal baseline ladder — three faint lines at
            25/50/75% give the eye a sense of magnitude without
            shouting. preserveAspectRatio is none so we use percent
            positions on raw SVG coords. */}
        {[0.25, 0.5, 0.75].map((pct) => {
          const y = PAD + (H - 2 * PAD) * pct;
          return (
            <line
              key={pct}
              x1={PAD}
              x2={W - PAD}
              y1={y}
              y2={y}
              stroke="#0a0a0a"
              strokeOpacity="0.04"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        <path
          d={fillD}
          fill="url(#ovsk-fill-v2)"
          style={{ animation: "fadeIn 0.7s ease-out 0.6s both" }}
        />
        <path
          d={pathD}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PATH_LENGTH}
          strokeDashoffset={PATH_LENGTH}
          style={{
            animation: "sparkDraw 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards",
          }}
        />

        {/* End-of-line emphasis — small filled dot at the latest
            data point pulses gently to read as "this is now". */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="5"
            fill="var(--brand-green)"
            vectorEffect="non-scaling-stroke"
            style={{ animation: "sparkPulse 2.2s ease-in-out infinite" }}
          />
        )}

        {h && (
          <>
            <line
              x1={h.x}
              x2={h.x}
              y1={PAD}
              y2={H - PAD}
              stroke="#0a0a0a"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity="0.35"
            />
            <circle
              cx={h.x}
              cy={h.y}
              r="6"
              fill="#fafafa"
              stroke="var(--brand-green)"
              strokeWidth="2.8"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        <style>{`
          @keyframes sparkDraw { to { stroke-dashoffset: 0; } }
          @keyframes sparkPulse {
            0%, 100% { opacity: 1; r: 5; }
            50% { opacity: 0.55; r: 6.5; }
          }
        `}</style>
      </svg>
      {/* Month labels — absolute-positioned at the same x-percentage
          the SVG path uses, so labels and data points always align
          regardless of series length. Previous grid-cols-12 baked in
          a 12-column assumption that drifted out of sync when
          computeMonthlySpendSeries trimmed leading zero months,
          producing the "Mar / Apr / May clustered on the left while
          the line spans full width" bug. End labels translate to
          their edges to avoid clipping. */}
      <div className="relative mt-1.5 h-4 text-[10px] text-ink-muted tabular-nums">
        {data.map((d, i) => {
          const abbr = new Date(d.month + "-01").toLocaleDateString("en-US", { month: "short" });
          const n = data.length;
          // Density thinning: ≤6 show all, 7-12 every other (plus
          // first and last), >12 ~6 evenly spaced.
          let show: boolean;
          if (n <= 6) show = true;
          else if (n <= 12) show = i === 0 || i === n - 1 || i % 2 === 1;
          else show = i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0;
          if (!show) return null;

          const xPct =
            n === 1
              ? 50
              : ((PAD + (i * (W - 2 * PAD)) / (n - 1)) / W) * 100;
          const transform =
            i === 0
              ? "translateX(0)"
              : i === n - 1
              ? "translateX(-100%)"
              : "translateX(-50%)";

          return (
            <span
              key={d.month}
              className="absolute top-0 whitespace-nowrap"
              style={{ left: `${xPct}%`, transform }}
            >
              {abbr}
            </span>
          );
        })}
      </div>
      {h && (
        <div
          className="pointer-events-none absolute -top-1 -translate-y-full -translate-x-1/2 rounded-lg border border-ink/15 bg-ink text-canvas px-2.5 py-1.5 text-[12px] whitespace-nowrap z-10"
          style={{ left: `min(max(${(h.x / W) * 100}%, 60px), calc(100% - 60px))` }}
        >
          <div className="font-medium">
            {new Date(h.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div className="text-canvas/80 tabular-nums">{fmtBig(h.spend_cents)}</div>
        </div>
      )}
    </div>
  );
}

// ─── Donut (larger, hover-interactive) ─────────────────────────────

type DonutSlice = CategoryTotal & { pct: number; color: string };

// ─── Donut drill-down list ─────────────────────────────────────────
// Renders below the donut+legend when a slice is clicked. Lists
// every sub in that category with monthly amount, sorted desc.
function DrillDown({
  category,
  subs,
  onClose,
}: {
  category: string;
  subs: { merchant_name: string; category: string; monthly_cents: number }[];
  onClose: () => void;
}) {
  const matching = subs
    .filter((s) => s.category === category)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);
  if (matching.length === 0) return null;
  return (
    <div className="w-full max-w-[240px] mt-2 rounded-xl border border-hairline bg-canvas/40 p-3 animate-fadeUp">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          {prettyCategory(category)}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-ink-muted hover:text-ink transition"
          aria-label="Close category drill-down"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {matching.slice(0, 10).map((s) => (
          <li
            key={s.merchant_name}
            className="flex items-center justify-between gap-2 text-[12.5px]"
          >
            <span className="text-ink truncate min-w-0">{s.merchant_name}</span>
            <span className="text-ink-muted tabular-nums shrink-0">
              {fmtRound(s.monthly_cents)}/mo
            </span>
          </li>
        ))}
      </ul>
      {matching.length > 10 && (
        <div className="mt-2 text-[11px] text-ink-muted">
          + {matching.length - 10} more
        </div>
      )}
    </div>
  );
}

function Donut({
  categories,
  start = true,
  activeCategory,
  onSliceClick,
}: {
  categories: CategoryTotal[];
  // When false, slices render at final opacity with no fan-in
  // animation. Lets the parent gate animation on scroll visibility.
  start?: boolean;
  // Drill-down state. activeCategory highlights the matching slice
  // (thicker stroke). onSliceClick fires on tap; null = close.
  activeCategory?: string | null;
  onSliceClick?: (category: string) => void;
}) {
  const filtered = categories.filter((c) => c.monthly_cents > 0);
  const total = filtered.reduce((a, c) => a + c.monthly_cents, 0);

  const slices = useMemo<DonutSlice[]>(() => {
    if (total === 0) return [];
    const top = filtered.slice(0, 6);
    const otherRest = filtered.slice(6).reduce((a, c) => a + c.monthly_cents, 0);
    if (otherRest > 0) {
      top.push({
        category: "other_rollup",
        monthly_cents: otherRest,
        yearly_cents: otherRest * 12,
        subscription_count: 0,
      });
    }
    return top.map((c, i) => ({
      ...c,
      pct: Math.round((c.monthly_cents / total) * 100),
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
  }, [filtered, total]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (total === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-[13px] text-ink-muted">
        No categorized spend yet.
      </div>
    );
  }

  const legend = slices.filter((s) => s.pct >= 1);
  const cx = 100;
  const cy = 100;
  const r = 78;
  const stroke = 22;
  const strokeHover = 28;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const seg = slices.map((s) => {
    const dash = (s.monthly_cents / total) * circumference;
    const item = { ...s, dash, offset: cumulative };
    cumulative += dash;
    return item;
  });

  const hover = hoverIdx !== null ? seg[hoverIdx] : null;
  // Default state intentionally hides the dollar total. The hero
  // number above the donut already anchors $X/mo — repeating it in
  // the donut center made the same figure show up three times in the
  // top fold (critic round 2). On hover or click, the slice's
  // category + dollar replaces the default label so the chart is
  // still informative.
  const slicesCount = seg.length;
  const centerLabel = hover ? fmtRound(hover.monthly_cents) : `${slicesCount}`;
  const centerSub = hover
    ? prettyCategory(hover.category)
    : slicesCount === 1
      ? "category"
      : "categories";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <svg
        viewBox="0 0 200 200"
        className="w-full max-w-[240px] aspect-square"
        onPointerLeave={() => setHoverIdx(null)}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f5" strokeWidth={stroke} />
        {seg.map((s, i) => {
          const isHover = hoverIdx === i;
          const isActive = activeCategory === s.category;
          const delay = 0.15 + i * 0.09;
          return (
            <circle
              key={s.category}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={isActive || isHover ? strokeHover : stroke}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
              onPointerEnter={() => setHoverIdx(i)}
              onPointerDown={() => setHoverIdx(i)}
              onClick={() => {
                if (onSliceClick && s.category !== "other_rollup") {
                  onSliceClick(s.category);
                }
              }}
              style={{
                cursor: onSliceClick ? "pointer" : "default",
                transition: "stroke-width 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                opacity: start ? 0 : 1,
                animation: start
                  ? `donutSliceFanV2 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s forwards`
                  : undefined,
              }}
            />
          );
        })}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize={hover ? 18 : 28}
          fontWeight="700"
          fill="#0a0a0a"
        >
          {centerLabel}
        </text>
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="9"
          fontWeight="500"
          fill="#737373"
          letterSpacing="1"
        >
          {centerSub.toUpperCase()}
        </text>
        <style>{`
          @keyframes donutSliceFanV2 {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </svg>
      <div className="w-full max-w-[240px] space-y-1">
        {legend.map((s, i) => {
          const isHover = hoverIdx === i;
          const isActive = activeCategory === s.category;
          return (
            <div
              key={s.category}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerLeave={() => setHoverIdx(null)}
              onClick={() => {
                if (onSliceClick && s.category !== "other_rollup") {
                  onSliceClick(s.category);
                }
              }}
              className={[
                "flex items-center gap-2 text-[12px] md:text-[13px] cursor-pointer rounded px-1 -mx-1 transition-colors",
                isActive ? "bg-ink/[0.06]" : isHover ? "bg-ink/[0.04]" : "",
              ].join(" ")}
            >
              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className={[
                "truncate flex-1 min-w-0",
                isActive ? "text-ink font-medium" : "text-ink",
              ].join(" ")}>
                {prettyCategory(s.category)}
              </span>
              <span className="text-ink-muted tabular-nums">{s.pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Insights column (merged from old InsightsCard) ────────────────

function InsightsColumn({
  aiSpend,
  topSubscription,
  moneyLeaks,
  shockInsights,
}: {
  aiSpend: AiSpend;
  topSubscription: (TopSubscription & { domain?: string | null }) | null;
  moneyLeaks: MoneyLeak[];
  shockInsights: ShockInsight[];
}) {
  const [showAll, setShowAll] = useState(false);
  const items = [
    ...moneyLeaks.map((leak) => ({
      id: leak.id,
      kind: "alert" as const,
      severity: leak.severity,
      headline: leak.headline,
      detail: leak.detail,
      subscription_id: leak.source.subscription_ids?.[0] ?? null,
    })),
    ...shockInsights.map((s) => ({
      id: s.id,
      kind: "pattern" as const,
      severity: "low" as const,
      headline: s.headline,
      detail: s.detail,
      subscription_id: s.source.subscription_ids?.[0] ?? null,
    })),
  ];

  const CAP = 4;
  const visible = showAll ? items : items.slice(0, CAP);

  // Hide the AI Stack pinned row when the user has none — a $0/mo
  // "None detected" stat is dead pixels per the dashboard critic.
  const showAiStack = aiSpend.subscription_count > 0;
  // Money leaks copy: drop the '0 high' jargon. Plain English when
  // there's a single flag, count when there are multiple.
  const moneyLeakDetail = (() => {
    if (moneyLeaks.length === 0) return "Nothing flagged";
    if (moneyLeaks.length === 1) {
      const m = moneyLeaks[0];
      if (m.kind === "price_creep") return "1 price increase spotted";
      if (m.kind === "dormant_subscription") return "1 dormant sub";
      if (m.kind === "overlapping_ai_tools") return "Overlapping AI tools";
      if (m.kind === "rising_monthly_spend") return "Monthly spend rising";
      return "1 issue spotted";
    }
    return `${moneyLeaks.length} issues spotted`;
  })();

  return (
    <div className="space-y-3">
      {/* Pinned stat rows */}
      <div className="space-y-2.5">
        {showAiStack && (
          <PinnedStat
            dot="bg-brand"
            label="AI stack"
            value={`${fmtBig(aiSpend.monthly_cents)}/mo`}
            detail={`${aiSpend.subscription_count} tool${aiSpend.subscription_count === 1 ? "" : "s"}`}
          />
        )}
        {topSubscription && (
          <PinnedStat
            dot="bg-accent"
            label="Biggest sub"
            value={`${fmtBig(topSubscription.monthly_cents)}/mo`}
            detail={topSubscription.merchant_name}
            domain={topSubscription.domain ?? null}
          />
        )}
        <PinnedStat
          dot="bg-danger"
          label="Money leaks"
          value={String(moneyLeaks.length)}
          detail={moneyLeakDetail}
        />
      </div>

      {/* Alerts + patterns list */}
      {items.length > 0 && (
        <div className="pt-1 space-y-1.5">
          {visible.map((it) => (
            <InsightRow
              key={it.id}
              kind={it.kind}
              severity={it.severity}
              headline={it.headline}
              detail={it.detail}
              subscriptionId={it.subscription_id}
            />
          ))}
          {items.length > CAP && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[11px] text-ink-muted hover:text-ink transition pl-3"
            >
              {showAll ? "Show less" : `Show all ${items.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PinnedStat({
  dot,
  label,
  value,
  detail,
  domain,
}: {
  dot: string;
  label: string;
  value: string;
  detail: string;
  domain?: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted w-[80px] shrink-0">
        {label}
      </span>
      <span className="text-[14px] font-display font-bold tabular-nums text-ink shrink-0">
        {value}
      </span>
      {domain !== undefined && (
        <MerchantLogo name={detail} domain={domain} size={18} rounded="md" />
      )}
      <span className="text-[12px] text-ink-body truncate flex-1 min-w-0">
        {detail}
      </span>
    </div>
  );
}

function InsightRow({
  kind,
  severity,
  headline,
  detail,
  subscriptionId,
}: {
  kind: "alert" | "pattern";
  severity: "high" | "medium" | "low";
  headline: string;
  detail: string;
  subscriptionId: string | null;
}) {
  const dot =
    kind === "alert"
      ? severity === "high"
        ? "bg-danger"
        : "bg-accent"
      : "bg-brand";
  const body = (
    <div className="flex items-start gap-2 py-1.5">
      <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] md:text-[13px] font-medium text-ink leading-snug">
          {headline}
        </div>
        <div className="text-[11px] text-ink-muted leading-snug">{detail}</div>
      </div>
    </div>
  );
  if (subscriptionId) {
    return (
      <Link
        href={`/app/subscriptions/${subscriptionId}`}
        className="block rounded hover:bg-ink/[0.03] -mx-1 px-1 transition"
      >
        {body}
      </Link>
    );
  }
  return body;
}

// One-line interpretation under the donut. Tone is communicated by a
// small left rail color — calm by default, soft amber on attention.
function ConcentrationLine({ insight }: { insight: ConcentrationInsight }) {
  const rail =
    insight.tone === "attention"
      ? "border-l-2 border-l-accent"
      : insight.tone === "positive"
        ? "border-l-2 border-l-brand"
        : "border-l-2 border-l-hairline";
  return (
    <div
      className={`w-full max-w-[240px] mt-1 rounded-r-md bg-canvas/30 px-3 py-2 animate-fadeUp ${rail}`}
      style={{ animationDelay: "0.5s", animationFillMode: "both" }}
    >
      <div className="text-[12.5px] md:text-[13px] font-medium text-ink leading-snug">
        {insight.headline}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-muted leading-snug">
        {insight.detail}
      </div>
    </div>
  );
}

function prettyCategory(cat: string): string {
  const map: Record<string, string> = {
    streaming: "Streaming",
    software: "Software",
    news: "News & reading",
    fitness: "Fitness",
    food_delivery: "Food delivery",
    cloud_storage: "Cloud storage",
    gaming: "Gaming",
    telecom: "Phone & internet",
    phone_internet: "Phone & internet",
    utilities: "Utilities",
    education: "Education",
    insurance: "Insurance",
    other: "Other",
    other_rollup: "Other categories",
    bank_fees: "Bank fees",
  };
  return map[cat] ?? cat.replace(/_/g, " ");
}
