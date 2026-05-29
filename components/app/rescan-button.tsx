"use client";

// RescanButton — in-place re-scan with an animated logo spinner.
//
// Behavior:
//   • Fires POST /api/scan/rescan synchronously (the endpoint waits
//     for runScanForUser to finish; typical 5–30s).
//   • While the fetch is in flight, the icon rotates and the label
//     swaps to "Watering…". Existing dashboard content stays put —
//     no navigation to /app/scanning.
//   • On 200: calls router.refresh() so every server component re-
//     renders against fresh data (totals, charts, calendar, etc.).
//   • On 429: shows "Available every 30s" briefly and clears.
//
// Used by the dashboard QuickActionsRow + the transactions page.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw, ChevronRight } from "lucide-react";

type Variant = "row" | "compact";

export function RescanButton({
  variant = "row",
  label = "Re-scan now",
  hint = "Pull the latest from your banks",
}: {
  variant?: Variant;
  label?: string;
  hint?: string;
}) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const onClick = async () => {
    if (spinning || refreshing) return;
    setError(null);
    setSpinning(true);
    try {
      const res = await fetch("/api/scan/rescan", { method: "POST" });
      if (res.status === 429) {
        setError("Available again in 30s");
        setTimeout(() => setError(null), 2400);
        return;
      }
      if (!res.ok) {
        setError("Re-scan failed — try again");
        setTimeout(() => setError(null), 2400);
        return;
      }
      // Re-render the server tree so every total/chart picks up the
      // new scan output without a full page reload.
      startRefresh(() => router.refresh());
    } catch {
      setError("Network blip — try again");
      setTimeout(() => setError(null), 2400);
    } finally {
      setSpinning(false);
    }
  };

  const active = spinning || refreshing;

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={active}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-hairline bg-white text-[12.5px] font-medium text-ink hover:bg-ink/[0.04] transition disabled:opacity-70"
        aria-label={label}
      >
        <RefreshCw
          size={13}
          strokeWidth={2}
          className={active ? "animate-spin" : ""}
        />
        {active ? "Watering…" : error ?? label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className="group flex items-center gap-3 rounded-2xl border border-hairline bg-white shadow-soft px-4 py-3.5 transition-all hover:bg-canvas/40 hover:shadow-float disabled:opacity-80 w-full text-left"
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-ink/[0.05] text-ink shrink-0"
        aria-hidden="true"
      >
        <RefreshCw
          size={16}
          strokeWidth={2}
          className={active ? "animate-spin" : ""}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink leading-tight">
          {active ? "Watering your subs…" : label}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-muted leading-snug truncate">
          {error ?? hint}
        </span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={2}
        className="text-ink-muted group-hover:text-ink transition-colors shrink-0"
      />
    </button>
  );
}
