"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { BrandLogo, type BrandKey } from "@/components/marketing/brand-logo";

// LiveDemoCard — the hero's animated narrative inside a clean
// window chrome (no phone frame, no auto-cursor, no platform-
// specific styling). Reads as a generic product UI so the visitor
// understands Frugavo runs on mobile AND desktop.
//
// Sequence (~13.8s loop):
//
//   1. SCANNING (2.8s)   — pulsing brand-ring + cycling phase
//      labels + progress bar.
//   2. RESULTS (3.5s)    — 5 subscription rows stagger in, total
//      counts up, 2 rows get flagged "Forgotten".
//   3. SELECTED (1.6s)   — the Adobe trial row picks up a brand
//      ring + subtle scale-up (no auto-cursor — the highlight
//      itself communicates "we're acting on this row").
//   4. CANCELLING (2.4s) — Cancel-assist sheet slides up. Button
//      morphs from black "Open cancel page" → brand-green
//      "Cancelled — confirmed" + check.
//   5. CELEBRATING (3.5s)— backdrop dims, seedling grows from
//      soil, "+$275.88/yr saved" counts up, confetti burst.
//
// Then loops back to SCANNING.
//
// prefers-reduced-motion pins the view to the RESULTS frame
// statically — no loop, no movement, no confetti.

type Phase =
  | "scanning"
  | "results"
  | "selected"
  | "cancelling"
  | "celebrating";

const PHASES: { name: Phase; ms: number }[] = [
  { name: "scanning",    ms: 2800 },
  { name: "results",     ms: 3500 },
  { name: "selected",    ms: 1600 },
  { name: "cancelling",  ms: 2400 },
  { name: "celebrating", ms: 3500 },
];

const SCAN_STEPS = [
  "Connecting securely",
  "Reading 12 months",
  "Spotting forgotten charges",
];

type Sub = {
  id: string;
  brand: BrandKey;
  name: string;
  detail: string;
  amount: number;
  forgotten?: boolean;
  target?: boolean;
};

const SUBS: Sub[] = [
  { id: "1", brand: "netflix", name: "Netflix",    detail: "Streaming",            amount: 22.99 },
  { id: "2", brand: "spotify", name: "Spotify",    detail: "Music",                amount: 11.99 },
  { id: "3", brand: "adobe",   name: "Adobe CC",   detail: "Trial → $59.99 Fri",   amount: 22.99, forgotten: true, target: true },
  { id: "4", brand: "amazon",  name: "Amazon",     detail: "Prime annual",         amount: 14.99 },
  { id: "5", brand: "unknown", name: "Paddle.net", detail: "Unknown merchant",     amount: 24.00, forgotten: true },
];

const TOTAL_MO = SUBS.reduce((s, x) => s + x.amount, 0);
const FORGOTTEN_TOTAL = SUBS.filter((x) => x.forgotten).reduce(
  (s, x) => s + x.amount,
  0
);
const ADOBE_ANNUAL = 22.99 * 12;

