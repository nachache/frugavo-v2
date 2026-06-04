// Static calendar mockup — feature-spotlight visual for the
// "Stay ahead of every renewal" section. Phase G (2026-06-05).
//
// Shows a month grid with renewal pills on the days a subscription
// is expected to charge. Mirrors the in-app /app/calendar surface
// but with mock data. Zero imports from /app/*, lib/scan, or any
// live data — pure SSR-friendly static markup.

import { Calendar } from "lucide-react";

type Renewal = {
  day: number;
  brand: string;
  amountUsd: number;
  color: string;
  initial: string;
};

const MONTH_LABEL = "June 2026";

// 30-day month layout, starting on Sunday (June 1, 2026 = Monday in
// reality; we pin the visual to a clean grid so it tells the story
// without needing date-correctness logic).
const RENEWALS: Renewal[] = [
  { day: 3,  brand: "Netflix",    amountUsd: 22.99, color: "#E50914", initial: "N" },
  { day: 7,  brand: "Spotify",    amountUsd: 11.99, color: "#1DB954", initial: "S" },
  { day: 12, brand: "Adobe CC",   amountUsd: 59.99, color: "#FA0F00", initial: "A" },
  { day: 14, brand: "Microsoft",  amountUsd: 10.99, color: "#5E5E5E", initial: "M" },
  { day: 19, brand: "iCloud",     amountUsd:  2.99, color: "#0A0A0A", initial: "i" },
  { day: 22, brand: "NYT",        amountUsd: 25.00, color: "#000000", initial: "T" },
  { day: 27, brand: "Amazon",     amountUsd: 14.99, color: "#FF9900", initial: "A" },
];

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const TOTAL_DAYS = 30;
// Empty cells before the 1st so the grid lines up visually (assume
// the 1st falls on Sunday for the mockup — index 0).
const LEADING_BLANKS = 0;

function renewalFor(day: number): Renewal | null {
  return RENEWALS.find((r) => r.day === day) ?? null;
}

export function CalendarMockup() {
  return (
    <figure
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[440px] mx-auto"
      aria-label="Sample subscription renewal calendar — June 2026 with seven upcoming charges."
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
                <span
                  aria-hidden="true"
                  className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: r.color }}
                  title={`${r.brand} · $${r.amountUsd}`}
                >
                  {r.initial}
                </span>
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
          {RENEWALS.slice(0, 3).map((r) => (
            <li key={r.brand} className="flex items-center gap-2.5 text-[12px]">
              <span
                aria-hidden="true"
                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                style={{ background: r.color }}
              >
                {r.initial}
              </span>
              <span className="text-ink font-medium">{r.brand}</span>
              <span className="ml-auto text-ink-body tnum">
                Jun {r.day} · ${r.amountUsd.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="px-5 py-2.5 bg-ink/[0.02] text-[10.5px] text-ink-body/80 text-center border-t border-hairline/60">
        Sample renewal calendar · mock data
      </figcaption>
    </figure>
  );
}
