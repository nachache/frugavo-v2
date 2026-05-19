"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ticker } from "@/lib/content";

// Was previously labeled "Live" with strings framed as recent real
// cancellations ("Just cancelled: M. ended Netflix · 2 min ago"). Frugavo is
// pre-launch so that was misleading social proof under both Google Ads and
// Meta Ads policy. Now clearly labeled as "Sample" with hypothetical framing.
export function Ticker() {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((v) => (v + 1) % ticker.length), 3000);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div className="border-y border-hairline/60 bg-white/40 py-3.5">
      <div className="container-page flex items-center gap-3 overflow-hidden">
        <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-body">
          Sample
        </span>
        <div className="relative h-5 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 text-[13px] text-ink-body truncate"
            >
              {ticker[i]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
