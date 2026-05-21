"use client";

import { useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import {
  totalMonthlyCents,
  trailingTwelveMonths,
  type ChargeRow,
  type SubLike,
} from "@/lib/subscription-math";
import { CategoryDonut } from "./category-donut";

type Props = {
  subs: SubLike[];
  charges?: ChargeRow[];
  onRescan: () => void;
  rescanning?: boolean;
};

export function DashboardHero({ subs, charges = [], onRescan, rescanning }: Props) {
  const monthly = totalMonthlyCents(subs);
  const months = useMemo(
    () => trailingTwelveMonths(subs, charges),
    [subs, charges]
  );
  const activeCount = subs.filter((s) => s.status === "active").length;

  const chartData = months.map((m) => ({
    label: m.label,
    value: m.totalCents / 100,
  }));

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white border border-hairline/60 shadow-soft">
      {/* Soft sun-up wash at the bottom — keeps the card calm. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.10), transparent 65%)",
        }}
      />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
          {/* Totals */}
          <div className="md:w-[260px] shrink-0">
            <div className="text-[12px] uppercase tracking-[0.14em] text-emerald-900/70 font-semibold">
              Monthly upkeep
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[44px] md:text-[52px] leading-none font-display font-bold tracking-[-0.03em] text-brand tnum">
                {formatCurrency(monthly / 100)}
              </span>
              <span className="text-[14px] font-medium text-emerald-900/70">
                /mo
              </span>
            </div>
            <div className="mt-1.5 text-[13px] text-ink-muted tnum">
              {formatCurrency((monthly / 100) * 12, false)}/yr ·{" "}
              {activeCount} currently running
            </div>

            <button
              onClick={onRescan}
              disabled={rescanning}
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink/85 transition disabled:opacity-50"
            >
              {rescanning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Watering…
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Re-scan
                </>
              )}
            </button>
          </div>

          {/* 12-month area chart */}
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] uppercase tracking-[0.14em] text-ink-muted font-semibold">
              Last 12 months{charges.length === 0 ? " (estimated)" : ""}
            </div>
            <div className="mt-3 h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, bottom: 0, left: 0, right: 0 }}>
                  <defs>
                    <linearGradient id="frugavo-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={{ stroke: "#10B981", strokeWidth: 1, strokeOpacity: 0.4 }}
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E5E5E5",
                      borderRadius: 12,
                      fontSize: 12,
                      padding: "6px 10px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                    labelStyle={{ color: "#737373", fontSize: 11 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#047857"
                    strokeWidth={2}
                    fill="url(#frugavo-area)"
                    activeDot={{ r: 4, fill: "#047857" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Month labels — fewer on mobile so they don't squish. */}
            <div className="mt-2 flex justify-between text-[10.5px] text-ink-muted tnum px-1">
              {chartData
                .filter((_, i, arr) => {
                  // On small screens, hide everything except 4 anchor months;
                  // on md+ we show every other month via the responsive
                  // hidden classes below.
                  const total = arr.length;
                  return i === 0 || i === total - 1 ||
                    i === Math.floor(total / 3) ||
                    i === Math.floor((2 * total) / 3);
                })
                .map((m) => (
                  <span key={m.label} className="md:hidden">{m.label}</span>
                ))}
              {chartData
                .filter((_, i) => i % 2 === 0)
                .map((m) => (
                  <span key={`md-${m.label}`} className="hidden md:inline">
                    {m.label}
                  </span>
                ))}
            </div>
          </div>

          {/* Interactive category donut — hover/tap to see each
              category's share and dollar amount. All data derived from
              the same `subs` prop the rest of the card uses. */}
          <div className="md:w-[200px] shrink-0">
            <CategoryDonut subs={subs} />
          </div>
        </div>
      </div>
    </div>
  );
}
