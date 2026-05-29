"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// PullToRefresh — touch-driven overscroll at top of the dashboard.
//
// Only active in standalone (installed PWA) mode. Browser users
// don't get it because the browser already owns the pull-to-refresh
// gesture (which we'd be fighting). Detected via the .is-standalone
// class on <html> at mount time.
//
// Threshold logic:
//   • User must be at scrollTop = 0 when the touch starts.
//   • Pull distance is captured from touchmove deltaY (clamped to a
//     resistance curve so it doesn't fly off the top of the screen).
//   • At PULL_RELEASE_THRESHOLD (78px), the release triggers a
//     re-scan. Below threshold, releases just snap back.
//   • A small inline indicator appears at the top of the page during
//     pull and during refresh.
//
// Re-scan path: POST /api/plaid/scan (existing endpoint). Returns
// immediately; the dashboard's Plaid webhook + IngestionState will
// re-render with fresh data on next /app load. We trigger a
// router.refresh() once the request resolves so the current view
// picks up any new data.
//
// Non-fatal: any failure (no permission, network blip) logs and
// snaps back without surfacing an error to the user — pulldown
// gestures should never feel like they fail.

const PULL_RELEASE_THRESHOLD = 78;
const PULL_MAX_DISTANCE = 140;
const RESISTANCE_FACTOR = 0.42;

export function PullToRefresh() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  // Activate only inside an installed PWA. We re-check on every
  // mount because the matchMedia state can change mid-session
  // (e.g. user installs while on /app).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const iosStandalone =
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    const isStandalone = (mq && mq.matches) || iosStandalone;
    setEnabled(Boolean(isStandalone));
    if (mq?.addEventListener) {
      const handler = () => setEnabled(mq.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Touch lifecycle. We attach to the document so any touch in the
  // viewport counts, then filter by scrollTop=0 on touchstart.
  useEffect(() => {
    if (!enabled) return;

    function onTouchStart(e: TouchEvent) {
      // Only engage when the page is scrolled all the way up.
      if (window.scrollY > 0) return;
      // Ignore multi-touch gestures (pinch, etc.).
      if (e.touches.length > 1) return;
      startYRef.current = e.touches[0].clientY;
      activeRef.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!activeRef.current || startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        // User is scrolling up (or hasn't moved past start). Reset.
        setPullPx(0);
        return;
      }
      // Apply resistance so pulling feels weighted instead of linear.
      const eased = Math.min(
        PULL_MAX_DISTANCE,
        Math.pow(dy, 1.0) * RESISTANCE_FACTOR
      );
      setPullPx(eased);
    }

    async function onTouchEnd() {
      if (!activeRef.current) return;
      activeRef.current = false;
      startYRef.current = null;
      const armed = pullPx >= PULL_RELEASE_THRESHOLD;
      // Snap back regardless.
      setPullPx(0);
      if (armed && !refreshing) {
        await triggerRefresh();
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshing, pullPx]);

  async function triggerRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/plaid/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "pull_to_refresh" }),
      });
    } catch {
      /* swallow */
    } finally {
      // Give the spinner a beat so the user perceives the refresh,
      // then refresh the route to pick up any new data.
      setTimeout(() => {
        setRefreshing(false);
        router.refresh();
      }, 900);
    }
  }

  if (!enabled) return null;

  // Visual indicator. Mounted at fixed top-center; sits behind the
  // sticky header until the pull distance exceeds header height,
  // then peeks out below it.
  const armed = pullPx >= PULL_RELEASE_THRESHOLD;
  const progress = Math.min(1, pullPx / PULL_RELEASE_THRESHOLD);
  const isVisible = pullPx > 4 || refreshing;
  const translate = refreshing ? 24 : Math.min(40, pullPx * 0.55);

  return (
    <div
      aria-hidden={!isVisible}
      className="fixed top-[64px] left-0 right-0 z-30 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${translate}px)`,
        opacity: isVisible ? 1 : 0,
        transition: refreshing
          ? "transform 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms"
          : pullPx === 0
            ? "transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms"
            : "none",
      }}
    >
      <div
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 h-8 text-[12px] font-medium shadow-soft"
        style={{
          color: armed || refreshing ? "var(--brand-green)" : "var(--ink-muted)",
        }}
      >
        <RefreshCw
          size={13}
          strokeWidth={2.2}
          className={refreshing ? "animate-spin" : ""}
          style={{
            transform: refreshing ? undefined : `rotate(${progress * 180}deg)`,
            transition: refreshing
              ? undefined
              : "transform 80ms linear",
          }}
        />
        <span>
          {refreshing
            ? "Refreshing your analysis…"
            : armed
              ? "Release to refresh"
              : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
