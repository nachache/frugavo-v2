"use client";

// OverviewCard — first viewport. Three columns on desktop:
//   1. Hero total (canonical Monthly Upkeep + yearly + active count)
//   2. 12-month sparkline with hover tooltip
//   3. Category donut (no 0% legend entries)
//
// On mobile: stacks vertically.
//
// Reads ONLY from DashboardData fields. Never recomputes totals.

import { useMemo, useState } from "react";
import type { CategoryTotal, MonthBucket } from "@/lib/insights";

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
};

function fmtBig(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtRound(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

const DONUT_COLORS = [
  "var(--brand-green)",
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#ea580c",
  "#f97316",
  "#fbbf24",
];

export function OverviewCard({ monthly, yearly, chart12mo, categories }: Props) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        {/* Hero total */}
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Monthly upkeep
          </div>
          <div className="mt-2 font-display font-bold tracking-[-0.03em] leading-[1] text-[44px] sm:text-[56px] md:text-[64px] tabular-nums break-words text-brand">
            {fmtBig(monthly.total_cents)}
            <span className="text-[22px] sm:text-[26px] md:text-[28px] font-medium text-ink-muted">
              /mo
            </span>
          </div>
          <div className="mt-3 text-[13px] md:text-[14px] text-ink-body">
            {fmtRound(yearly.total_cents)}/yr · {monthly.total_count} currently
            running
          </div>
          {monthly.other_recurring_count > 0 && (
            <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-hairline bg-canvas/40 px-3 py-1.5 text-[12px] text-ink-body">
              <span className="font-medium text-ink">
                {fmtRound(monthly.sub_only_cents)}
              </span>
              <span className="text-ink-muted">subscriptions</span>
              <span className="text-ink-muted/40">+</span>
              <span className="font-medium text-ink">
                {fmtRound(monthly.other_recurring_cents)}
              </span>
              <span className="text-ink-muted">other recurring</span>
            </div>
          )}
        </div>

        {/* 12-month sparkline */}
        <div className="min-w-0">
          <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
            Last 12 months
          </div>
          <Sparkline data={chart12mo} />
        </div>

        {/* Category donut */}
        <div className="min-w-0">
          <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
            By category
          </div>
          <Donut categories={categories} />
        </div>
      </div>
    </div>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────

function Sparkline({ data }: { data: MonthBucket[] }) {
  const W = 1000;
  const H = 300;
  const PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.spend_cents));
  const points = useMemo(() => {
    if (data.length === 0) return [];
    const stepX = (W - 2 * PAD) / Math.max(1, data.length - 1);
    return data.map((d, i) => ({
      x: PAD + i * stepX,
      y: H - PAD - ((d.spend_cents / max) * (H - 2 * PAD)),
      ...d,
    }));
  }, [data, max]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
      .join(" ");
  }, [points]);
  const fillD = useMemo(() => {
    if (points.length === 0) return "";
    const top = points
      .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
      .join(" ");
    return `${top} L ${points[points.length - 1].x},${H - PAD} L ${points[0].x},${H - PAD} Z`;
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

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-24 md:h-28 touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={handleMove}
      >
        <defs>
          <linearGradient id="ovsk-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#ovsk-fill)" />
        <path
          d={pathD}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
              opacity="0.4"
            />
            <circle
              cx={h.x}
              cy={h.y}
              r="6"
              fill="#fafafa"
              stroke="var(--brand-green)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      <div className="mt-1.5 grid grid-cols-12 text-[10px] md:text-[10px] text-ink-muted tabular-nums">
        {data.map((d, i) => {
          const abbr = new Date(d.month + "-01").toLocaleDateString("en-US", { month: "short" });
          const show = i % 3 === 0;
          return (
            <div key={d.month} className={`text-center ${show ? "" : "hidden md:block"}`}>
              {abbr}
            </div>
          );
        })}
      </div>
      {h && (
        <div
          className="pointer-events-none absolute -top-1 -translate-y-full -translate-x-1/2 rounded-lg border border-ink/15 bg-ink text-canvas px-2.5 py-1.5 text-[11px] whitespace-nowrap z-10"
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

// ─── Donut ─────────────────────────────────────────────────────────

function Donut({ categories }: { categories: CategoryTotal[] }) {
  const filtered = categories.filter((c) => c.monthly_cents > 0);
  const total = filtered.reduce((a, c) => a + c.monthly_cents, 0);
  if (total === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[13px] text-ink-muted">
        No categorized spend yet.
      </div>
    );
  }
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
  // Compute % once. Hide entries < 1% per ticket P2.9 (0% effectively).
  const withPct = top.map((c, i) => ({
    ...c,
    pct: Math.round((c.monthly_cents / total) * 100),
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const legend = withPct.filter((c) => c.pct >= 1);

  const cx = 100;
  const cy = 100;
  const r = 70;
  const stroke = 20;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-row md:flex-col items-center md:items-stretch gap-4">
      <svg viewBox="0 0 200 200" className="w-28 h-28 md:w-full md:max-w-[160px] mx-auto shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f5" strokeWidth={stroke} />
        {withPct.map((c) => {
          const fraction = c.monthly_cents / total;
          const dash = fraction * circumference;
          const seg = (
            <circle
              key={c.category}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={c.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return seg;
        })}
        <text x={cx} y={cy + 4} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="700" fill="#0a0a0a">
          {fmtRound(total)}
        </text>
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {legend.map((c) => (
          <div key={c.category} className="flex items-center gap-2 text-[11px] md:text-[12px]">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
            <span className="text-ink truncate flex-1 min-w-0">{prettyCategory(c.category)}</span>
            <span className="text-ink-muted tabular-nums">{c.pct}%</span>
          </div>
        ))}
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
