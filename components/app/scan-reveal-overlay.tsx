"use client";

// ScanRevealOverlay — the 3-4 second "ta-da" sequence that plays
// after every Re-scan (and can also be triggered on first scan from
// the welcome flow).
//
// Choreography:
//   0.0s  Overlay fades in. Dark scrim with a soft brand halo.
//   0.2s  Eyebrow "We just looked through everything…"
//   0.4s  Big monthly counter starts spinning up from $0 → target.
//   1.6s  Donut placeholder swings into view (svg arc draws around).
//   1.9s  Top 3 sub rows fly in, staggered 120ms each.
//   2.8s  Divider sweeps across.
//   3.0s  THE FINALE — "We found $X you could keep" types in, shimmer
//         + soft confetti burst. This is the screenshot moment.
//   3.4s  CTA appears: "Show me" (dismiss) or auto-dismiss at 5.0s.
//
// The whole thing is skippable — tap anywhere outside the savings
// number, or hit Escape, dismisses immediately.
//
// Determinism note: the counter uses requestAnimationFrame so it's
// silky on phones, but the FINAL number is the prop value. No
// network in this component.

import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dollarsToThing } from "@/lib/dollar-things";

type TopRow = {
  name: string;
  monthly_cents: number;
};

type Props = {
  visible: boolean;
  // The final numbers the reveal animates TO. Caller passes the
  // current dashboard totals; if the scan reveals different numbers
  // those will appear on the next render after dismiss.
  monthlyCents: number;
  annualSavingsCents: number;
  // First 3-5 subscriptions to animate in for the "rows arriving" beat.
  topRows: TopRow[];
  onDone: () => void;
};

// The reveal NEVER auto-dismisses. The user manually closes via the
// "See my dashboard" button (or by tapping anywhere outside the
// card / pressing Escape). 4.8s auto-dismiss was eating the verdict
// before users could read it.
const FINALE_LANDS_AT_MS = 4_600;

function fmtBig(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtRound(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function ScanRevealOverlay({
  visible,
  monthlyCents,
  annualSavingsCents,
  topRows,
  onDone,
}: Props) {
  // The dollar-to-things line for the savings finale.
  const savingsThing = useMemo(
    () => dollarsToThing(annualSavingsCents / 100),
    [annualSavingsCents]
  );

  // Escape-key dismiss only — no auto-close. After FINALE_LANDS_AT_MS
  // we reveal the explicit close button below the verdict so the user
  // has time to read the line before deciding to dismiss.
  const dismissedRef = useRef(false);
  const [finaleLanded, setFinaleLanded] = useState(false);
  useEffect(() => {
    if (!visible) {
      setFinaleLanded(false);
      return;
    }
    dismissedRef.current = false;
    const t = setTimeout(() => setFinaleLanded(true), FINALE_LANDS_AT_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dismissedRef.current) {
        dismissedRef.current = true;
        onDone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, onDone]);

  if (typeof window === "undefined") return null;

  const content = (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="scan-reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/85 backdrop-blur-md"
          onClick={() => {
            if (!dismissedRef.current) {
              dismissedRef.current = true;
              onDone();
            }
          }}
        >
          {/* Soft brand halo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 35%, rgba(16,185,129,0.18), transparent 55%)",
            }}
          />

          {/* Center card — clicks here don't dismiss, only the scrim does */}
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative w-[min(560px,92vw)] text-center px-6 md:px-10 py-8 md:py-10 rounded-3xl bg-canvas/[0.05] border border-canvas/15"
          >
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.18em] text-canvas/55"
            >
              We just looked through everything
            </motion.div>

            {/* Big counter */}
            <CountUpNumber
              targetCents={monthlyCents}
              startDelayMs={400}
              durationMs={1300}
              format={fmtBig}
              className="mt-4 md:mt-5 font-display font-bold text-canvas tabular-nums leading-none text-[56px] md:text-[80px] tracking-[-0.03em]"
              suffix={<span className="text-canvas/55 text-[24px] md:text-[32px] font-medium align-baseline">/mo</span>}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              className="mt-2 text-[12.5px] md:text-[14px] text-canvas/65"
            >
              monthly recurring
            </motion.div>

            {/* Top rows fly in */}
            <div className="mt-7 md:mt-9 space-y-2">
              {topRows.slice(0, 4).map((row, i) => (
                <motion.div
                  key={`${row.name}-${i}`}
                  initial={{ x: 32, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    delay: 1.7 + i * 0.12,
                    duration: 0.45,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="flex items-center justify-between text-canvas/85 text-[13.5px] md:text-[15px] px-1"
                >
                  <span className="truncate text-left">{row.name}</span>
                  <span className="tabular-nums text-canvas/65 ml-3 shrink-0">
                    {fmtRound(row.monthly_cents)}/mo
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Divider sweep */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 0.18 }}
              transition={{ delay: 2.7, duration: 0.5, ease: "easeOut" }}
              style={{ transformOrigin: "left center" }}
              className="mt-6 md:mt-8 h-px bg-canvas"
            />

            {/* FINALE — savings number lands */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.0, duration: 0.5, ease: "easeOut" }}
              className="mt-5 md:mt-6"
            >
              <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.18em] text-brand">
                Verdict
              </div>
              <div className="mt-2 text-[24px] md:text-[34px] font-display font-bold text-canvas leading-[1.1]">
                We found{" "}
                <span className="relative inline-block">
                  <CountUpNumber
                    inline
                    targetCents={annualSavingsCents}
                    startDelayMs={3100}
                    durationMs={900}
                    format={fmtRound}
                    className="text-brand"
                  />
                  <motion.span
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 0.5 }}
                    transition={{ delay: 3.95, duration: 0.5 }}
                    style={{ transformOrigin: "left center" }}
                    className="absolute -bottom-1 left-0 right-0 h-1 bg-brand/30 rounded-full"
                  />
                </span>{" "}
                you could keep.
              </div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 4.0, duration: 0.5 }}
                className="mt-2 text-[13px] md:text-[14.5px] text-canvas/70"
              >
                That's {savingsThing.label}.
              </motion.div>
            </motion.div>

            {/* Real CTA button — appears only after the finale lands,
                so the user has time to read the verdict before they
                can dismiss it. Click button (or click outside / press
                Escape) closes. */}
            {finaleLanded && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => {
                  if (!dismissedRef.current) {
                    dismissedRef.current = true;
                    onDone();
                  }
                }}
                className="mt-7 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-canvas text-ink text-[14px] font-semibold hover:bg-canvas/90 transition"
              >
                See my dashboard
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>
            )}
          </motion.div>

          {/* Soft confetti burst behind the savings line */}
          <ConfettiBurst delay={3.05} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

