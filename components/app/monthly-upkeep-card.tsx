"use client";

// MonthlyUpkeepCard — the right-side companion to the identity card.
// Replaces both the standalone burn-hero card AND the standalone
// chart+donut row from v2. Lives next to the identity preview so the
// formerly empty right side of that section now carries real data.
//
// Structure:
//   • Eyebrow + big monthly upkeep number + subtitle
//   • Re-scan button + last-scanned label
//   • Line chart (12 months, gradient fill, hover tooltip)
//   • Donut (top categories) + legend
//
// Interactivity:
//   • Hovering the line chart shows a tooltip with that month's spend.
//   • Touch on mobile pins the tooltip to the nearest month.
//   • Re-scan POSTs to /api/scan/rescan and refreshes the page.
//
// Animations are subtle: fade + slide-up on mount via the CSS
// `animate-fadeUp` keyframe added in components/app/animations.css.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CategoryTotal, MonthBucket } from "@/lib/insights";

type Props = {
  totalMonthlyCents: number;
  totalYearlyCents: number;
  totalActiveCount: number;
  chart12mo: MonthBucket[];
  categories: CategoryTotal[];
  lastScannedAt: string | null;
};

const DONUT_COLORS = [
  "#047857", // brand emerald
  "#10b981",
  "#34d399",
  "#6ee7b7",
  "#ea580c",
  "#f97316",
  "#fbbf24",
];

