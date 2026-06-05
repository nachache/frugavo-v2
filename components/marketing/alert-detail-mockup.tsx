"use client";

// Alert-detail mockup — feature-spotlight visual for the
// "Discover every recurring charge" section. History rows stagger
// in on scroll-into-view.

import { motion } from "framer-motion";
import { Calendar, CheckCircle2, ExternalLink, TrendingUp } from "lucide-react";
import { BrandLogo } from "@/components/marketing/brand-logo";

type HistoryItem = {
  date: string;
  amount: number;
};

const HISTORY: HistoryItem[] = [
  { date: "Jun 3, 2026", amount: 22.99 },
  { date: "May 3, 2026", amount: 22.99 },
  { date: "Apr 3, 2026", amount: 17.99 },
  { date: "Mar 3, 2026", amount: 17.99 },
  { date: "Feb 3, 2026", amount: 17.99 },
  { date: "Jan 3, 2026", amount: 15.49 },
];

const fmtUsd = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AlertDetailMockup() {
  const firstChargeDate = HISTORY[HISTORY.length - 1].date;
  const totalPaid = HISTORY.reduce((s, h) => s + h.amount, 0);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl border border-hairline bg-white shadow-[0_24px_60px_-30px_rgba(10,10,10,0.18)] overflow-hidden max-w-[440px] mx-auto"
      aria-label="Sample subscription detail — Netflix monthly with price change history."
    >
      {/* Brand header */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline/60">
        <div className="flex items-center gap-3">
          <BrandLogo brand="netflix" size={48} rounded="xl" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[18px] font-bold tracking-[-0.015em] text-ink leading-tight">
              Netflix
            </div>
            <div className="text-[11.5px] text-ink-body">Streaming · Active</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-red-900">
            <TrendingUp size={10} strokeWidth={2.5} aria-hidden />
            Price up
          </span>
        </div>

        {/* Key facts grid */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <FactCell label="Per month" value={fmtUsd(22.99)} />
          <FactCell label="Per year" value={fmtUsd(22.99 * 12)} />
          <FactCell label="Paid since" value={firstChargeDate.split(",")[0]} />
        </div>
      </div>

      {/* Price change callout */}
      <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900">
          <TrendingUp size={11} strokeWidth={2.5} aria-hidden />
          Price increased
        </div>
        <p className="mt-1 text-[12px] text-amber-900/90 leading-relaxed">
          From {fmtUsd(15.49)} → {fmtUsd(17.99)} → {fmtUsd(22.99)} over the
          last 6 months. You&apos;ve paid {fmtUsd(totalPaid)} total.
        </p>
      </div>

      {/* History */}
      <div className="px-5 pt-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-body">
          Last 6 charges
        </div>
        <ul className="mt-2 space-y-1.5">
          {HISTORY.map((h, i) => (
            <motion.li
              key={h.date}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                delay: 0.4 + i * 0.07,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="inline-flex items-center gap-1.5 text-ink-body">
                <Calendar size={11} strokeWidth={2} className="text-ink-body/60" aria-hidden />
                {h.date}
              </span>
              <span className="font-semibold text-ink tnum">{fmtUsd(h.amount)}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Next renewal */}
      <div className="mx-4 mt-4 mb-4 rounded-xl bg-ink/[0.03] p-3 flex items-center gap-2">
        <CheckCircle2 size={14} strokeWidth={2.2} className="text-brand" aria-hidden />
        <span className="text-[12px] text-ink-body">
          Next charge expected{" "}
          <span className="font-semibold text-ink">Jul 3</span>
        </span>
      </div>

      {/* Action row */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          type="button"
          tabIndex={-1}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-ink text-white text-[12.5px] font-semibold h-10 hover:bg-ink/85 transition"
        >
          Cancel-assist
          <ExternalLink size={11} strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="rounded-full border border-hairline bg-white text-ink text-[12.5px] font-semibold h-10 px-4 hover:bg-ink/[0.03] transition"
        >
          Keep
        </button>
      </div>

      <figcaption className="px-5 py-2.5 bg-ink/[0.02] text-[10.5px] text-ink-body/80 text-center border-t border-hairline/60">
        Sample subscription detail · mock data
      </figcaption>
    </motion.figure>
  );
}

function FactCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink/[0.02] py-2">
      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-body/70 font-semibold">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-bold text-ink tnum">{value}</div>
    </div>
  );
}
