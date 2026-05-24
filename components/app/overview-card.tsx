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
import Link from "next/link";
import type {
  CategoryTotal,
  MonthBucket,
  AiSpend,
  ShockInsight,
  TopSubscription,
} from "@/lib/insights";
import type { MoneyLeak } from "@/lib/money-leaks";
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
}: Props) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 md:p-7 animate-fadeUp">
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
            Monthly recurring
          </div>
          <div className="mt-2 font-display font-bold tracking-[-0.03em] leading-[1] text-[40px] sm:text-[52px] md:text-[60px] tabular-nums break-words text-brand">
            <CountUp targetCents={monthly.total_cents} />
            <span className="text-[20px] sm:text-[24px] md:text-[26px] font-medium text-ink-muted">
              /mo
            </span>
          </div>
          <div className="mt-3 text-[14px] md:text-[15px] text-ink-body">
            {fmtRound(yearly.total_cents)}/yr ·{" "}
            {monthly.sub_only_count}{" "}
            {monthly.sub_only_count === 1 ? "subscription" : "subscriptions"}
            {monthly.other_recurring_count > 0 && (
              <>
                {" + "}
                {monthly.other_recurring_count}{" "}
                {monthly.other_recurring_count === 1 ? "bill" : "bills"}
              </>
            )}
          </div>
          {monthly.other_recurring_count > 0 && (
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
        <div className="min-w-0 flex justify-center">
          <Donut categories={categories} />
        </div>

        {/* COL 3 — insights merged in */}
        <div className="min-w-0">
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

      {/* Bottom row: full-width sparkline */}
      <div className="mt-6 md:mt-8">
        <div className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
          Last 12 months
        </div>
        <Sparkline data={chart12mo} />
      </div>
    </div>
  );
}

// ─── Count-up ──────────────────────────────────────────────────────

function CountUp({ targetCents }: { targetCents: number }) {
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
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
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(targetCents * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetCents]);
  return <>{fmtBig(shown)}</>;
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

function Sparkline({ data }: { data: MonthBucket[] }) {
  const W = 1000;
  const H = 240;
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
        className="w-full h-20 md:h-28 touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={handleMove}
      >
        <defs>
          <linearGradient id="ovsk-fill-v2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--brand-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={fillD}
          fill="url(#ovsk-fill-v2)"
          style={{ animation: "fadeIn 0.7s ease-out 0.6s both" }}
        />
        <path
          d={pathD}
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth="1.5"
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
              opacity="0.3"
            />
            <circle
              cx={h.x}
              cy={h.y}
              r="4"
              fill="#fafafa"
              stroke="var(--brand-green)"
              strokeWidth="2.5"
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

function Donut({ categories }: { categories: CategoryTotal[] }) {
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
  const centerLabel = hover ? fmtRound(hover.monthly_cents) : fmtRound(total);
  const centerSub = hover ? prettyCategory(hover.category) : "per month";

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
                animation: `donutSliceFanV2 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s forwards`,
              }}
            />
          );
        })}
        <text x={cx} y={cy + 2} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="700" fill="#0a0a0a">
          {centerLabel}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="500" fill="#737373" letterSpacing="1">
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
          return (
            <div
              key={s.category}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerLeave={() => setHoverIdx(null)}
              className={[
                "flex items-center gap-2 text-[12px] md:text-[13px] cursor-pointer rounded px-1 -mx-1 transition-colors",
                isHover ? "bg-ink/[0.04]" : "",
              ].join(" ")}
            >
              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
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

  return (
    <div className="space-y-3">
      {/* Pinned stat rows */}
      <div className="space-y-2.5">
        <PinnedStat
          dot="bg-brand"
          label="AI stack"
          value={
            aiSpend.subscription_count === 0
              ? "$0/mo"
              : `${fmtBig(aiSpend.monthly_cents)}/mo`
          }
          detail={
            aiSpend.subscription_count === 0
              ? "None detected"
              : `${aiSpend.subscription_count} tool${aiSpend.subscription_count === 1 ? "" : "s"}`
          }
        />
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
          detail={
            moneyLeaks.length === 0
              ? "Nothing flagged"
              : `${moneyLeaks.filter((l) => l.severity === "high").length} high`
          }
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
