"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Listens for 5 clicks on the wordmark within 2 seconds and pops an overlay.
// We attach via DOM event so the wordmark stays a plain anchor in the nav.

export function EasterEgg() {
  const [show, setShow] = useState(false);
  const clicks = useRef<number[]>([]);

  const onClick = useCallback(() => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2000), now];
    if (clicks.current.length >= 5) {
      setShow(true);
      clicks.current = [];
      setTimeout(() => setShow(false), 4000);
    }
  }, []);

  useEffect(() => {
    const el = document.querySelector("[data-frugavo-wordmark]");
    if (!el) return;
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [onClick]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-8 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-white shadow-float"
        >
          🎉 You've already saved enough for a fancy dinner.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
