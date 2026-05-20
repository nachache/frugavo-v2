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
    const flag = params.get("ga_debug");

    // Unconditional breadcrumb so we can verify the component mounted at
    // all. Visible in DevTools Console.
    // eslint-disable-next-line no-console
    console.log(
      `[GaDebug] mounted · gaId=${gaId} · ga_debug=${flag ?? "(absent)"}`
    );

    if (flag !== "1") return;

    const w = window as GtagWindow;

    const tryEnable = () => {
      if (typeof w.gtag === "function") {
        w.gtag("config", gaId, { debug_mode: true });
        // eslint-disable-next-line no-console
        console.log(`[GaDebug] debug_mode activated for ${gaId}`);
        return true;
      }
      return false;
    };

    if (tryEnable()) return;
    const interval = window.setInterval(() => {
      if (tryEnable()) window.clearInterval(interval);
    }, 200);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      // eslint-disable-next-line no-console
      console.warn(
        "[GaDebug] gtag never loaded within 5s — likely blocked by an ad blocker or browser privacy setting"
      );
    }, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [gaId]);

  return null;
}
