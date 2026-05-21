"use client";

import { TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  annualCents,
  type SubLike,
} from "@/lib/subscription-math";

// Cumulative savings card. Derives entirely from real cancelled
// subscriptions — if a user has cancelled anything this year, this
// shows the running yearly tally. Hidden when nothing has been
// cancelled so it never sits empty.
//
// Position: between the recommendation banner and the dashboard hero
// on /app. Calm emerald wash so it reads as a "win" not a stat.

type Props = {
  subs: SubLike[];
};

export function SavingsCounter({ subs }: Props) {
  const cancelled = subs.filter((s) => s.status === "cancelled");
  if (cancelled.length === 0) return null;

  const totalAnnual = cancelled.reduce(
    (sum, s) => sum + annualCents(s.amount_cents, s.frequency),
    0
  );
  const totalFiveYear = totalAnnual * 5;

  return (
    <div className="rounded-2xl bg-brand-light/60 border border-brand/20 px-5 py-4 mb-6 flex items-center gap-4">
      <div className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl bg-brand/15 text-brand">
        <TrendingDown size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] uppercase tracking-[0.14em] font-semibold text-emerald-900/70">
          You&apos;ve trimmed
        </div>
        <div className="mt-0.5 flex items-baseline flex-wrap gap-x-2 gap-y-0 tnum">
          <span className="text-[24px] font-display font-bold text-brand leading-none">
            {formatCurrency(totalAnnual / 100, false)}
          </span>
          <span className="text-[12px] font-medium text-emerald-900/70">
            /year
          </span>
          <span className="text-[11.5px] text-emerald-900/60">
            · {formatCurrency(totalFiveYear / 100, false)} over 5 years
          </span>
        </div>
      </div>
      <div className="hidden sm:block text-[11.5px] text-emerald-900/70 tnum text-right">
        {cancelled.length}{" "}
        {cancelled.length === 1 ? "cancellation" : "cancellations"}
      </div>
    </div>
  );
}