// ---------------------------------------------------------------------
// CountUpNumber — Framer Motion driven counter. Hits the target value
// silky-smooth even on phones.
// ---------------------------------------------------------------------
function CountUpNumber({
  targetCents,
  startDelayMs,
  durationMs,
  format,
  suffix,
  className,
  inline = false,
}: {
  targetCents: number;
  startDelayMs: number;
  durationMs: number;
  format: (cents: number) => string;
  suffix?: React.ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const value = useMotionValue(0);
  const display = useTransform(value, (v) => format(v));
  const [text, setText] = useState(format(0));

  useEffect(() => {
    const unsub = display.on("change", (v) => setText(v));
    const t = setTimeout(() => {
      animate(value, targetCents, {
        duration: durationMs / 1000,
        ease: [0.22, 1, 0.36, 1],
      });
    }, startDelayMs);
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [targetCents, startDelayMs, durationMs, value, display]);

  if (inline) {
    return <span className={className}>{text}</span>;
  }
  return (
    <div className={className}>
      {text}
      {suffix}
    </div>
  );
}

// ---------------------------------------------------------------------
// ConfettiBurst — small particle shower behind the savings finale.
// Smaller + softer than CancelCelebration's confetti (the reveal is
// the climax, but it's not a "you just won" moment yet).
// ---------------------------------------------------------------------
const CONFETTI_COLORS = ["#10b981", "#34d399", "#fbbf24", "#fb7185"];

function ConfettiBurst({ delay }: { delay: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        angle: (Math.PI * 2 * i) / 36 + Math.random() * 0.3,
        distance: 160 + Math.random() * 120,
        rotation: Math.random() * 720 - 360,
        size: 5 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        jitter: Math.random() * 0.1,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map((p) => {
        const x = Math.cos(p.angle) * p.distance;
        const y = Math.sin(p.angle) * p.distance;
        return (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{
              x,
              y: y + 220,
              opacity: [0, 1, 1, 0],
              scale: 1,
              rotate: p.rotation,
            }}
            transition={{
              delay: delay + p.jitter,
              duration: 1.6,
              ease: [0.16, 1, 0.3, 1],
              opacity: { times: [0, 0.08, 0.7, 1] },
            }}
            style={{
              position: "absolute",
              width: p.size,
              height: p.size * 0.4,
              background: p.color,
              borderRadius: 2,
            }}
          />
        );
      })}
    </div>
  );
}
