"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { heroDemoSubs } from "@/lib/content";
import { Monogram } from "@/components/ui/monogram";
import { cn, formatCurrency } from "@/lib/utils";

type Status = "idle" | "scanning" | "detected" | "cancelled";

// One row per subscription. Each row walks idle -> scanning -> detected ->
// cancelled at staggered offsets so the whole card feels like a working agent
// rather than a slideshow.
const ROW_DURATION = 1200; // ms between status transitions
const ROW_STAGGER = 600;   // ms between rows starting
const LOOP_PAUSE = 1400;   // ms pause after the last row before resetting

export function HeroDemoCard() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  // Continuous looping clock — increments roughly every 100ms. We derive each
  // row's status from elapsed time so adding/removing rows doesn't desync.
  const startedAt = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reduced) return;
    startedAt.current = performance.now();

    const totalLoop =
      heroDemoSubs.length * ROW_STAGGER + ROW_DURATION * 3 + LOOP_PAUSE;

    const loop = (now: number) => {
      const elapsed = (now - startedAt.current) % totalLoop;
      setTick(elapsed);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced]);

  const statusFor = (i: number): Status => {
    if (reduced) return "cancelled";
    const t = tick - i * ROW_STAGGER;
    if (t < 0) return "idle";
    if (t < ROW_DURATION) return "scanning";
    if (t < ROW_DURATION * 2) return "detected";
    return "cancelled";
  };

  const savedTotal = heroDemoSubs.reduce((acc, sub, i) => {
    return statusFor(i) === "cancelled" ? acc + sub.amount : acc;
  }, 0);

  return (
    <div className="relative">
      {/* perspective wrapper — slight 3D tilt sells the "floating panel" feel */}
      <div
        className="relative"
        style={{
          perspective: "1400px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, rotateX: 6, rotateY: -8 }}
          animate={{ opacity: 1, y: 0, rotateX: 2, rotateY: -4 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative rounded-3xl bg-white shadow-lift border border-hairline/60 overflow-hidden"
        >
          {/* top chrome bar */}
          <div className="flex items-center justify-between border-b border-hairline/60 px-5 py-3.5 bg-white">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="ml-3 text-[12px] font-medium text-ink-muted">
                frugavo · scan
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              Live
            </span>
          </div>

          {/* rows */}
          <div className="px-3 py-3">
            {heroDemoSubs.map((sub, i) => {
              const s = statusFor(i);
              return (
                <Row
                  key={sub.name}
                  name={sub.name}
                  mono={sub.mono}
                  color={sub.color}
                  amount={sub.amount}
                  status={s}
                />
              );
            })}
          </div>

          {/* running total */}
          <div className="flex items-center justify-between border-t border-hairline/60 bg-canvas/50 px-5 py-4">
            <span className="text-[13px] text-ink-muted">Saved this month</span>
            <span
              className="text-[18px] font-semibold text-brand tnum"
              key={Math.round(savedTotal * 100)}
            >
              <motion.span
                key={savedTotal.toFixed(2)}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="inline-block"
              >
                {formatCurrency(savedTotal)}/mo
              </motion.span>
            </span>
          </div>
        </motion.div>

        {/* floating notification card stacked behind */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -bottom-6 -left-6 hidden sm:flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-float border border-hairline/60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light">
            <Check size={16} className="text-brand" strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-[13px] font-medium text-ink">
              You'll save $1,847 this year
            </div>
            <div className="text-[12px] text-ink-muted">
              7 subscriptions cancelled
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Row({
  name,
  mono,
  color,
  amount,
  status,
}: {
  name: string;
  mono: string;
  color: string;
  amount: number;
  status: Status;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-300",
        status === "cancelled" && "bg-emerald-50/40"
      )}
    >
      <Monogram label={mono} color={color} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-ink truncate">{name}</div>
        <div className="text-[11.5px] text-ink-muted">Monthly · recurring</div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "text-[13.5px] font-semibold tnum transition-all duration-300",
            status === "cancelled"
              ? "text-ink-muted line-through"
              : "text-ink"
          )}
        >
          {formatCurrency(amount)}
        </span>
        <StatusPill status={status} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    idle: { label: "—", classes: "bg-ink/[0.04] text-ink-muted" },
    scanning: {
      label: "Scanning",
      classes: "bg-ink/[0.04] text-ink-muted",
    },
    detected: { label: "Detected", classes: "bg-blue-50 text-blue-700" },
    cancelled: { label: "Cancelled", classes: "bg-brand-light text-brand" },
  } as const;

  const { label, classes } = map[status];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium min-w-[78px] justify-center",
          classes
        )}
      >
        {status === "scanning" && (
          <Loader2 size={10} className="animate-spin" />
        )}
        {status === "cancelled" && <Check size={10} strokeWidth={3} />}
        {label}
      </motion.span>
    </AnimatePresence>
  );
}
