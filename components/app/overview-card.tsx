"use client";

// OverviewCard — three-column hero (number / sparkline / donut).
//
// Animations:
//   • Number counts up on mount (1.1s ease-out)
//   • Sparkline path draws itself in via stroke-dashoffset (0.9s)
//   • Donut slices fan in one by one via stroke-dashoffset (staggered)
//   • Donut segments highlight on hover/touch with tooltip
//   • Sparkline tooltip on cursor (already had it; refined here)
//
// Cinematic reveal on mount; cursor-interactive afterwards.

import { useEffect, useMemo, useRef, useState } from "react";
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

export function OverviewCard({ monthly, yearly, chart12mo, categories }: Props) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Monthly upkeep
          </div>
          <div className="mt-2 font-display font-bold tracking-[-0.03em] leading-[1] text-[44px] sm:text-[56px] md:text-[64px] tabular-nums break-words text-brand">
            <CountUp targetCents={monthly.total_cents} />
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
              <span className="font-medium text-ink">{fmtRound(monthly.sub_only_cents)}</span>
              <span className="text-ink-muted">subscriptions</span>
              <span className="text-ink-muted/40">+</span>
              <span className="font-medium text-ink">{fmtRound(monthly.other_recurring_cents)}</span>
              <span className="text-ink-muted">other recurring</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
            Last 12 months
          </div>
          <Sparkline data={chart12mo} />
        </div>

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

// ─── Count-up number animation ─────────────────────────────────────

function CountUp({ targetCents }: { targetCents: number }) {
  // Animates from 0 to target over ~1.1s with ease-out cubic.
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(targetCents);
      return;
    }
    let raf = 0;
    const duration = 1100;
    const start = performance.now();
    startRef.current = start;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(targetCents * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetCents]);

  return <>{fmtBig(shown)}</>;
}

// ─── Sparkline (with draw-in + hover tooltip) ──────────────────────

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
      y: H - PAD - (d.spend_cents / max) * (H - 2 * PAD),
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

  // Approximate path length for stroke-dashoffset draw-in. Hardcode a
  // generous value since exact getTotalLength() requires the SVG to be
  // mounted; using a large constant works because dasharray clamps.
  const PATH_LENGTH = 2200;

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
        <path
          d={fillD}
          fill="url(#ovsk-fill)"
          style={{ animation: "fadeIn 0.7s ease-out 0.6s both" }}
        />
        <path
          d={pathD}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={PATH_LENGTH}
          strokeDashoffset={PATH_LENGTH}
          style={{
            animation: "sparkDraw 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards",
          }}
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
        <style>{`
          @keyframes sparkDraw { to { stroke-dashoffset: 0; } }
        `}</style>
      </svg>
      <div className="mt-1.5 grid grid-cols-12 text-[10px] text-ink-muted tabular-nums">
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

// ─── Donut (fan-in + hover-highlight + tooltip) ────────────────────

type DonutSlice = CategoryTotal & { pct: number; color: string };

function Donut({ categories }: { categories: CategoryTotal[] }) {
  const filtered = categories.filter((c) => c.monthly_cents > 0);
  const total = filtered.reduce((a, c) => a + c.monthly_cents, 0);

  // Hooks must run in stable order — call them BEFORE the early
  // empty-state return.
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
      <div className="h-32 flex items-center justify-center text-[13px] text-ink-muted">
        No categorized spend yet.
      </div>
    );
  }

  // Legend entries — hide < 1% (effectively 0%) per ticket.
  const legend = slices.filter((s) => s.pct >= 1);

  // Donut geometry.
  const cx = 100;
  const cy = 100;
  const r = 70;
  const stroke = 20;
  const strokeHover = 26;
  const circumference = 2 * Math.PI * r;
  // Pre-compute each slice's dash + offset.
  let cumulative = 0;
  const seg = slices.map((s) => {
    const dash = (s.monthly_cents / total) * circumference;
    const item = { ...s, dash, offset: cumulative };
    cumulative += dash;
    return item;
  });

  const hover = hoverIdx !== null ? seg[hoverIdx] : null;
  const centerLabel = hover
    ? fmtRound(hover.monthly_cents)
    : fmtRound(total);
  const centerSub = hover
    ? prettyCategory(hover.category)
    : "per month";

  return (
    <div className="flex flex-row md:flex-col items-center md:items-stretch gap-4">
      <svg
        viewBox="0 0 200 200"
        className="w-32 h-32 md:w-full md:max-w-[180px] mx-auto shrink-0"
        onPointerLeave={() => setHoverIdx(null)}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f5" strokeWidth={stroke} />
        {seg.map((s, i) => {
          const isHover = hoverIdx === i;
          // Cinematic fan-in: each slice starts hidden and reveals
          // over ~700ms with a 90ms stagger between slices.
          const delay = 0.15 + i * 0.09;
          return (
            <circle
              key={s.category}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={isHover ? strokeHover : stroke}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
              onPointerEnter={() => setHoverIdx(i)}
              onPointerDown={() => setHoverIdx(i)}
              style={{
                cursor: "pointer",
                transition: "stroke-width 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                opacity: 0,
                animation: `donutSliceFan 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s forwards`,
              }}
            />
          );
        })}
        <text x={cx} y={cy + 2} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="700" fill="#0a0a0a">
          {centerLabel}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="500" fill="#737373" letterSpacing="1">
          {centerSub.toUpperCase()}
        </text>
        <style>{`
          @keyframes donutSliceFan {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </svg>

      <div className="flex-1 min-w-0 space-y-1">
        {legend.map((s, i) => {
          const isHover = hoverIdx === i;
          return (
            <div
              key={s.category}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerLeave={() => setHoverIdx(null)}
              className={[
                "flex items-center gap-2 text-[11px] md:text-[12px] cursor-pointer rounded px-1 -mx-1 transition-colors",
                isHover ? "bg-ink/[0.04]" : "",
              ].join(" ")}
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-ink truncate flex-1 min-w-0">
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
