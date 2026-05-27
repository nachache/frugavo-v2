"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WaitingForBankCard } from "@/components/scan/WaitingForBankCard";

// DashboardWaiting — what /app shows when getDashboardReadiness()
// returns "awaiting". Single-purpose page: the WaitingForBankCard
// plus a polling loop that refreshes the dashboard the moment the
// webhook re-triggers a scan and Plaid finally delivers.
//
// We do NOT render the DashboardHeader or any of the regular
// dashboard cards here — the whole point of the gate is to never
// show a zero-state dashboard while data is still loading. A
// minimal top-of-page header is rendered inline so the user knows
// they're in the right app, but nothing numeric appears.
//
// Polling: hits the dashboard route itself every 8s via
// router.refresh(). When the next scan_runs row flips to
// state==="ready_with_results" or "complete_empty_after_history_
// ready", the server render returns the actual dashboard and this
// component unmounts.

type Props = {
  bankName: string | null;
  scanStatus: string | null;
  awaitingBankData: boolean;
};

const POLL_INTERVAL_MS = 8_000;

export function DashboardWaiting({
  bankName,
  scanStatus,
  awaitingBankData,
}: Props) {
  const router = useRouter();
  const [tick, setTick] = useState(0);

  // Background poll. router.refresh() runs the server render again;
  // if readiness has flipped, this component is replaced with the
  // real dashboard on the next paint. Cheap on the server (a few
  // small queries inside buildDashboardData) and zero-cost on the
  // client when there's nothing new.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  // Subtitle copy adapts to the underlying reason. awaiting_bank_data
  // means we KNOW Plaid is the bottleneck. running/finalizing means
  // the engine is still working. null/error means the kickoff is
  // pending or fell over.
  const subtitleNote = awaitingBankData
    ? "Plaid is fetching your transactions on their side. Could take a few minutes."
    : scanStatus === "running" || scanStatus === "finalizing"
    ? "Your first scan is finishing up."
    : scanStatus === "error" || scanStatus === "timeout"
    ? "Last scan didn't complete — we'll retry automatically."
    : "Getting your data ready.";

  function onContinue() {
    // Recovery path. The dashboard is genuinely empty right now; we
    // route to /app/connect so the user can re-trigger or re-link.
    // Cleaner than dumping them on a zero dashboard.
    router.push("/app/connect");
  }

  return (
    <section className="container-page py-10 md:py-16 max-w-[720px]">
      <div className="mb-6 md:mb-8">
        <span className="text-[12px] md:text-[13px] font-medium text-brand">
          Dashboard
        </span>
        <h1 className="mt-1.5 md:mt-2 font-display text-[28px] sm:text-[32px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          Almost ready
        </h1>
        <p className="mt-2 md:mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
          {subtitleNote} We refresh this page automatically every few
          seconds — no need to reload.
        </p>
      </div>

      <WaitingForBankCard
        bankName={bankName}
        estimatedWaitMinutes={15}
        onContinue={onContinue}
      />

      {/* Tiny status row so the polling is visible. tabular-nums
          keeps the counter from jittering as it ticks. */}
      <div className="mt-5 text-center text-[11.5px] text-ink-muted tabular-nums">
        Checking again in a few seconds · poll #{tick + 1}
      </div>
    </section>
  );
}
