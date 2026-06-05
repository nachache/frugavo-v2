"use client";

// Calendar mockup — feature-spotlight visual for "Stay ahead of
// every renewal". Animation added 2026-06-05: brand badges pop into
// day cells with a soft scale+fade stagger on scroll-into-view.

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { BrandLogo, type BrandKey } from "@/components/marketing/brand-logo";

type Renewal = {
  day: number;
  brand: string;
  brandKey: BrandKey;
  amountUsd: number;
};

const MONTH_LABEL = "June 2026";

// 30-day month layout, starting on Sunday (June 1, 2026 = Monday in
// reality; we pin the visual to a clean grid so it tells the story
// without needing date-correctness logic). Brand keys map to real
// logos via the shared BrandLogo component (logo.dev).
const RENEWALS: Renewal[] = [
  { day: 3,  brand: "Netflix",    brandKey: "netflix",   amountUsd: 22.99 },
  { day: 7,  brand: "Spotify",    brandKey: "spotify",   amountUsd: 11.99 },
  { day: 12, brand: "Adobe CC",   brandKey: "adobe",     amountUsd: 59.99 },
  { day: 14, brand: "Microsoft",  brandKey: "microsoft", amountUsd: 10.99 },
  { day: 19, brand: "iCloud",     brandKey: "apple",     amountUsd:  2.99 },
  { day: 27, brand: "Amazon",     brandKey: "amazon",    amountUsd: 14.99 },
];

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const TOTAL_DAYS = 30;
// Empty cells before the 1st so the grid lines up visually (assume
// the 1st falls on Sunday for the mockup — index 0).
const LEADING_BLANKS = 0;

function renewalFor(day: number): Renewal | null {
  return RENEWALS.find((r) => r.day === day) ?? null;
}

// Fluid scale+fade entrance for renewal badges. Spring with a tiny
// bounce so each badge pops into place; staggered via index-based
// delay so the calendar reads as filling in.
const BADGE_VARIANTS = {
  hidden: { opacity: 0, scale: 0.5 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.25 + i * 0.08,
      type: "spring" as const,
      stiffness: 380,
      damping: 22,
    },
  }),
};

// Soft fade-up for the "Next 3 charges" list items
const ROW_VARIANTS = {
  hidden: { opacity: 0, x: -10 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.8 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function CalendarMockup() {
  // Index renewals so the diagonal stagger order is stable
  const renewalIndex = new Map(RENEWALS.map((r, i) => [r.day, i]));

  return (
    <motion.figure
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[440px] mx-auto"
      aria-label="Sample subscription renewal calendar — June 2026 with six upcoming charges."
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline/60 flex items-center justify-between">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-body">
            Renewals
          </div>
          <div className="mt-1 font-display text-[20px] font-bold tracking-[-0.015em] text-ink leading-none">
            {MONTH_LABEL}
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-body">
          <Calendar size={13} strokeWidth={2} className="text-brand" aria-hidden />
          {RENEWALS.length} upcoming
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="px-3 pt-3 grid grid-cols-7 gap-1.5 text-center">
        {DAYS_OF_WEEK.map((d, i) => (
          <div
            key={i}
            className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-body/70 pb-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="px-3 pb-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: LEADING_BLANKS }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
          const day = i + 1;
          const r = renewalFor(day);
          return (
            <div
              key={day}
              className={[
                "aspect-square rounded-lg flex flex-col items-center justify-start pt-1 text-[10.5px] tnum",
                r ? "bg-brand/[0.06] border border-brand/20" : "bg-ink/[0.02]",
              ].join(" ")}
            >
              <span className="text-ink-body/85">{day}</span>
              {r && (
                <motion.div
                  variants={BADGE_VARIANTS}
                  custom={renewalIndex.get(r.day) ?? 0}
                  className="mt-0.5"
                >
                  <BrandLogo
                    brand={r.brandKey}
                    size={20}
                    rounded="md"
                  />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — list of next-3 with totals */}
      <div className="px-5 py-3 border-t border-hairline/60">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-body">
          Next 3 charges
        </div>
        <ul className="mt-2 space-y-1.5">
          {RENEWALS.slice(0, 3).map((r, i) => (
            <motion.li
              key={r.brand}
              variants={ROW_VARIANTS}
              custom={i}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <BrandLogo brand={r.brandKey} size={20} rounded="md" />
              <span className="text-ink font-medium">{r.brand}</span>
              <span className="ml-auto text-ink-body tnum">
                Jun {r.day} · ${r.amountUsd.toFixed(2)}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      <figcaption className="px-5 py-2.5 bg-ink/[0.02] text-[10.5px] text-ink-body/80 text-center border-t border-hairline/60">
        Sample renewal calendar · mock data
      </figcaption>
    </motion.figure>
  );
}
