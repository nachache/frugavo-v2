"use client";

// WatchdogOverlay — the "Frugavo found this while you were sleeping"
// reveal that plays on dashboard return visits when notable events
// have occurred since the user's last watchdog view.
//
// Same architectural pattern as ScanRevealOverlay:
//   - Full-screen portal modal, dark scrim, brand halo
//   - Auto-shows once per render when `digest` is present
//   - Dismiss via scrim click, Escape key, or the explicit CTA
//   - On dismiss → POST /api/watchdog/seen so it doesn't reappear
//     until something new happens
//
// Choreography is calmer than the scan reveal — this is a return
// visit, not a first-impression. No confetti, no count-up animation.
// Goal is "we did the work while you were away" warmth, not climax.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Shield,
  TrendingUp,
  Eye,
  Scissors,
  CornerDownLeft,
} from "lucide-react";
import type { WatchdogDigest, WatchdogVerb } from "@/lib/watchdog/digest";

type Props = {
  digest: WatchdogDigest;
};

export function WatchdogOverlay({ digest }: Props) {
  // localStorage gate: the overlay shows once per browser session
  // even if the page is reloaded before the user dismisses. Prevents
  // a flash on every refresh during dev. Cleared on dismiss + when
  // the digest changes (the seen-at bump invalidates the digest
  // server-side on the next render).
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    // Show on mount. The parent only renders this component when
    // the digest is non-null so there's nothing to guard here.
    const flag = `frugavo:watchdog:${digest.since_iso}`;
    if (typeof window !== "undefined" && window.sessionStorage?.getItem(flag)) {
      return;
    }
    setVisible(true);
  }, [digest.since_iso]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    // Mark seen client-side immediately so a navigation back to /app
    // won't re-trigger; the server fetch follows fire-and-forget.
    if (typeof window !== "undefined") {
      window.sessionStorage?.setItem(
        `frugavo:watchdog:${digest.since_iso}`,
        "1"
      );
    }
    fetch("/api/watchdog/seen", { method: "POST" }).catch(() => {
      // Best-effort. If the network blip eats the request, the worst
      // case is the overlay shows once more on next render.
    });
  }

  if (typeof window === "undefined") return null;

  const headline =
    digest.total_events === 1
      ? "We caught 1 thing"
      : `We caught ${digest.total_events} things`;

  const content = (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="watchdog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="fixed inset-0 z-[280] flex items-center justify-center bg-ink/85 backdrop-blur-md"
          onClick={dismiss}
        >
          {/* Brand halo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(16,185,129,0.16), transparent 55%)",
            }}
          />

          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative w-[min(560px,92vw)] px-6 md:px-9 py-7 md:py-9 rounded-3xl bg-canvas/[0.05] border border-canvas/15"
          >
            {/* Shield + eyebrow */}
            <div className="flex items-center gap-2.5 justify-center">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand/20">
                <Shield size={16} className="text-brand" strokeWidth={2.2} />
              </span>
              <div className="text-[11px] md:text-[12px] font-medium uppercase tracking-[0.18em] text-canvas/65">
                While you were away
              </div>
            </div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-5 text-center"
            >
              <div className="font-display font-bold text-canvas text-[32px] md:text-[44px] leading-[1.05] tracking-[-0.02em]">
                {headline}
              </div>
              <div className="mt-2 text-[13px] md:text-[14.5px] text-canvas/70">
                {digest.since_label}
              </div>
            </motion.div>

            {/* Dollar context line (only when non-zero) */}
            {(digest.caught_cents > 0 || digest.flagged_cents > 0) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                className="mt-3 text-center text-[12.5px] md:text-[13px] text-canvas/65"
              >
                {digest.caught_cents > 0 && (
                  <span>
                    Saved you{" "}
                    <span className="text-brand font-medium">
                      ${Math.round(digest.caught_cents / 100).toLocaleString("en-US")}/yr
                    </span>
                  </span>
                )}
                {digest.caught_cents > 0 && digest.flagged_cents > 0 && (
                  <span className="text-canvas/40"> · </span>
                )}
                {digest.flagged_cents > 0 && (
                  <span>
                    Flagged{" "}
                    <span className="text-canvas font-medium">
                      ${Math.round(digest.flagged_cents / 100).toLocaleString("en-US")}/yr
                    </span>{" "}
                    for review
                  </span>
                )}
              </motion.div>
            )}

            {/* Event list */}
            <div className="mt-7 space-y-2.5">
              {digest.top_events.map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ x: 24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    delay: 0.7 + i * 0.1,
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="flex items-start gap-3 rounded-xl bg-canvas/[0.04] border border-canvas/10 px-3.5 py-3"
                >
                  <VerbBadge verb={ev.verb} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] md:text-[14.5px] font-medium text-canvas leading-snug">
                      {ev.title}
                    </div>
                    <div className="mt-0.5 text-[12px] md:text-[12.5px] text-canvas/60 leading-snug">
                      {ev.detail}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.3 }}
              className="mt-7 flex flex-col-reverse sm:flex-row items-center justify-center gap-3"
            >
              <button
                type="button"
                onClick={dismiss}
                className="text-[13px] text-canvas/65 hover:text-canvas transition"
              >
                Close
              </button>
              <a
                href="/app/alerts"
                onClick={dismiss}
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-canvas text-ink text-[14px] font-semibold hover:bg-canvas/90 transition w-full sm:w-auto"
              >
                See everything
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
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

function VerbBadge({ verb }: { verb: WatchdogVerb }) {
  const base =
    "inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0";
  switch (verb) {
    case "flagged":
      return (
        <span className={`${base} bg-amber-400/20 text-amber-300`}>
          <TrendingUp size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "stopped":
      return (
        <span className={`${base} bg-brand/20 text-brand`}>
          <CornerDownLeft size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "caught":
      return (
        <span className={`${base} bg-blue-400/20 text-blue-300`}>
          <Eye size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    case "pruned":
      return (
        <span className={`${base} bg-rose-400/20 text-rose-300`}>
          <Scissors size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      );
    default:
      return null;
  }
}
