"use client";

import { useEffect } from "react";

// Registers /public/sw.js on first mount in production.
//
// Why client-only + lazy: the service worker file ships from /public
// so it's served as static HTTPS. registerSWonce runs after hydration
// so it never blocks first paint.
//
// We INTENTIONALLY skip registration in development. Next.js dev mode
// rewrites a lot of asset URLs hot-reload style; a SW caching during
// dev produces extremely confusing stale-state bugs.

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Defer until the page is fully loaded so the SW install doesn't
    // compete with first paint or interactive readiness.
    const handle = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Best-effort — PWA install eligibility just won't be
          // available if this fails, but the site still works.
          // eslint-disable-next-line no-console
          console.warn("[sw] registration failed", err);
        });
    };
    if (document.readyState === "complete") handle();
    else window.addEventListener("load", handle, { once: true });
  }, []);

  return null;
}
