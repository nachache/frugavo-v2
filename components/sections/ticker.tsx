"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ticker } from "@/lib/content";

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
        <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
          </span>
          Live
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
              Just cancelled: {ticker[i]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
