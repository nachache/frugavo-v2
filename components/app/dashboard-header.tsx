"use client";

// DashboardHeader — page title, subtitle, utility row.
//
// Utility row holds:
//   • Last scanned X ago
//   • Re-scan button → triggers the ScanRevealOverlay theatrical
//     reveal, then refreshes the page so the dashboard reflects
//     any newly-detected items.
//   • Share link
//   • Protection history

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScanRevealOverlay } from "./scan-reveal-overlay";

type Props = {
  lastScannedAt: string | null;
  // Reveal payload — passed from the page so the overlay knows what
  // numbers to animate to. These are the CURRENT dashboard totals;
  // any new detections from the re-scan land on the next render.
  reveal: {
    monthly_cents: number;
    annual_savings_cents: number;
    top_rows: { name: string; monthly_cents: number }[];
  };
  // Paid-tier gate. When false, the Re-scan icon swaps to a locked
  // affordance that routes to the upgrade flow instead of triggering
  // a scan. Paid users also get an auto re-scan on every /app open
  // (server-side, max 1/day), so manual re-scan is the override.
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

export function DashboardHeader({
  lastScannedAt,
  reveal,
  isPaid = false,
}: Props) {
  const router = useRouter();
  // Two-phase rescan state:
  //   scanning           true while the POST is in flight
  //   awaitingRefresh    true after POST resolved; waiting for the server
  //                      re-render to arrive (signaled by lastScannedAt
  //                      prop changing)
  //   showReveal         true ONLY once awaitingRefresh has cleared, so
  //                      the overlay animates to FRESH post-scan numbers
  const [scanning, setScanning] = useState(false);
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastScannedRef = useRef(lastScannedAt);

  // Watch for lastScannedAt to change AFTER a scan request. That's our
  // signal that router.refresh() has propagated and the parent server
  // component has handed us new reveal numbers. Only THEN do we show
  // the overlay — so the user never sees a reveal animated to stale
  // pre-scan totals.
  useEffect(() => {
    if (awaitingRefresh && lastScannedAt !== lastScannedRef.current) {
      lastScannedRef.current = lastScannedAt;
      setAwaitingRefresh(false);
      setShowReveal(true);
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
    // Scan is complete on the server. Now wait for the client to see
    // the new data: trigger a refresh and watch the lastScannedAt
    // prop for the change signal (handled in the useEffect above).
    setAwaitingRefresh(true);
    setScanning(false);
    router.refresh();
  }

  function onRevealDone() {
    setShowReveal(false);
    // No additional refresh — the dashboard already has fresh data
    // since the overlay only opened AFTER router.refresh landed.
  }

  const buttonBusy = scanning || awaitingRefresh;
  const buttonLabel = scanning
    ? "Scanning…"
    : awaitingRefresh
      ? "Updating…"
      : "Re-scan";

  return (
    <div>
      <span className="text-[12px] md:text-[13px] font-medium text-brand">Dashboard</span>
      <h1 className="mt-1.5 md:mt-2 font-display text-[30px] sm:text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your subscriptions
      </h1>
      <p className="mt-2 md:mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
        Every recurring charge on your connected accounts.
      </p>

      {/* Utility row: re-scan is now a labeled button so users can
          actually find it after the engine fixes. Was previously a
          tiny 28px icon ("scan plumbing demoted") which made it
          functionally invisible. Trade-off: shows the plumbing, but
          discoverability of the manual refresh path won out — users
          testing a freshly-fixed scanner shouldn't have to hunt for
          the icon. */}
      <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2 md:gap-3 text-[12px] md:text-[12.5px] text-ink-muted">
        {/* v9 — Re-scan is now available to all users. The first-connect
            flow can land users on an empty dashboard because Plaid
            hadn't finished pulling transactions; we want every user to
            be able to retry without paying. The 30s Redis cooldown
            still prevents abuse. */}
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
        <ScanRevealOverlay
          visible={showReveal}
          monthlyCents={reveal.monthly_cents}
          annualSavingsCents={reveal.annual_savings_cents}
          topRows={reveal.top_rows}
          onDone={onRevealDone}
        />
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
