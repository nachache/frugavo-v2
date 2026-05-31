"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

// Lightweight consent banner + analytics gate.
//
// Architecture:
// - useConsent() reads the user's saved choice from localStorage and
//   subscribes to changes (so the banner + the gate stay in sync if you
//   ever expose a "revoke" link from /privacy).
// - <ConsentGate> wraps any tag that should only fire after consent (GA4,
//   future Meta Pixel, etc.). Children render only when state is "granted".
// - <ConsentBanner> renders the bottom-of-page card until the user picks.
//
// No third-party CMP. No tracking before consent. Three states only:
// "unknown" (banner shows), "granted" (gate opens), "denied" (gate stays
// closed and banner doesn't show again).

const STORAGE_KEY = "frugavo:consent";
const CHANGE_EVENT = "frugavo:consent-change";

export type ConsentState = "unknown" | "granted" | "denied";

function read(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    /* ignore */
  }
  return "unknown";
}

function write(value: "granted" | "denied") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

export function useConsent(): ConsentState {
  // SSR-safe: start as "unknown" on the server, hydrate on the client.
  const [state, setState] = useState<ConsentState>("unknown");

  useEffect(() => {
    setState(read());
    const handler = () => setState(read());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  return state;
}

export function ConsentGate({ children }: { children: ReactNode }) {
  const state = useConsent();
  if (state !== "granted") return null;
  return <>{children}</>;
}

export function ConsentBanner() {
  const state = useConsent();
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    // Slight delay so the banner doesn't flash up before the page itself
    // is on screen.
    const t = window.setTimeout(() => setDelayed(true), 800);
    return () => window.clearTimeout(t);
  }, []);

  const visible = delayed && state === "unknown";

  // Conversion-protective redesign: previously this card occupied
  // ~40% of mobile viewport and covered both the hero CTA and the
  // Clerk sign-up password field. We measured 0% conversion on
  // mobile paid traffic likely because of this. New design:
  //   • Mobile: thin sticky strip at the very bottom, ~64px tall.
  //     Inline buttons. Doesn't cover hero or forms.
  //   • Desktop: small floating card bottom-right, max 400px wide,
  //     compact padding. Same buttons, smaller footprint.
  // Same consent logic underneath; only the visual size changed.
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="consent"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-[360px] z-[90] bg-white border-t border-hairline sm:border sm:border-hairline/60 sm:rounded-2xl sm:shadow-float safe-area-bottom"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="px-4 py-3 sm:p-4 flex items-center gap-3 sm:flex-col sm:items-stretch">
            {/* Copy — single line on mobile, two lines on desktop */}
            <p className="text-[12px] sm:text-[12.5px] leading-snug text-ink-body flex-1 min-w-0">
              <span className="hidden sm:inline">
                We use Google Analytics to understand traffic. No ad tracking.{" "}
              </span>
              <span className="sm:hidden">
                Anonymous analytics only — no ad tracking.{" "}
              </span>
              <Link
                href="/privacy"
                className="text-emerald-900 underline underline-offset-2 hover:opacity-80"
              >
                Privacy
              </Link>
            </p>
            {/* Buttons — inline on mobile (compact), full-width on desktop */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 sm:mt-1">
              <button
                onClick={() => write("denied")}
                className="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:flex-1 rounded-full border border-hairline bg-white text-ink text-[12px] sm:text-[13px] font-medium hover:bg-ink/[0.04] transition fr-tactile"
              >
                Decline
              </button>
              <button
                onClick={() => write("granted")}
                className="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:flex-1 rounded-full bg-ink text-white text-[12px] sm:text-[13px] font-medium hover:bg-ink/85 transition fr-tactile"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
