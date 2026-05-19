"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";

// Slim, dismissible banner stating that the site is a pre-launch preview.
// Dismissal is persisted in localStorage so we don't nag returning visitors.

const STORAGE_KEY = "frugavo:bannerDismissed";

export function LaunchBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    if (!dismissed) setOpen(true);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-[60] overflow-hidden bg-ink text-white"
          role="region"
          aria-label="Pre-launch notice"
        >
          <div className="container-page flex items-center justify-center gap-3 py-2.5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Preview
            </span>

            <p className="text-[12.5px] md:text-[13px] leading-snug">
              Frugavo is launching soon. Brands, numbers, and demos on this
              page are samples for illustration only.{" "}
              <a
                href="#cta"
                className="group inline-flex items-center gap-1 font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                Join the waitlist
                <ArrowRight
                  size={12}
                  className="transition group-hover:translate-x-0.5"
                />
              </a>
            </p>

            <button
              onClick={dismiss}
              aria-label="Dismiss preview notice"
              className="absolute right-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition"
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
