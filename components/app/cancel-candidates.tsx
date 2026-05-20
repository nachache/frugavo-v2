"use client";

import { X } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { formatCurrency } from "@/lib/utils";
import {
  annualCents,
  monthlyEquivalentCents,
  type CancelCandidate,
} from "@/lib/subscription-math";

type Props = {
  candidates: CancelCandidate[];
};

const REASON_STYLE = {
  biggest: {
    label: "Biggest line item",
    bg: "#FB71851A",   // coral wash
    fg: "#9F1239",
  },
  forgotten: {
    label: "Might be forgotten",
    bg: "#F59E0B1A",   // amber wash
    fg: "#92400E",
  },
  silent: {
    label: "No recent charge",
    bg: "#94A3B81A",
    fg: "#334155",
  },
} as const;

export function CancelCandidates({ candidates }: Props) {
  if (candidates.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted mb-3">
        Worth a look
      </h2>
      <div className="rounded-3xl p-4 md:p-5"
           style={{ background: "linear-gradient(180deg, #FB71850D 0%, transparent 100%)" }}>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {candidates.map((c) => {
            const monthly = monthlyEquivalentCents(c.sub.amount_cents, c.sub.frequency);
            const annual = annualCents(c.sub.amount_cents, c.sub.frequency);
            const style = REASON_STYLE[c.reason];

            return (
              <article
                key={c.sub.id}
                className="min-w-[260px] flex-1 max-w-[320px] rounded-2xl bg-white border border-hairline/60 p-4 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <BrandLogo
                    merchant={c.sub.merchant_name}
                    category={c.sub.category}
                    size={56}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold text-ink truncate">
                      {c.sub.merchant_name}
                    </div>
                    <span
                      className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: style.bg, color: style.fg }}
                    >
                      {style.label}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between tnum">
                  <div>
                    <div className="text-[18px] font-display font-semibold text-ink">
                      {formatCurrency(monthly / 100)}
                      <span className="text-[12px] font-medium text-ink-muted">/mo</span>
                    </div>
                    <div className="text-[11.5px] text-ink-muted">
                      {formatCurrency(annual / 100, false)}/yr
                    </div>
                  </div>
                  <button
                    disabled
                    title="Cancel-assist ships in week 5"
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:border-accent hover:bg-accent hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
