"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ScanPhase } from "@/lib/types/scan";

// Three-state progress arc. Replaces a spinner: the label changes on a
// real timer so the user feels motion even when the network is flat
// (spec section 1).
//
// Phase mapping:
//   0–1500ms      Connecting
//   1500–5000ms   Reading transactions
//   5000ms+       Spotting patterns
//
// The parent can also force a phase via `phase` prop (e.g. driven by SSE
// `progress` events). Forced phase always wins over the timer.

type Props = {
  phase?: ScanPhase | null;
  className?: string;
};

const PHASE_LABEL: Record<ScanPhase, string> = {
  connecting: "Connecting securely",
  reading: "Reading transactions",
  spotting: "Spotting patterns",
};

export function ProgressArc({ phase, className }: Props) {
  const [autoPhase, setAutoPhase] = useState<ScanPhase>("connecting");

  useEffect(() => {
    const t1 = setTimeout(() => setAutoPhase("reading"), 1_500);
    const t2 = setTimeout(() => setAutoPhase("spotting"), 5_000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const current: ScanPhase = phase ?? autoPhase;

  // SVG arc: 0–360 degrees, dasharray animates. We use a long, slow
  // sweep so it never resolves — completion is signaled by the parent
  // unmounting the arc, not by hitting 100%.
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={PHASE_LABEL[current]}
    >
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-ink/[0.08]"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            className="text-brand origin-center animate-[arc-sweep_2.4s_linear_infinite]"
            strokeDasharray="60 600"
          />
        </svg>
      </div>

      <div className="text-center">
        <div className="text-[12px] uppercase tracking-[0.18em] font-semibold text-ink-muted">
          Step {current === "connecting" ? 1 : current === "reading" ? 2 : 3}{" "}
          of 3
        </div>
        <div className="mt-1.5 text-[18px] font-display font-semibold text-ink">
          {PHASE_LABEL[current]}
        </div>
      </div>

      <style jsx>{`
        @keyframes arc-sweep {
          to {
            stroke-dashoffset: -660;
          }
        }
      `}</style>
    </div>
  );
}
