"use client";

// LoginAutoSync — fires a background re-scan once per browser session
// the first time the dashboard mounts after a fresh login. While the
// scan is in flight a thin, calm pulsing bar appears at the top of
// the dashboard saying "Syncing your latest transactions…". On
// completion the bar fades out and we router.refresh() so every
// surface picks up the new data.
//
// Why per-session: a hard reload counts (sessionStorage is new) but
// quick tab-switches don't. A separate 30s server-side cooldown in
// /api/scan/rescan prevents abuse if the user does several reloads.
//
// Failure modes are silent — the user already has data on screen;
// no need to surface a red error for a background convenience sync.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "frugavo:login-auto-sync";

export function LoginAutoSync() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "syncing" | "done">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY)) {
      // already synced this browser session
      return;
    }
    window.sessionStorage.setItem(SESSION_KEY, "1");

    let cancelled = false;
    setStatus("syncing");

    (async () => {
      try {
        const res = await fetch("/api/scan/rescan", { method: "POST" });
        // 429 = cooldown still active from a recent prior scan; nothing
        // to wait for. Treat as already in sync.
        if (cancelled) return;
        if (res.ok) {
          router.refresh();
        }
      } catch {
        // network blip — silently give up
      } finally {
        if (cancelled) return;
        setStatus("done");
        // Let the bar fade out, then unmount.
        setTimeout(() => {
          if (!cancelled) setStatus("idle");
        }, 1200);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "idle") return null;

  return (
    <div
      className={[
        "sticky z-40 transition-opacity duration-500",
        status === "done" ? "opacity-0" : "opacity-100",
      ].join(" ")}
      style={{ top: "calc(64px + env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      <div className="container-page max-w-[1200px] pt-2">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white border border-hairline shadow-soft pl-2.5 pr-3.5 h-8 text-[12px] text-ink whitespace-nowrap overflow-hidden">
          <span className="relative inline-flex items-center justify-center shrink-0">
            <span
              className="inline-flex h-2 w-2 rounded-full fr-sync-pulse"
              style={{ background: "#10B981" }}
              aria-hidden="true"
            />
          </span>
          <span className="text-ink-muted">
            {status === "syncing"
              ? "Syncing your latest transactions…"
              : "Synced"}
          </span>
        </div>
      </div>
    </div>
  );
}
