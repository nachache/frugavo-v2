"use client";

import { useEffect } from "react";

// Conditional GA4 debug-mode activator.
//
// GA4 only treats a session as "debug" — visible in Admin → DebugView —
// when gtag has been called with config { debug_mode: true }, or when
// Google Tag Assistant / the GA Debugger Chrome extension is active. A
// query-string parameter alone doesn't do anything.
//
// This component flips debug mode on when ?ga_debug=1 is present in the
// URL. It re-issues the GA4 config call with debug_mode: true after gtag
// has loaded. The re-config is idempotent — events fired afterward carry
// the debug flag and show up in DebugView.
//
// Strip ?ga_debug=1 before sharing URLs publicly so debug events don't
// pollute production data.

// We intentionally do NOT augment the global Window type here.
// @next/third-parties already declares window.gtag in its own types and
// declaring it again with a slightly different signature causes a
// TypeScript build failure. Instead, we cast window at the call site.
type GtagWindow = Window & {
  gtag?: (command: string, target: string, params?: Record<string, unknown>) => void;
};

export function GaDebug({ gaId }: { gaId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("ga_debug") !== "1") return;

    const w = window as GtagWindow;

    // Wait briefly for gtag.js to finish loading before re-issuing config.
    const tryEnable = () => {
      if (typeof w.gtag === "function") {
        w.gtag("config", gaId, { debug_mode: true });
        return true;
      }
      return false;
    };

    if (tryEnable()) return;
    const interval = window.setInterval(() => {
      if (tryEnable()) window.clearInterval(interval);
    }, 200);
    // Give up after 5 seconds if gtag never loads (e.g. blocked).
    const timeout = window.setTimeout(() => window.clearInterval(interval), 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [gaId]);

  return null;
}
