"use client";

import { motion } from "framer-motion";

// A subtle SVG-based confetti burst. We intentionally keep this restrained —
// the spec asks for "rewarding, not gratuitous". 14 chips, low gravity, fades
// in under a second.

const COLORS = ["#047857", "#34D399", "#EA580C", "#FED7AA", "#0A0A0A"];

function rand(seed: number) {
  // Deterministic per index so chip positions don't reflow on every render.
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function Confetti({ count = 16 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 80 + rand(i) * 60;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist - 30;
        const rot = (rand(i + 1) - 0.5) * 540;
        const color = COLORS[i % COLORS.length];
        const w = 6 + rand(i + 2) * 4;
        const h = 10 + rand(i + 3) * 6;

        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{ x, y, opacity: [0, 1, 1, 0], rotate: rot, scale: 1 }}
            transition={{
              duration: 1.1,
              ease: [0.16, 1, 0.3, 1],
              times: [0, 0.1, 0.7, 1],
            }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: w,
              height: h,
              borderRadius: 2,
              background: color,
              transformOrigin: "center",
            }}
          />
        );
      })}
    </div>
  );
}
