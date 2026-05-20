"use client";

import { useEffect } from "react";

// Conditional GA4 debug-mode activator.
//
// GA4 only treats a session as "debug" — visible in Admin → DebugView — when
// gtag has been called with config { debug_mode: true }, or when Google
// Tag Assistant / the GA Debugger Chrome extension is active. A query-
// string parameter alone doesn't do anything.
//
// This component lets us flip debug mode on by appending ?ga_debug=1 to any
// URL. On mount, it checks the URL. If the flag is present and the gtag
// global has loaded, it re-issues the config call with debug_mode: true.
// The re-config is idempotent — calling it after the standard config call
// doesn't break anything; it just adds the debug flag to subsequent events.
//
// Strip the parameter before sharing URLs publicly so debug events don't
// pollute production data.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function GaDebug({ gaId }: { gaId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("ga_debug") !== "1") return;

    // Wait briefly for gtag.js to finish loading before re-issuing config.
    const tryEnable = () => {
      if (typeof window.gtag === "function") {
        window.gtag("config", gaId, { debug_mode: true });
        // Visible breadcrumb so we can confirm in the console that debug
        // mode was actually activated.
        // eslint-disable-next-line no-console
        console.log(`[GA4] debug_mode enabled for ${gaId}`);
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
