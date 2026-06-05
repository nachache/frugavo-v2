"use client";

// "By category" breakdown mockup — Discover feature spotlight.
// Bars animate from 0 → final width on scroll-into-view.
//
// Built to replace the duplicate HeroResultsPreview usage in the
// Discover spotlight: the hero illustration already shows the
// subscriptions list view, so showing the same flat list again
// 200px below felt redundant. The category-breakdown lens shows the
// SAME product, different view — proves the engine doesn't just
// list, it categorizes and interprets.
//
// Mock data only. No imports from /app/* or lib/scan.

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

type Category = {
  label: string;
  color: string;
  amountUsd: number;
  count: number;
};

// Sorted descending by spend so the visual reads as a ranked priority
// list — most-expensive bucket first.
const CATEGORIES: Category[] = [
  { label: "Streaming",       color: "#E50914", amountUsd: 50.97, count: 3 },
  { label: "Productivity",    color: "#FA0F00", amountUsd: 43.97, count: 2 },
  { label: "News & reading",  color: "#000000", amountUsd: 25.00, count: 1 },
  { label: "Cloud storage",   color: "#0A0A0A", amountUsd: 12.98, count: 2 },
  { label: "Food delivery",   color: "#FF9900", amountUsd: 14.99, count: 1 },
  { label: "Unknown / review",color: "#5C5CFF", amountUsd: 24.00, count: 1 },
];

const TOTAL = CATEGORIES.reduce((s, c) => s + c.amountUsd, 0);
const TOTAL_COUNT = CATEGORIES.reduce((s, c) => s + c.count, 0);
const TOP_CATEGORY = CATEGORIES[0];
const TOP_SHARE = (TOP_CATEGORY.amountUsd / TOTAL) * 100;

const fmtUsd = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CategoriesBreakdownMockup() {
  return (
    <motion.figure
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[440px] mx-auto"
      aria-label="Sample category breakdown — 10 subscriptions grouped into 6 spending categories."
    >
      {/* Header — total + category count + interpretation insight */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline/60">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-body">
          By category
        </div>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="font-display text-[28px] md:text-[32px] font-bold tracking-[-0.02em] tabular-nums text-ink leading-none">
            {fmtUsd(TOTAL)}
          </span>
          <span className="text-[13px] text-ink-body">/mo</span>
          <span className="text-[12px] text-ink-body/85">
            · {TOTAL_COUNT} subs across {CATEGORIES.length} categories
          </span>
        </div>

        <div
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11.5px] font-semibold text-brand"
          role="status"
        >
          <TrendingUp size={11} strokeWidth={2.5} aria-hidden="true" />
          {TOP_CATEGORY.label} is {Math.round(TOP_SHARE)}% of your monthly subs
        </div>
      </div>

      {/* Category rows — horizontal spend bars (animated width) */}
      <ul className="px-5 py-4 space-y-3.5">
        {CATEGORIES.map((c, i) => {
          const widthPct = (c.amountUsd / TOP_CATEGORY.amountUsd) * 100;
          return (
            <motion.li
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                delay: 0.15 + i * 0.06,
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: c.color }}
                  />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    {c.label}
                  </span>
                  <span className="text-[11px] text-ink-body/70 shrink-0">
                    · {c.count}
                  </span>
                </div>
                <span className="text-[13px] font-semibold text-ink tabular-nums shrink-0">
                  {fmtUsd(c.amountUsd)}
                  <span className="text-[10px] text-ink-body/70 font-normal ml-0.5">/mo</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-ink/[0.04] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${widthPct}%` }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    delay: 0.35 + i * 0.08,
                    duration: 0.9,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    background: c.color,
                    opacity: 0.85,
                  }}
                  aria-hidden="true"
                />
              </div>
            </motion.li>
          );
        })}
      </ul>

      <figcaption className="px-5 py-2.5 bg-ink/[0.02] text-[10.5px] text-ink-body/80 text-center border-t border-hairline/60">
        Sample category breakdown · mock data
      </figcaption>
    </motion.figure>
  );
}
