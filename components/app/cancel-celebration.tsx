"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/utils";

// The "you just cancelled something — feel good about it" moment.
//
// Triggered after the user hits "I cancelled it" in CancelModal. Three
// layered effects:
//   1. A centered savings card that springs in: "+$XXX saved /yr" with a
//      growing seedling icon (garden theme).
//   2. A 60-particle confetti burst behind the card. Emerald and amber
//      shades, gravity-driven via Framer Motion.
//   3. Auto-dismiss after 1.8s — never gets in the way of the next click.
//
// Pure visual; the actual API call + state flip happens in CancelModal
// and SubscriptionList. We just play the show.

type Props = {
  annualSaved: number; // dollars per year saved (not cents)
  merchant: string;
  visible: boolean;
  onDone: () => void;
};

const PARTICLE_COUNT = 56;
const COLORS = ["#047857", "#10B981", "#34D399", "#F59E0B", "#FB7185", "#A78BFA"];

type Particle = {
  id: number;
  angle: number;
  distance: number;
  rotation: number;
  size: number;
  color: string;
  delay: number;
};

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.4;
    const distance = 140 + Math.random() * 120;
    return {
      id: i,
      angle,
      distance,
      rotation: Math.random() * 720 - 360,
      size: 6 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.08,
    };
  });
}

export function CancelCelebration({
  annualSaved,
  merchant,
  visible,
  onDone,
}: Props) {
  const timer = useRef<NodeJS.Timeout | null>(null);
  // Re-roll the particles only when visibility flips on so each cancel
  // gets a slightly different burst.
  const particles = useMemo(() => (visible ? generateParticles() : []), [visible]);

  useEffect(() => {
    if (!visible) return;
    timer.current = setTimeout(onDone, 1_800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
        >
          {/* Confetti burst — particles fly outward from center then drop. */}
          {particles.map((p) => {
            const x = Math.cos(p.angle) * p.distance;
            const y = Math.sin(p.angle) * p.distance;
            return (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  x,
                  y: y + 180, // gravity pulls particles down past target
                  opacity: [0, 1, 1, 0],
                  scale: 1,
                  rotate: p.rotation,
                }}
                transition={{
                  duration: 1.4,
                  delay: p.delay,
                  ease: [0.16, 1, 0.3, 1],
                  opacity: { times: [0, 0.1, 0.7, 1] },
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

          {/* Center savings card */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -16 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
              mass: 0.7,
            }}
            className="bg-white rounded-3xl shadow-lift border border-brand/20 px-7 py-6 text-center max-w-[320px]"
          >
            <SeedlingIcon />
            <div className="mt-3 text-[11.5px] uppercase tracking-[0.16em] font-semibold text-emerald-900/70">
              Pruned · {merchant}
            </div>
            <div className="mt-2 flex items-baseline justify-center gap-1.5 tnum">
              <span className="text-[36px] font-display font-bold leading-none text-brand">
                +{formatCurrency(annualSaved, false)}
              </span>
            </div>
            <div className="mt-1 text-[12.5px] text-emerald-900/70">
              saved per year
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// A small SVG seedling that "grows" — leaves scale in with a stagger.
function SeedlingIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      className="mx-auto"
      aria-hidden
    >
      {/* Soil */}
      <ellipse cx="28" cy="48" rx="16" ry="3" fill="#A78BFA1A" />
      {/* Stem */}
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
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      {/* Left leaf */}
      <motion.path
        d="M28 32 C 18 28, 14 22, 18 18 C 22 22, 28 28, 28 32 Z"
        fill="#10B981"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 280, damping: 14 }}
        style={{ transformOrigin: "28px 32px" }}
      />
      {/* Right leaf */}
      <motion.path
        d="M28 26 C 38 22, 42 16, 38 12 C 34 16, 28 22, 28 26 Z"
        fill="#34D399"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 280, damping: 14 }}
        style={{ transformOrigin: "28px 26px" }}
      />
    </svg>
  );
}