export function LiveDemoCard() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [loopCount, setLoopCount] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const idx = PHASES.findIndex((p) => p.name === phase);
    const ms = PHASES[idx]?.ms ?? 3000;
    const t = setTimeout(() => {
      const next = PHASES[(idx + 1) % PHASES.length].name;
      if (next === "scanning") setLoopCount((n) => n + 1);
      setPhase(next);
    }, ms);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const effectivePhase: Phase = reduced ? "results" : phase;

  return (
    <div
      className="relative w-full mx-auto"
      style={{ minHeight: 460, maxWidth: 440 }}
      aria-label="Live demo of Frugavo scanning your accounts, finding subscriptions, cancelling Adobe, and showing the savings."
    >
      {/* Soft brand-green ambient halo behind the window */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div
          className="w-[88%] h-[78%] rounded-[42%] blur-3xl opacity-90"
          style={{
            background:
              "radial-gradient(60% 60% at 45% 40%, rgba(4,120,87,0.28), rgba(245,158,11,0.10) 55%, rgba(245,158,11,0) 75%)",
          }}
        />
      </div>

      <WindowFrame phase={effectivePhase} loopKey={loopCount} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WINDOW FRAME
// ─────────────────────────────────────────────────────────────────

function WindowFrame({ phase, loopKey }: { phase: Phase; loopKey: number }) {
  return (
    <div className="relative mx-auto rounded-2xl bg-white border border-hairline shadow-[0_30px_70px_-20px_rgba(10,10,10,0.22),0_8px_20px_-6px_rgba(10,10,10,0.10)] overflow-hidden">
      {/* Title bar — macOS-style traffic lights + app label.
          Universally readable as "a product window," neither mobile
          nor desktop-specific. */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hairline/60 bg-ink/[0.015]">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="ml-2 text-[11px] font-semibold text-ink-body/70 tracking-tight">
          Frugavo
        </div>
        <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2 py-0.5">
          <motion.span
            className="inline-block w-1.5 h-1.5 rounded-full bg-brand"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.55, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <span className="text-[9px] font-semibold text-brand uppercase tracking-[0.1em]">
            Live
          </span>
        </div>
      </div>

      {/* Body — fixed height so phases swap without layout jump */}
      <div className="relative" style={{ height: 420 }}>
        <AnimatePresence mode="wait">
          {phase === "scanning" && (
            <ScanningView key={`scan-${loopKey}`} />
          )}
          {(phase === "results" ||
            phase === "selected" ||
            phase === "cancelling") && (
            <ResultsView key={`results-${loopKey}`} phase={phase} />
          )}
          {phase === "celebrating" && (
            <CelebratingView key={`celebrate-${loopKey}`} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCANNING VIEW
// ─────────────────────────────────────────────────────────────────

function ScanningView() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setStepIdx((i) => (i + 1) % SCAN_STEPS.length);
    }, 900);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex flex-col items-center justify-center px-8"
    >
      {/* Pulsing ring + central brand dot */}
      <div className="relative w-20 h-20 mb-5">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-brand/30"
          animate={{ scale: [1, 1.5, 1.5], opacity: [0.8, 0, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-brand/40"
          animate={{ scale: [1, 1.5, 1.5], opacity: [0.8, 0, 0] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.5,
          }}
        />
        <div className="absolute inset-3 rounded-full bg-brand flex items-center justify-center">
          <Sparkles size={22} className="text-white" strokeWidth={2.4} aria-hidden />
        </div>
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-body/70">
        Scanning
      </div>

      {/* Cycling phase label */}
      <div className="h-6 mt-2 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-[15px] font-semibold text-ink"
          >
            {SCAN_STEPS[stepIdx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="mt-6 w-full max-w-[240px] h-1.5 rounded-full bg-ink/[0.06] overflow-hidden">
        <motion.div
          className="h-full bg-brand rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RESULTS VIEW
// ─────────────────────────────────────────────────────────────────

function ResultsView({ phase }: { phase: Phase }) {
  const showHighlight = phase === "selected" || phase === "cancelling";
  const showSheet = phase === "cancelling";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-hairline/40">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-body/80">
          Your subscriptions
        </div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-1 flex items-baseline gap-2 flex-wrap"
        >
          <span className="font-display text-[26px] font-bold tracking-[-0.025em] text-ink leading-none tnum">
            ${TOTAL_MO.toFixed(2)}
          </span>
          <span className="text-[12px] text-ink-body">/mo</span>
          <span className="text-[11px] text-ink-body/85">
            · {SUBS.length} detected
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 ring-1 ring-amber-200/70 px-2.5 py-1 text-[10.5px] font-semibold text-amber-900"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" aria-hidden />
          2 forgotten · ${FORGOTTEN_TOTAL.toFixed(2)}/mo
        </motion.div>
      </div>

      {/* Subscription rows */}
      <div className="px-3 pt-3 space-y-1.5 flex-1 overflow-hidden">
        {SUBS.map((sub, i) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.18 + i * 0.13,
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <SubRow
              sub={sub}
              highlighted={!!sub.target && showHighlight}
            />
          </motion.div>
        ))}
      </div>

      {/* Cancel sheet slides up from bottom during cancelling phase */}
      <AnimatePresence>
        {showSheet && <CancelSheet />}
      </AnimatePresence>
    </motion.div>
  );
}

function SubRow({ sub, highlighted }: { sub: Sub; highlighted?: boolean }) {
  return (
    <motion.div
      animate={highlighted ? { scale: 1.02 } : { scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={
        "flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-all " +
        (highlighted
          ? "border-brand bg-brand/[0.06] ring-2 ring-brand/25 shadow-sm"
          : sub.forgotten
            ? "border-amber-200 bg-amber-50/50"
            : "border-hairline/50 bg-white")
      }
    >
      <BrandLogo brand={sub.brand} size={28} rounded="lg" />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-ink truncate">
          {sub.name}
        </div>
        <div className="text-[10.5px] text-ink-body/85 truncate">
          {sub.detail}
        </div>
      </div>
      <div className="text-[12px] font-semibold text-ink tnum shrink-0">
        ${sub.amount.toFixed(2)}
      </div>
    </motion.div>
  );
}

function CancelSheet() {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setConfirmed(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-white border-t-2 border-hairline shadow-[0_-12px_30px_-12px_rgba(10,10,10,0.18)] px-5 py-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          Cancel-assist
        </div>
      </div>
      <div className="text-[13.5px] font-semibold text-ink leading-tight">
        Cancel Adobe CC
      </div>
      <div className="text-[11px] text-ink-body mt-0.5">
        Direct link to Adobe&apos;s cancel page
      </div>

      <motion.button
        type="button"
        tabIndex={-1}
        animate={
          confirmed
            ? { backgroundColor: "#047857" }
            : { backgroundColor: "#0a0a0a" }
        }
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full text-white text-[12px] font-semibold h-9"
      >
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.span
              key="confirmed"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5"
            >
              <Check size={13} strokeWidth={3} />
              Cancelled — confirmed
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1.5"
            >
              Open Adobe cancel page
              <ExternalLink size={11} strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CELEBRATING VIEW
// ─────────────────────────────────────────────────────────────────

function CelebratingView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 bg-gradient-to-b from-brand/[0.05] via-canvas to-amber-50/30"
    >
      <Confetti />
      <Seedling />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-900/70"
      >
        Pruned · Adobe CC
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: 0.7,
          duration: 0.5,
          type: "spring",
          stiffness: 280,
          damping: 16,
        }}
        className="mt-2 flex items-baseline gap-1 tnum"
      >
        <span className="font-display text-[40px] font-bold text-brand leading-none">
          +${ADOBE_ANNUAL.toFixed(2)}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95, duration: 0.4 }}
        className="mt-1 text-[12px] text-emerald-900/75 font-medium"
      >
        saved per year
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white border border-hairline px-3 py-1.5 text-[11px] text-ink-body"
      >
        <CheckCircle2 size={11} strokeWidth={2.5} className="text-brand" />
        Frugavo will confirm via your bank
      </motion.div>
    </motion.div>
  );
}

function Seedling() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 56 56"
      className="mx-auto"
      aria-hidden="true"
    >
      <motion.ellipse
        cx="28"
        cy="48"
        rx="16"
        ry="3"
        fill="#A78BFA1A"
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.25 }}
        style={{ transformOrigin: "28px 48px" }}
      />
      <motion.line
        x1="28"
        y1="48"
        x2="28"
        y2="24"
        stroke="#047857"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
      />
      <motion.path
        d="M28 32 C 18 28, 14 22, 18 18 C 22 22, 28 28, 28 32 Z"
        fill="#10B981"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.55,
          type: "spring",
          stiffness: 280,
          damping: 14,
        }}
        style={{ transformOrigin: "28px 32px" }}
      />
      <motion.path
        d="M28 26 C 38 22, 42 16, 38 12 C 34 16, 28 22, 28 26 Z"
        fill="#34D399"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.7,
          type: "spring",
          stiffness: 280,
          damping: 14,
        }}
        style={{ transformOrigin: "28px 26px" }}
      />
    </svg>
  );
}

const CONFETTI_COLORS = [
  "#047857",
  "#10B981",
  "#34D399",
  "#F59E0B",
  "#FB7185",
];

function Confetti() {
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.3;
    const distance = 70 + Math.random() * 50;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      rotation: Math.random() * 540 - 270,
      size: 4 + Math.random() * 4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.1,
    };
  });

  return (
    <div
      className="absolute top-1/2 left-1/2 pointer-events-none"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{
            x: p.x,
            y: p.y + 70,
            opacity: [0, 1, 1, 0],
            scale: 1,
            rotate: p.rotation,
          }}
          transition={{
            duration: 1.5,
            delay: p.delay,
            ease: [0.16, 1, 0.3, 1],
            opacity: { times: [0, 0.15, 0.7, 1] },
          }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            borderRadius: 1,
            top: 0,
            left: 0,
          }}
        />
      ))}
    </div>
  );
}
