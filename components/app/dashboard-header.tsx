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

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
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
  const [rescanning, startRescan] = useTransition();
  const [showReveal, setShowReveal] = useState(false);

  function onRescan() {
    // Open the overlay immediately so the user gets a sense of progress.
    // The actual API call runs in parallel. The overlay's 4.8s hold is
    // longer than a typical re-scan, so by the time it dismisses the
    // server has the new numbers ready for router.refresh().
    setShowReveal(true);
    startRescan(async () => {
      try {
        await fetch("/api/scan/rescan", { method: "POST" });
      } catch {
        // best-effort — overlay still plays
      }
    });
  }

  function onRevealDone() {
    setShowReveal(false);
    // Refresh AFTER the overlay dismisses so the new numbers swap in
    // behind the curtain, not while the user is still reading.
    router.refresh();
  }

  return (
    <div>
      <span className="text-[12px] md:text-[13px] font-medium text-brand">Dashboard</span>
      <h1 className="mt-1.5 md:mt-2 font-display text-[30px] sm:text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
        Your subscriptions
      </h1>
      <p className="mt-2 md:mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
        Every recurring charge on your connected accounts.
      </p>

      {/* Utility row: scan controls demoted to small icon (per critic:
          users assume the dashboard is fresh; exposing the plumbing
          erodes trust). 'Last scanned X ago' lives in the title attr
          on hover. Re-scan is a small icon-only button. Share +
          Protection links stay as-is. */}
      <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2 md:gap-3 text-[12px] md:text-[12.5px] text-ink-muted">
        {isPaid ? (
          <button
            type="button"
            onClick={onRescan}
            disabled={rescanning}
            title={`${timeAgo(lastScannedAt)} — click to refresh`}
            aria-label={`Re-scan. ${timeAgo(lastScannedAt)}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.05] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={rescanning ? "animate-spin" : ""}
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
              <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
            </svg>
          </button>
        ) : (
          // Free tier — show a locked icon. Click triggers the same
          // /api/billing/checkout flow the ActivateProtectionCard uses,
          // so the user lands in Stripe Checkout instead of a dead end.
          <button
            type="button"
            title="Re-scan is a Peace of Mind feature. Activate to unlock."
            aria-label="Re-scan locked. Click to activate Protection."
            onClick={() => {
              void fetch("/api/billing/checkout", { method: "POST" })
                .then((r) => r.json())
                .then((d: { url?: string }) => {
                  if (d.url) window.location.href = d.url;
                })
                .catch(() => {});
            }}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.05] transition"
          >
            <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
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
