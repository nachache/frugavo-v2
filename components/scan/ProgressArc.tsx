"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ScanPhase } from "@/lib/types/scan";

// Cinematic three-state progress arc.
//
// HONESTY CONTRACT:
//   - `phase` is driven ENTIRELY by SSE `progress` events from the
//     engine. There is no wall-clock timer that auto-advances stages.
//   - When SSE hasn't delivered yet, we sit on "connecting" — honest
//     about silence rather than synthesizing fake motion.
//
// MOTION DESIGN:
//   - Outer ring sweeps continuously (the "engine is working" signal).
//     Doesn't advance toward 100%; completion is signalled by the
//     parent unmounting the arc.
//   - Inner counter-rotating ring + center pulse give a sense of
//     compound activity without faking progress.
//   - Three pips below the circle map 1:1 to the SSE phases. They fill
//     as real events arrive. The current pip pulses; passed pips are
//     solid; upcoming pips are hollow.
//   - When the phase prop changes, the label briefly fades out, the
//     text swaps, and the label fades back in. Single mounted node
//     for the label — no absolute positioning, no overlap risk
//     during the crossfade.

type Props = {
  phase?: ScanPhase | null;
  className?: string;
};

const PHASE_LABEL: Record<ScanPhase, string> = {
  connecting: "Connecting securely",
  reading: "Reading transactions",
  spotting: "Spotting patterns",
};

const PHASE_ORDER: ScanPhase[] = ["connecting", "reading", "spotting"];
const CROSSFADE_MS = 220;

export function ProgressArc({ phase, className }: Props) {
  const current: ScanPhase = phase ?? "connecting";
  const currentIdx = PHASE_ORDER.indexOf(current);

  // Single mounted label node. When `current` changes we fade it
  // out, swap the text, and fade it back in — using ONE node so
  // there's no chance of the entering and exiting labels stacking
  // on top of each other during the transition.
  const [displayPhase, setDisplayPhase] = useState<ScanPhase>(current);
  const [visible, setVisible] = useState(true);
  const lastPhaseRef = useRef<ScanPhase>(current);

  useEffect(() => {
    if (current === lastPhaseRef.current) return;
    lastPhaseRef.current = current;
    // Fade out, swap, fade in.
    setVisible(false);
    const swapT = window.setTimeout(() => {
      setDisplayPhase(current);
      // Force a frame between text swap and fade-in so the browser
      // applies the new text BEFORE re-revealing.
      requestAnimationFrame(() => setVisible(true));
    }, CROSSFADE_MS);
    return () => window.clearTimeout(swapT);
  }, [current]);

  const displayIdx = PHASE_ORDER.indexOf(displayPhase);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-7",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={PHASE_LABEL[current]}
    >
      {/* Composition: 3 stacked SVG layers + ambient halo */}
      <div className="relative h-32 w-32">
        {/* Ambient halo — soft brand-tinted radial behind the rings */}
        <div
          className="absolute inset-0 -m-6 rounded-full opacity-60 blur-2xl animate-[halo-breathe_3.2s_ease-in-out_infinite] pointer-events-none"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(16, 185, 129, 0.25), transparent 70%)",
          }}
          aria-hidden="true"
        />

        {/* Outer sweep ring — primary work indicator */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90 will-change-transform"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.9" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-ink/[0.06]"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="url(#arc-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            className="text-brand origin-center animate-[arc-sweep_1.8s_cubic-bezier(0.65,0,0.35,1)_infinite] will-change-transform"
            strokeDasharray="90 600"
          />
        </svg>

        {/* Inner counter-rotating ring — adds depth + compound motion */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full rotate-90 will-change-transform"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="30"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="3 15"
            className="text-brand/40 origin-center animate-[arc-counter_4.2s_linear_infinite] will-change-transform"
          />
        </svg>

        {/* Center pulse — quiet heartbeat */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="block h-2 w-2 rounded-full bg-brand animate-[pulse-dot_1.4s_ease-in-out_infinite]"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Step pips — real-event-bound. Pip i is FILLED when phase >= i,
          PULSING when phase === i, HOLLOW when ahead of current phase.
          Pure derivation from the phase prop — no timer. */}
      <div className="flex items-center gap-2.5" aria-hidden="true">
        {PHASE_ORDER.map((p, i) => {
          const passed = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <span
              key={p}
              className={cn(
                "block rounded-full transition-all duration-500 ease-out",
                passed && "h-1.5 w-1.5 bg-brand",
                isCurrent &&
                  "h-2 w-2 bg-brand animate-[pulse-dot_1.4s_ease-in-out_infinite]",
                !passed && !isCurrent && "h-1.5 w-1.5 bg-ink/15"
              )}
            />
          );
        })}
      </div>

      {/* Label + step counter. Single mounted node; opacity + small
          translate transitions on phase change. Fixed min-h reserves
          space so layout doesn't shift during the crossfade. */}
      <div className="text-center min-h-[56px]">
        <div
          className="transition-all ease-out"
          style={{
            transitionDuration: `${CROSSFADE_MS}ms`,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(4px)",
            filter: visible ? "blur(0)" : "blur(1.5px)",
          }}
        >
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-ink-muted">
            Step {displayIdx + 1} of 3
          </div>
          <div className="mt-1.5 text-[18px] font-display font-semibold text-ink">
            {PHASE_LABEL[displayPhase]}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes arc-sweep {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -690; }
        }
        @keyframes arc-counter {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
        @keyframes halo-breathe {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.08); opacity: 0.75; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global([class*="animate-[arc-sweep"]),
          :global([class*="animate-[arc-counter"]),
          :global([class*="animate-[halo-breathe"]) {
            animation-duration: 8s !important;
          }
          :global([class*="animate-[pulse-dot"]) {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