function fmtBig(c: number): string {
  return `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtRound(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never scanned";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "Last scanned just now";
  if (min < 60) return `Last scanned ${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Last scanned ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `Last scanned ${day} day${day === 1 ? "" : "s"} ago`;
}

export function MonthlyUpkeepCard({
  totalMonthlyCents,
  totalYearlyCents,
  totalActiveCount,
  chart12mo,
  categories,
  lastScannedAt,
}: Props) {
  const router = useRouter();
  const [rescanning, startRescan] = useTransition();

  function onRescan() {
    startRescan(async () => {
      try {
        await fetch("/api/scan/rescan", { method: "POST" });
        router.refresh();
      } catch {
        // best-effort; ignore network errors
      }
    });
  }

  const fiveYearProjection = totalMonthlyCents * 60;

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Monthly upkeep
          </div>
          <div className="mt-1 font-display font-bold tracking-[-0.03em] leading-[1] text-ink text-[40px] sm:text-[52px] md:text-[60px] tabular-nums break-words">
            {fmtBig(totalMonthlyCents)}
            <span className="text-[20px] sm:text-[24px] md:text-[28px] font-medium text-ink-muted">
              /mo
            </span>
          </div>
          <div className="mt-2 text-[13px] md:text-[14px] text-ink-body">
            {fmtRound(totalYearlyCents)}/yr · {totalActiveCount} currently
            running
          </div>
          <div className="mt-0.5 text-[12px] md:text-[13px] text-ink-muted">
            ≈ {fmtRound(fiveYearProjection)} over 5 years
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <button
            type="button"
            onClick={onRescan}
            disabled={rescanning}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-canvas px-4 py-2 text-[13px] font-medium hover:bg-ink/85 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RescanIcon spinning={rescanning} />
            {rescanning ? "Scanning…" : "Re-scan"}
          </button>
          <div className="text-[11px] md:text-[12px] text-ink-muted">
            {timeAgo(lastScannedAt)}
          </div>
        </div>
      </div>

      {/* CHART + DONUT */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-end">
        <div className="md:col-span-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted mb-2">
            Last 12 months
          </div>
          <LineChart data={chart12mo} />
        </div>
        <div className="md:col-span-1">
          <CategoryDonut categories={categories} centerLabel="/mo total" />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Line chart — SVG path + gradient + interactive tooltip
// ───────────────────────────────────────────────────────────────────

function LineChart({ data }: { data: MonthBucket[] }) {
  // 1000x300 viewBox gives us decent precision for the path while
  // keeping numbers in `data-*` attributes readable when debugging.
  const W = 1000;
  const H = 300;
  const PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.spend_cents));
  const points = useMemo(() => {
    if (data.length === 0) return [];
    const stepX = (W - 2 * PAD) / Math.max(1, data.length - 1);
    return data.map((d, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - ((d.spend_cents / max) * (H - 2 * PAD));
      return { x, y, ...d };
    });
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

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDx = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dx = Math.abs(points[i].x - relX);
      if (dx < bestDx) {
        bestDx = dx;
        best = i;
      }
    }
    setHoverIdx(best);
  }

  function handleLeave() {
    setHoverIdx(null);
  }

  const hover = hoverIdx !== null ? points[hoverIdx] : null;

  if (data.length === 0) {
    return (
      <div className="h-32 md:h-40 flex items-center justify-center text-[13px] text-ink-muted">
        No charge history yet.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-32 md:h-44 touch-none"
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onPointerDown={handleMove}
      >
        <defs>
          <linearGradient id="upkeep-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={fillD}
          fill="url(#upkeep-fill)"
          className="animate-fadeIn"
          style={{ animationDelay: "0.05s" }}
        />
        <path
          d={pathD}
          fill="none"
          stroke="#047857"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-drawIn"
        />
        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD}
              y2={H - PAD}
              stroke="#0a0a0a"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity="0.4"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="6"
              fill="#fafafa"
              stroke="#047857"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* Month labels */}
      <div className="mt-1.5 grid grid-cols-12 text-[10px] md:text-[11px] text-ink-muted tabular-nums">
        {data.map((d, i) => {
          const abbr = new Date(d.month + "-01").toLocaleDateString("en-US", {
            month: "short",
          });
          // On mobile show every other month to reduce crowding.
          const showOnMobile = i % 2 === 0;
          return (
            <div
              key={d.month}
              className={`text-center ${showOnMobile ? "" : "hidden md:block"}`}
            >
              {abbr}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hover && (
        <Tooltip
          xPct={(hover.x / W) * 100}
          month={new Date(hover.month + "-01").toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
          amountCents={hover.spend_cents}
          charges={hover.charge_count}
        />
      )}
    </div>
  );
}

function Tooltip({
  xPct,
  month,
  amountCents,
  charges,
}: {
  xPct: number;
  month: string;
  amountCents: number;
  charges: number;
}) {
  // Anchor with clamped horizontal position so the tooltip never
  // overflows the card edges on narrow viewports.
  const left = `min(max(${xPct}%, 70px), calc(100% - 70px))`;
  return (
    <div
      className="pointer-events-none absolute -top-2 -translate-y-full -translate-x-1/2 rounded-xl border border-ink/15 bg-ink text-canvas px-3 py-2 shadow-soft text-[12px] whitespace-nowrap z-10"
      style={{ left }}
    >
      <div className="font-medium text-canvas">{month}</div>
      <div className="text-canvas/80 tabular-nums">
        {fmtBig(amountCents)} · {charges} charge{charges === 1 ? "" : "s"}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Donut (compact)
// ───────────────────────────────────────────────────────────────────

function CategoryDonut({
  categories,
  centerLabel,
}: {
  categories: CategoryTotal[];
  centerLabel: string;
}) {
  const filtered = categories.filter((c) => c.monthly_cents > 0);
  const total = filtered.reduce((acc, c) => acc + c.monthly_cents, 0);
  if (total === 0) {
    return (
      <div className="text-[13px] text-ink-muted py-8 text-center">
        No categorized spend yet.
      </div>
    );
  }
  const top = filtered.slice(0, 6);
  const otherRest = filtered
    .slice(6)
    .reduce((a, c) => a + c.monthly_cents, 0);
  if (otherRest > 0) {
    top.push({
      category: "other_rollup",
      monthly_cents: otherRest,
      yearly_cents: otherRest * 12,
      subscription_count: 0,
    });
  }

  const cx = 100;
  const cy = 100;
  const r = 78;
  const stroke = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-row md:flex-col items-center md:items-stretch gap-4">
      <svg
        viewBox="0 0 200 200"
        className="w-36 h-36 md:w-full md:h-auto md:max-w-[180px] mx-auto shrink-0 animate-fadeIn"
        style={{ animationDelay: "0.15s" }}
        aria-label="Category breakdown"
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f5" strokeWidth={stroke} />
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
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
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
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="18"
          fontWeight="800"
          fill="#0a0a0a"
        >
          {fmtRound(total)}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="11"
          fontWeight="500"
          fill="#737373"
          letterSpacing="1"
        >
          {centerLabel.toUpperCase()}
        </text>
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {top.map((c, i) => {
          const pct = Math.round((c.monthly_cents / total) * 100);
          return (
            <div
              key={c.category}
              className="flex items-center gap-2 text-[11px] md:text-[12px]"
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              <span className="text-ink truncate flex-1 min-w-0">
                {prettyCategory(c.category)}
              </span>
              <span className="text-ink-muted tabular-nums">{pct}%</span>
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

function RescanIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  );
}
