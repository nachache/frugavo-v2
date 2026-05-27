"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

// PreparingScreen — the production-grade "preparation state" UX.
//
// Replaces the all-or-nothing waiting card with a milestone strip
// driven by real ingestion data. Layout follows what Mercury / Brex
// / Ramp use:
//   • Top headline + subtitle (why you're here, not how long)
//   • Live milestone list (ticked items + the active one)
//   • Skeleton cards below where the real dashboard will live
//
// Hydration model:
//   - Server gives us the initial state (preparing/syncing/analyzing
//     + txnCount + bankName + diagnostics flavor).
//   - Component polls /api/ingestion/state every 4s.
//   - When the server flips to ready_*, router.refresh() unmounts us
//     and the real dashboard renders.
//
// Critical: every number we show is REAL. txnCount comes from
// plaid_items.txn_count. No fake percentages, no fake spinners
// pretending to be progress.

type ServerState = "preparing" | "syncing" | "analyzing";

type Props = {
  initialState: ServerState;
  bankNames: string;
  initialTxnCount: number;
  // Diagnostic flavor passed in for copy adaptation. NEVER used to
  // advance state — only IngestionState transitions can do that.
  classicLikely: boolean;
  noSuccessfulUpdateYet: boolean;
};

type PollState = {
  state: ServerState | "ready_with_results" | "ready_but_empty" | "needs_reauth";
  txnCount: number;
};

const POLL_INTERVAL_MS = 4_000;

