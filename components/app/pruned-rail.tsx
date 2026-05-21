"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { cn, formatCurrency } from "@/lib/utils";
import {
  annualCents,
  type SubLike,
} from "@/lib/subscription-math";

// Pruned rail — the running tally of "wins" alongside the active list.
// Renders as a card in the right column on desktop and stacks under
// the active list on mobile. Calm garden visual: emerald wash, soft
// seedling icon, total savings front and center.

type Props = {
  cancelled: SubLike[];
};

export function PrunedRail({ cancelled }: Props) {
  const [open, setOpen] = useState(true);

  if (cancelled.length === 0) {
    return (
      <aside className="rounded-3xl border border-hairline/60 bg-white p-5">
        <div className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
          Pruned · 0
        </div>
        <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
          Cancellations live here once you confirm them. Your wins stack up
          as the next bill confirms it stopped.
        </p>
      </aside>
    );
  }

  const annualSaved = cancelled.reduce(
    (sum, s) => sum + annualCents(s.amount_cents, s.frequency),
    0
  );

  return (
    <aside className="rounded-3xl border border-brand/20 bg-brand-light/40 p-5">
      <div className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-emerald-900/70">
        Pruned · {cancelled.length}
      </div>
      <div className="mt-2 flex items-baseline gap-2 tnum">
        <span className="text-[28px] font-display font-bold text-brand leading-none">
          {formatCurrency(annualSaved / 100, false)}
        </span>
        <span className="text-[12px] font-medium text-emerald-900/70">
          saved /yr
        </span>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 w-full text-left flex items-center justify-between text-[11.5px] font-semibold text-emerald-900/70 hover:text-brand transition"
      >
        <span>{open ? "Hide list" : "Show list"}</span>
        <ChevronDown
          size={13}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {cancelled.map((s) => (
            <PrunedRow key={s.id} sub={s} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function PrunedRow({ sub }: { sub: SubLike }) {
  const annual = annualCents(sub.amount_cents, sub.frequency);
  return (
    <li className="rounded-xl bg-white border border-hairline/60 p-3 flex items-center gap-3">
      <BrandLogo
        merchant={sub.merchant_name}
        category={sub.category}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink truncate">
          {sub.merchant_name}
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] text-brand font-medium">
          <Check size={10} strokeWidth={3} />
          Saved {formatCurrency(annual / 100, false)}/yr
        </div>
      </div>
    </li>
  );
}
