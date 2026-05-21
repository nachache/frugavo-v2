"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/categories";
import {
  categoryBreakdown,
  totalMonthlyCents,
  type SubLike,
} from "@/lib/subscription-math";

// Interactive spending-category donut.
//
// Source of truth: lives entirely off the `subs` prop. Categories,
// amounts, and percentages are derived from the actual data — no
// hardcoded values, no placeholders. If there are 0 active subs the
// component renders nothing.
//
// Interactions:
//   - Hover (desktop) or tap (mobile) a segment → it stays at full
//     opacity while the others dim to 25%. The center label switches
//     from total monthly to that category's monthly + percentage.
//   - Hover or tap a legend chip → same effect. Lets thumb users on
//     mobile reach every segment even when they're tiny.
//   - Mouse out / tap empty area → returns to the total view.

type Props = {
  subs: SubLike[];
};

type Slice = {
  category: Category;
  name: string;
  value: number; // monthly cents
  color: string;
  count: number;
};

export function CategoryDonut({ subs }: Props) {
  const total = totalMonthlyCents(subs);
  const breakdown = categoryBreakdown(subs);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (breakdown.length === 0 || total === 0) return null;

  const slices: Slice[] = breakdown.map((b) => ({
    category: b.category,
    name: CATEGORY_LABEL[b.category],
    value: b.monthlyCents,
    color: CATEGORY_COLOR[b.category],
    count: b.count,
  }));

  const focused = activeIndex !== null ? slices[activeIndex] : null;
  const centerAmount = focused ? focused.value : total;
  const centerCaption = focused ? focused.name : "/mo total";
  const centerPercent = focused
    ? Math.round((focused.value / total) * 100)
    : null;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-[150px] h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={72}
              stroke="white"
              strokeWidth={2}
              paddingAngle={2}
              isAnimationActive={false}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, idx) =>
                setActiveIndex(activeIndex === idx ? null : idx)
              }
            >
              {slices.map((s, i) => (
                <Cell
                  key={s.category}
                  fill={s.color}
                  style={{
                    opacity:
                      activeIndex === null || activeIndex === i ? 1 : 0.22,
                    transition: "opacity 180ms ease-out",
                    cursor: "pointer",
                    outline: "none",
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — purely visual, ignores pointer events so the
            SVG underneath keeps receiving hover/tap. */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3"
          aria-live="polite"
        >
          {focused && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full mb-1"
              style={{ backgroundColor: focused.color }}
            />
          )}
          <span className="text-[20px] font-display font-bold tracking-[-0.02em] text-ink tnum leading-none">
            {formatCurrency(centerAmount / 100)}
          </span>
          <span className="mt-0.5 text-[9.5px] uppercase tracking-[0.12em] text-ink-muted leading-tight max-w-[90px] line-clamp-2">
            {centerCaption}
          </span>
          {centerPercent !== null && (
            <span className="mt-0.5 text-[10px] text-ink-muted tnum">
              {centerPercent}% of total
            </span>
          )}
        </div>
      </div>

      {/* Interactive legend — same hover/tap state, accessible to thumb. */}
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] w-full max-w-[200px]">
        {slices.slice(0, 6).map((s, i) => {
          const isActive = activeIndex === i;
          const dimmed = activeIndex !== null && !isActive;
          return (
            <li key={s.category}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(isActive ? null : i)}
                className={`flex items-center gap-1.5 text-left transition ${
                  dimmed ? "opacity-50" : "opacity-100"
                } ${
                  isActive ? "text-ink font-medium" : "text-ink-muted"
                } hover:text-ink`}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          );
        })}
        {slices.length > 6 && (
          <li className="text-[10.5px] text-ink-muted col-span-2 tnum">
            + {slices.length - 6} more
          </li>
        )}
      </ul>

      {/* "Other" explainer — appears only when the user focuses that
          segment, telling them why some subs landed there. Count comes
          from the real slice, never invented. */}
      {focused?.category === "other" && (
        <p className="mt-3 text-[10.5px] text-ink-muted leading-snug text-center max-w-[200px]">
          {focused.count} {focused.count === 1 ? "subscription" : "subscriptions"}{" "}
          our normalizer couldn&apos;t categorize. They still count toward
          your total.
        </p>
      )}
    </div>
  );
}
