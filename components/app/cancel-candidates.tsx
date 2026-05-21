"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { formatCurrency } from "@/lib/utils";
import {
  annualCents,
  candidatesAnnualSavingsCents,
  monthlyEquivalentCents,
  type CancelCandidate,
  type SubLike,
} from "@/lib/subscription-math";

// "Worth a look" — the cancel-candidates strip. Source of truth for
// both the count rendered and the recommendation banner's number is
// the same `candidates` array passed in (computed by cancelCandidates
// in lib/subscription-math.ts). Never hardcoded.
//
// Behavior at different sizes:
//   - 0 candidates  → component renders nothing (no empty state, the
//                     dashboard hides this section entirely).
//   - 1..INITIAL    → renders all of them, no "show all" toggle.
//   - INITIAL+1+    → renders INITIAL cards plus a "Show all (N)" button
//                     that expands to the full list. Persistent toggle.

const INITIAL_VISIBLE = 3;

type Props = {
  candidates: CancelCandidate[];
  onCancel?: (sub: SubLike) => void;
};

const REASON_STYLE = {
  biggest: {
    label: "Biggest line item",
    bg: "#FB71851A",
    fg: "#9F1239",
  },
  forgotten: {
    label: "Might be forgotten",
    bg: "#F59E0B1A",
    fg: "#92400E",
  },
  silent: {
    label: "No recent charge",
    bg: "#94A3B81A",
    fg: "#334155",
  },
} as const;

export function CancelCandidates({ candidates, onCancel }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (candidates.length === 0) return null;

  const overflow = Math.max(0, candidates.length - INITIAL_VISIBLE);
  const visible = expanded ? candidates : candidates.slice(0, INITIAL_VISIBLE);
  const totalAnnualCents = candidatesAnnualSavingsCents(candidates);

  return (
    // id is the anchor target for the recommendation banner's "See
    // candidates" CTA (href="/app#worth-a-look"). scroll-mt-20 leaves
    // breathing room under the sticky nav. The :target pseudo-class
    // gives a brief emerald focus ring so the user sees where they
    // landed after the smooth scroll.
    <section
      id="worth-a-look"
      className="mt-8 scroll-mt-20 target:ring-2 target:ring-brand/40 target:ring-offset-4 target:ring-offset-canvas rounded-3xl transition"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-muted">
          Worth a look · {candidates.length}
        </h2>
        <span className="text-[12px] text-ink-muted tnum">
          Up to{" "}
          <span className="font-semibold text-ink">
            {formatCurrency(totalAnnualCents / 100, false)}/yr
          </span>{" "}
          in potential savings
        </span>
      </div>

      <div
        className="rounded-3xl p-4 md:p-5"
        style={{
          background:
            "linear-gradient(180deg, #FB71850D 0%, transparent 100%)",
        }}
      >
        <div
          className={
            expanded
              ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              : "flex gap-3 overflow-x-auto hide-scrollbar pb-1"
          }
        >
          {visible.map((c) => (
            <CandidateCard key={c.sub.id} candidate={c} onCancel={onCancel} />
          ))}
        </div>

        {overflow > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 inline-flex h-9 items-center gap-1 rounded-full bg-white border border-hairline px-4 text-[12.5px] font-medium text-ink hover:bg-ink/[0.04] transition"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Show less" : `Show all ${candidates.length}`}
          </button>
        )}
      </div>
    </section>
  );
}

function CandidateCard({
  candidate,
  onCancel,
}: {
  candidate: CancelCandidate;
  onCancel?: (sub: SubLike) => void;
}) {
  const monthly = monthlyEquivalentCents(
    candidate.sub.amount_cents,
    candidate.sub.frequency
  );
  const annual = annualCents(
    candidate.sub.amount_cents,
    candidate.sub.frequency
  );
  const style = REASON_STYLE[candidate.reason];

  return (
    <article
      className={
        // Stays a horizontally-scrolled item by default, becomes a grid
        // cell when the parent flips to grid in expanded mode.
        "shrink-0 min-w-[260px] max-w-[320px] sm:min-w-0 sm:max-w-none rounded-2xl bg-white border border-hairline/60 p-4 shadow-soft"
      }
    >
      <div className="flex items-center gap-3">
        <BrandLogo
          merchant={candidate.sub.merchant_name}
          category={candidate.sub.category}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-ink truncate">
            {candidate.sub.merchant_name}
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
            <span className="text-[12px] font-medium text-ink-muted">
              /mo
            </span>
          </div>
          <div className="text-[11.5px] text-ink-muted">
            {formatCurrency(annual / 100, false)}/yr
          </div>
        </div>
        <button
          onClick={() => onCancel?.(candidate.sub)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-hairline bg-white px-3 text-[12.5px] font-medium text-ink hover:border-accent hover:bg-accent hover:text-white transition"
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </article>
  );
}
