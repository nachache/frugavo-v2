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
//
// Diagnostics: optional Plaid item state used ONLY to improve copy.
// It never decides readiness — scan_runs is authoritative. If
// diagnostics say "your bank disconnected" we surface a "please
// re-link" CTA. If they say "classic integration" we surface the
// 15-30 minute caveat. If they say nothing, generic copy.

type Props = {
  bankName: string | null;
  scanStatus: string | null;
  awaitingBankData: boolean;
  // Optional. Drives the explanatory subtitle + CTA. Absent on
  // legacy renders or when Plaid is unreachable; the component
  // degrades to generic copy in that case.
  diagnostics?: {
    anyNeedsReauth: boolean;
    noSuccessfulUpdateYet: boolean;
    classicLikely: boolean;
    bankNames: string;
  };
};

const POLL_INTERVAL_MS = 8_000;

export function DashboardWaiting({
  bankName,
  scanStatus,
  awaitingBankData,
  diagnostics,
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

  // Subtitle copy. Order of preference (most specific first):
  //   1. Plaid diagnostics say the user must re-link → tell them.
  //   2. Plaid says "we've never seen a successful update" → first-
  //      pull copy (the most common slow-bank case).
  //   3. Plaid heuristic says Classic integration → 15-30min caveat.
  //   4. scan_runs.metrics.awaiting_bank_data=true → generic Plaid
  //      bottleneck.
  //   5. scan still running/finalizing → engine-side copy.
  //   6. scan errored → retry copy.
  //   7. Fallback.
  //
  // CRITICAL: every branch above only changes WHAT WE SAY. The
  // decision to be on this screen at all was made in
  // getDashboardReadiness from scan_runs alone. Plaid metadata can
  // never advance us past this screen — only a fresh, trustworthy
  // scan_runs row can.
  const subtitleNote = diagnostics?.anyNeedsReauth
    ? `${diagnostics.bankNames || "Your bank"} needs you to re-authorize the connection. Until you re-link, transactions will be stale.`
    : diagnostics?.noSuccessfulUpdateYet
    ? "Plaid hasn't delivered any transactions yet. This is normal on first connect — the initial pull can take a few minutes."
    : diagnostics?.classicLikely
    ? `${diagnostics.bankNames || "Your bank"} uses Plaid's older integration, which can take 15-30 minutes on first connect. We'll refresh automatically.`
    : awaitingBankData
    ? "Plaid is fetching your transactions on their side. Could take a few minutes."
    : scanStatus === "running" || scanStatus === "finalizing"
    ? "Your first scan is finishing up."
    : scanStatus === "error" || scanStatus === "timeout"
    ? "Last scan didn't complete — we'll retry automatically."
    : "Getting your data ready.";

  function onContinue() {
    // Recovery path. If Plaid says the item needs re-auth, route to
    // /app/connect (which handles re-linking). Otherwise just refresh
    // the same screen — there's nowhere honest to send them since the
    // dashboard isn't ready.
    if (diagnostics?.anyNeedsReauth) {
      router.push("/app/connect");
      return;
    }
    router.refresh();
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
