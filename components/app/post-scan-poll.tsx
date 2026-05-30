"use client";

// PostScanPoll — one-line quality reaction shown ~24h after a scan
// finished, on the next dashboard render. Single-tap 👍 🤷 👎 writes
// to events table via track(). Goes quiet for that scan id once
// answered.
//
// Why 24h: immediate-post-scan reactions are biased by the novelty
// of the reveal. After 24h the user has actually USED the dashboard
// and can judge whether the scan found anything useful.
//
// Gating logic:
//   1. Has a scan finished? (lastScanIso prop, server-provided)
//   2. Is the scan ≥24h old?
//   3. Is the scan ≤7 days old? (no point asking about a stale scan)
//   4. Has the user already answered this scan? (sessionStorage)
//   5. Has the user permanently dismissed polls? (localStorage)
//
// All five must pass before the chip renders.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { track } from "@/lib/learning/track";

const DISMISS_FOREVER_KEY = "frugavo:post-scan-poll:disabled";

export function PostScanPoll({
  lastScanIso,
}: {
  lastScanIso: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!lastScanIso) return;
    if (typeof window === "undefined") return;

    // Permanent dismiss check.
    if (window.localStorage.getItem(DISMISS_FOREVER_KEY)) return;

    const scanMs = new Date(lastScanIso).getTime();
    if (Number.isNaN(scanMs)) return;
    const ageMs = Date.now() - scanMs;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    if (ageMs < oneDayMs) return; // too soon
    if (ageMs > sevenDaysMs) return; // too stale

    // Per-scan dedupe — sessionStorage so it resets between browsers.
    const key = `frugavo:post-scan-poll:${lastScanIso}`;
    if (window.sessionStorage.getItem(key)) return;

    setVisible(true);
  }, [lastScanIso]);

  function answer(reaction: "helpful" | "neutral" | "noise") {
    if (!lastScanIso) return;
    track("post_scan_reaction", {
      scan_iso: lastScanIso,
      reaction,
    });
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        `frugavo:post-scan-poll:${lastScanIso}`,
        "1"
      );
    }
    setAnswered(true);
    // Auto-fade after thanks.
    setTimeout(() => setVisible(false), 1500);
  }

  function dismissForever() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_FOREVER_KEY, "1");
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="container-page max-w-[1200px] mt-2">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white border border-hairline shadow-soft px-3 h-9 text-[12px] text-ink">
        {answered ? (
          <span className="text-ink-muted">Thanks — noted.</span>
        ) : (
          <>
            <span className="text-ink-muted">
              Did the recent scan find anything useful?
            </span>
            <button
              type="button"
              onClick={() => answer("helpful")}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-ink/[0.05] transition fr-tactile"
              aria-label="Helpful"
            >
              👍
            </button>
            <button
              type="button"
              onClick={() => answer("neutral")}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-ink/[0.05] transition fr-tactile"
              aria-label="Meh"
            >
              🤷
            </button>
            <button
              type="button"
              onClick={() => answer("noise")}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-ink/[0.05] transition fr-tactile"
              aria-label="Not useful"
            >
              👎
            </button>
            <button
              type="button"
              onClick={dismissForever}
              aria-label="Don't ask again"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.05] transition ml-1"
            >
              <X size={11} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
