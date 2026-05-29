"use client";

import { useEffect, useRef, useState } from "react";

// AnimatedNumber — eases a numeric value to the target instead of
// hard-swapping. Used wherever a dashboard number changes via user
// action (override → new monthly total, etc.) so the change feels
// alive rather than mechanical.
//
// Three render modes via `format`:
//   • 'integer'  — Math.round(value), thousands-separated
//   • 'currency' — "$X,XXX" (whole-dollar by default)
//   • 'plain'    — raw integer
//
// Animation:
//   • 700ms ease (cubic-bezier 0.16, 1, 0.3, 1)
//   • starts from the previous shown value (state) so successive
//     changes feel continuous
//   • respects prefers-reduced-motion: jumps to target immediately
//
// Used by IdentityHero, RenewingSoonCard, HealthScorePill, etc.

type Props = {
  value: number;
  format?: "integer" | "currency" | "plain";
  durationMs?: number;
  // Optional className passthrough for callers that want to inherit
  // typography from the parent.
  className?: string;
};

const DEFAULT_DURATION_MS = 700;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formatValue(v: number, format: Props["format"]): string {
  const rounded = Math.round(v);
  if (format === "currency") {
    return `$${rounded.toLocaleString("en-US")}`;
  }
  return rounded.toLocaleString("en-US");
}

export function AnimatedNumber({
  value,
  format = "integer",
  durationMs = DEFAULT_DURATION_MS,
  className,
}: Props) {
  const [shown, setShown] = useState<number>(value);
  const startValueRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (shown === value) return;

    // Reduced-motion shortcut: jump instantly.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }

    startValueRef.current = shown;
    const from = shown;
    const to = value;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      setShown(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // We intentionally only animate when `value` changes — not on
    // every shown tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return (
    <span className={className} aria-live="polite">
      {formatValue(shown, format)}
    </span>
  );
}
