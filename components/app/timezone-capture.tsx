"use client";

// Invisible client component — fires the browser timezone to
// /api/user/timezone on dashboard mount.
//
// The daily monitoring cron uses the stored timezone to decide which
// users to sweep each hour ("which timezone just hit 6am?"). Without
// this, every user sits at the America/New_York default forever and
// West Coast users get pinged at 3am their local time.
//
// We sessionStorage-cache the result for the tab so we don't hit the
// endpoint on every page navigation; the endpoint itself also no-ops
// when the value hasn't changed, so worst-case is one cheap DB read.

import { useEffect } from "react";

const SESSION_KEY = "frugavo:tz-sent";

export function TimezoneCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    let tz: string | null = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      tz = null;
    }
    if (!tz) return;
    fetch("/api/user/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    })
      .then(() => sessionStorage.setItem(SESSION_KEY, "1"))
      .catch(() => {
        // best-effort — cron falls back to America/New_York
      });
  }, []);
  return null;
}
