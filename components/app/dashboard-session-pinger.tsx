"use client";

import { useEffect, useRef } from "react";

// DashboardSessionPinger — fires the meaningful-session signal.
//
// Mounted at the top of the /app dashboard render. When the user
// satisfies EITHER condition, it POSTs /api/user/dashboard-session
// to stamp app_users.dashboard_first_session_at:
//
//   1. The page has been visible (not background-tabbed) for at
//      least DWELL_MS continuous-ish milliseconds. The timer pauses
//      while document.hidden so a left-open background tab doesn't
//      drift past the threshold without the user actually looking.
//
//   2. The user has actively interacted — click, scroll, or keydown.
//      First matching event wins. This catches the common case where
//      a user reads the dashboard, scrolls, decides what to do, and
//      acts quickly (under the dwell threshold).
//
// Either path fires the POST once, marks done locally, and removes
// all listeners. The server route is idempotent so a duplicate POST
// (from a race between the two paths) is harmless.
//
// alreadySet=true is the no-op short-circuit: the column is already
// populated on the server, no need to ping. Saves us a network call
// on every dashboard load for returning users.

const DWELL_MS = 12_000;

export function DashboardSessionPinger({
  alreadySet,
}: {
  alreadySet: boolean;
}) {
  // useRef so the latch survives re-renders without restarting the
  // timer. firedRef is the "have we already POSTed?" guard that
  // prevents double-fire if dwell + interaction race.
  const firedRef = useRef(false);

  useEffect(() => {
    if (alreadySet) return;
    if (firedRef.current) return;

    // ─── Dwell timer ──────────────────────────────────────────────
    // Counts only when document is visible. Tracks elapsed in a
    // running accumulator + lastResumeAt timestamp; on visibility
    // change we add the elapsed window to the accumulator and
    // either resume or pause.
    let accumMs = 0;
    let lastResumeAt: number | null =
      typeof document !== "undefined" && !document.hidden
        ? performance.now()
        : null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function fire(reason: "dwell" | "interaction") {
      if (firedRef.current) return;
      firedRef.current = true;
      cleanup();
      // Fire-and-forget; the route is idempotent + best-effort.
      // Use keepalive so a quick close after firing doesn't cancel
      // the request in flight.
      fetch("/api/user/dashboard-session", {
        method: "POST",
        keepalive: true,
      }).catch(() => {
        // Swallow — next /app load will retry via the pinger
        // mounting again with alreadySet=false.
      });
      // Diagnostic — useful when debugging grace-release behavior.
      // eslint-disable-next-line no-console
      console.info("[dashboard-session] stamped", { reason });
    }

    function scheduleDwellTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const remaining = DWELL_MS - accumMs;
      if (remaining <= 0) {
        fire("dwell");
        return;
      }
      timer = setTimeout(() => fire("dwell"), remaining);
    }

    function handleVisibilityChange() {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        // Pause — bank the elapsed time.
        if (lastResumeAt !== null) {
          accumMs += performance.now() - lastResumeAt;
          lastResumeAt = null;
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else {
        // Resume — restart the timer with the remaining window.
        lastResumeAt = performance.now();
        scheduleDwellTimer();
      }
    }

    // ─── Interaction signal ───────────────────────────────────────
    function handleInteraction() {
      fire("interaction");
    }

    // Kick off the dwell timer immediately if visible.
    if (typeof document !== "undefined" && !document.hidden) {
      scheduleDwellTimer();
    }

    // Bind listeners. Passive for scroll so we don't slow the page.
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });
    document.addEventListener("scroll", handleInteraction, {
      once: true,
      passive: true,
    });

    function cleanup() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("scroll", handleInteraction);
    }

    return cleanup;
  }, [alreadySet]);

  return null;
}
