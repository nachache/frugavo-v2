"use client";

// DashboardHeader — page title, subtitle, utility row.
//
// Utility row:
//   • Re-scan button (cycles Scanning → Updating → Re-scan)
//   • Last scanned X ago (in the button title)
//   • Share link
//   • Protection history
//
// The earlier ScanRevealOverlay popup ("we just looked through
// everything") was removed: QuickChecks at the top of the dashboard
// is now the curation surface, and a full-screen reveal popup after
// every rescan made the flow feel interrupted. Re-scan now updates
// the dashboard in place — totals, ActionCenter buckets, and Quick
// Checks all refresh together via router.refresh().

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  lastScannedAt: string | null;
  // Paid-tier gate (kept for future surfaces; currently no behavior
  // gate since the 30s Redis cooldown is the only anti-abuse layer).
  isPaid?: boolean;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never scanned";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "Last scanned just now";
  if (min < 60) return `Last scanned ${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Last scanned ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `Last scanned ${day} day${day === 1 ? "" : "s"} ago`;
}

export function DashboardHeader({ lastScannedAt }: Props) {
  const router = useRouter();
  // Two-phase rescan state:
  //   scanning           POST is in flight
  //   awaitingRefresh    POST resolved; waiting for the parent server
  //                      component to re-render with the new
  //                      lastScannedAt (so we can flip back to idle
  //                      with the user-visible feedback "your data
  //                      is now fresh").
  const [scanning, setScanning] = useState(false);
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastScannedRef = useRef(lastScannedAt);

  // When lastScannedAt prop changes after a rescan request, the
  // refresh has propagated. Drop the awaitingRefresh state.
  useEffect(() => {
    if (awaitingRefresh && lastScannedAt !== lastScannedRef.current) {
      lastScannedRef.current = lastScannedAt;
      setAwaitingRefresh(false);
    }
  }, [lastScannedAt, awaitingRefresh]);

  async function onRescan() {
    if (scanning || awaitingRefresh) return;
    setErrorMsg(null);
    setScanning(true);
    try {
      const res = await fetch("/api/scan/rescan", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setErrorMsg(
          body.message ?? body.error ?? "Re-scan failed — try again."
        );
        setScanning(false);
        return;
      }
    } catch {
      setErrorMsg("Network error — try again.");
      setScanning(false);
      return;
    }
    // Scan finished on the server. Trigger refresh; useEffect above
    // clears awaitingRefresh once the new lastScannedAt arrives.
    setAwaitingRefresh(true);
    setScanning(false);
    router.refresh();
  }

  const buttonBusy = scanning || awaitingRefresh;
  const buttonLabel = scanning
    ? "Scanning…"
    : awaitingRefresh
      ? "Updating…"
      : "Re-scan";

  return (
    <div>
      <span className="text-[12px] md:text-[13px] font-medium text-brand">
        Dashboard
      </span>
      <h1 className="mt-1.5 md:mt-2 font-display text-[30px] sm:text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your subscriptions
      </h1>
      <p className="mt-2 md:mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
        Every recurring charge on your connected accounts.
      </p>

      <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2 md:gap-3 text-[12px] md:text-[12.5px] text-ink-muted">
        <button
          type="button"
          onClick={onRescan}
          disabled={buttonBusy}
          title={`${timeAgo(lastScannedAt)}`}
          aria-label={`Re-scan. ${timeAgo(lastScannedAt)}`}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-hairline bg-surface text-ink hover:border-ink/30 hover:bg-ink/[0.04] transition disabled:opacity-60 disabled:cursor-wait text-[12.5px] font-medium"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={buttonBusy ? "animate-spin" : ""}
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
          <span>{buttonLabel}</span>
        </button>
        {errorMsg ? (
          <span className="text-[11.5px] text-danger" role="alert">
            {errorMsg}
          </span>
        ) : null}
        <Link
          href="/app/transactions"
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          All transactions
        </Link>
        <span className="text-ink-muted/40">·</span>
        <Link
          href="/app/share"
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share your numbers
        </Link>
        <span className="text-ink-muted/40">·</span>
        <Link
          href="/app/protection"
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Protection history
        </Link>
      </div>
    </div>
  );
}
