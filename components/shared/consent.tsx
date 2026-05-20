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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="consent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-[400px] z-[90] rounded-2xl bg-white p-5 shadow-float border border-hairline/60"
          role="dialog"
          aria-label="Cookie consent"
        >
          <h2 className="text-[15px] font-semibold text-ink">
            A little help understanding our visitors
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-body">
            We use Google Analytics to see how many people visit Frugavo and
            which pages they read. No ad tracking, no personal data sold. See
            our{" "}
            <Link
              href="/privacy"
              className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
            >
              privacy policy
            </Link>
            .
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => write("granted")}
              className="flex-1 inline-flex items-center justify-center h-9 rounded-full bg-ink text-white text-[13px] font-medium hover:bg-ink/85 transition"
            >
              Accept
            </button>
            <button
              onClick={() => write("denied")}
              className="flex-1 inline-flex items-center justify-center h-9 rounded-full border border-hairline bg-white text-ink text-[13px] font-medium hover:bg-ink/[0.04] transition"
            >
              Decline
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