export function PreparingScreen({
  initialState,
  bankNames,
  initialTxnCount,
  classicLikely,
  noSuccessfulUpdateYet,
}: Props) {
  const router = useRouter();
  const [poll, setPoll] = useState<PollState>({
    state: initialState,
    txnCount: initialTxnCount,
  });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/ingestion/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as PollState;
        if (cancelled) return;
        setPoll(data);
        if (
          data.state === "ready_with_results" ||
          data.state === "ready_but_empty" ||
          data.state === "needs_reauth"
        ) {
          // Server route flipped. Refresh so the proper page renders.
          router.refresh();
        }
      } catch {
        // network blip — next interval retries
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  // Derived milestones. Each has a fixed identity so React doesn't
  // re-mount them across renders; the live ones animate via state.
  const milestones = useMemo(
    () => buildMilestones(poll, bankNames),
    [poll, bankNames]
  );

  const subtitle = pickSubtitle({
    state: poll.state,
    classicLikely,
    noSuccessfulUpdateYet,
    txnCount: poll.txnCount,
    bankNames,
  });

  return (
    <section className="container-page py-10 md:py-16 max-w-[860px]">
      <div className="mb-6 md:mb-10">
        <span className="text-[12px] md:text-[13px] font-medium text-brand">
          Preparing your account
        </span>
        <h1 className="mt-1.5 md:mt-2 font-display text-[28px] sm:text-[34px] md:text-[42px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          Almost there.
        </h1>
        <p className="mt-2 md:mt-3 text-[14px] md:text-[15.5px] leading-relaxed text-ink-body max-w-[560px]">
          {subtitle}
        </p>
      </div>

      {/* Milestone strip */}
      <div className="rounded-3xl bg-white border border-hairline/60 p-5 md:p-7 mb-8 md:mb-10">
        <ol className="space-y-3.5">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                {m.status === "done" ? (
                  <CheckCircle2
                    size={18}
                    strokeWidth={2.4}
                    className="text-brand"
                  />
                ) : m.status === "active" ? (
                  <Loader2
                    size={16}
                    strokeWidth={2.4}
                    className="text-brand animate-spin"
                  />
                ) : (
                  <span className="block h-2.5 w-2.5 rounded-full bg-ink/15" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={
                    m.status === "pending"
                      ? "text-[14.5px] text-ink-muted"
                      : "text-[14.5px] font-medium text-ink"
                  }
                >
                  {m.label}
                </div>
                {m.detail ? (
                  <div className="mt-0.5 text-[12.5px] text-ink-muted tabular-nums">
                    {m.detail}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Skeleton dashboard — gives the user a preview of the layout
          they'll see in a moment. Pulses softly. NEVER shows numeric
          placeholders that could be mistaken for real values. */}
      <DashboardSkeleton />

      <div className="mt-8 text-center text-[11.5px] text-ink-muted inline-flex items-center gap-1.5 justify-center w-full">
        <ShieldCheck size={11} className="text-brand" />
        Read-only access · No card numbers stored · via Plaid
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Milestone derivation. Pure function of poll state + initial inputs.
// ──────────────────────────────────────────────────────────────────────

type Milestone = {
  id: string;
  label: string;
  detail?: string;
  status: "done" | "active" | "pending";
};

function buildMilestones(poll: PollState, bankNames: string): Milestone[] {
  const bank = bankNames.trim() || "your bank";

  // m1: connected — always done at this point (we only render
  // PreparingScreen when an item exists).
  const m1: Milestone = {
    id: "connected",
    label: `Connected to ${bank}`,
    status: "done",
  };

  // m2: fetching — done once we have ANY rows.
  const fetchingDone = poll.txnCount > 0;
  const m2: Milestone = {
    id: "fetching",
    label: fetchingDone
      ? "Fetching your transactions"
      : "Fetching your transactions",
    detail: fetchingDone
      ? `${poll.txnCount.toLocaleString()} pulled so far`
      : poll.state === "preparing"
      ? "Plaid is preparing your account"
      : undefined,
    status: fetchingDone ? "done" : "active",
  };

  // m3: analyzing — active during state==='analyzing', done after.
  const m3: Milestone = {
    id: "analyzing",
    label: "Analyzing recurring patterns",
    status:
      poll.state === "analyzing"
        ? "active"
        : fetchingDone
        ? "pending"
        : "pending",
  };
  if (fetchingDone && poll.state !== "analyzing") {
    // We're in syncing with rows but no scan running yet — show
    // analyzing as pending (next up).
    m3.status = "pending";
  }
  if (poll.state === "ready_with_results" || poll.state === "ready_but_empty") {
    m3.status = "done";
  }

  // m4: building — final beat before the dashboard appears.
  const m4: Milestone = {
    id: "building",
    label: "Building your dashboard",
    status:
      poll.state === "ready_with_results" || poll.state === "ready_but_empty"
        ? "done"
        : poll.state === "analyzing"
        ? "pending"
        : "pending",
  };

  return [m1, m2, m3, m4];
}

function pickSubtitle(args: {
  state: PollState["state"];
  classicLikely: boolean;
  noSuccessfulUpdateYet: boolean;
  txnCount: number;
  bankNames: string;
}): string {
  const bank = args.bankNames.trim() || "your bank";
  if (args.state === "needs_reauth") {
    return `${bank} needs you to re-authorize the connection.`;
  }
  if (args.classicLikely && args.noSuccessfulUpdateYet) {
    return `${bank} uses Plaid's older integration, so the first pull can take 15–30 minutes. You can close this tab — we'll email you when it's ready.`;
  }
  if (args.state === "preparing") {
    return "Plaid is preparing your account. The first transactions should arrive in a moment.";
  }
  if (args.state === "syncing") {
    return `We've started receiving transactions from ${bank}. Sorting them now.`;
  }
  if (args.state === "analyzing") {
    return `We've pulled ${args.txnCount.toLocaleString()} transactions and the engine is identifying recurring charges.`;
  }
  return "Getting your data ready. You can close this tab — we'll email you when it's done.";
}

// ──────────────────────────────────────────────────────────────────────
// Skeleton dashboard. Layout-matching shimmer cards. No numbers, no
// fake category labels. The point is to communicate "this is where
// your real dashboard will be" without inviting confusion.
// ──────────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        {/* Identity card placeholder */}
        <div className="lg:col-span-5 rounded-2xl border border-hairline bg-surface p-4 md:p-5 h-[420px]">
          <div className="rounded-2xl bg-ink/[0.04] w-full aspect-[1080/1350] animate-pulse" />
        </div>
        {/* Right rail */}
        <div className="lg:col-span-7 space-y-5 md:space-y-6">
          <SkelCard h="h-[180px]" />
          <SkelCard h="h-[220px]" />
        </div>
      </div>
      <SkelCard h="h-[260px]" />
      <SkelCard h="h-[200px]" />
    </div>
  );
}

function SkelCard({ h }: { h: string }) {
  return (
    <div
      className={`rounded-2xl border border-hairline bg-surface ${h} animate-pulse`}
    />
  );
}
