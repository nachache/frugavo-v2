"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { ScanEvent, ScanRow } from "@/lib/types/scan";
import { ProgressArc } from "./ProgressArc";
import { FallbackCard } from "./FallbackCard";

// Scanning state machine.
//
// State derivation (no hardcoded transitions):
//   scanning  — initial; no rows, no complete event, error null, elapsed < SLOW_THRESHOLD
//   ready     — at least one row arrived OR complete event received
//   slow      — elapsed > SLOW_THRESHOLD AND still no rows AND not complete
//   error     — error event received (non-recoverable)
//
// Critical guarantees:
//   1. We NEVER navigate based on a timer. Navigation happens only when
//      `isReady` becomes true, which requires either real data or a
//      definitive "complete" event from the engine.
//   2. The slow card is interruptible — `isSlow` AND `!isReady` are
//      required to render it. The moment ANY row or the complete event
//      arrives, `isReady` flips and the card vanishes.
//   3. SSE is the primary feed. A backup poll against /api/scan/status
//      runs every POLL_INTERVAL — if the DB shows the scan finished but
//      SSE missed the event, the poll handler flips `isComplete` so the
//      user still moves forward.
//   4. Empty scans (complete with 0 rows) are distinct from slow. They
//      route to the dashboard immediately, where the empty-state UI
//      handles the "no subscriptions found" case honestly.

const SLOW_THRESHOLD_MS = 25_000;
const POLL_INTERVAL_MS = 3_000;
const POST_COMPLETE_REDIRECT_MS = 900;

type Props = {
  scanId: string;
};

type Phase = "connecting" | "reading" | "spotting";

export function StreamingList({ scanId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState<{ code: string; recoverable: boolean } | null>(null);
  // Trust receipt data — populated from the `complete` event. Real
  // numbers, never invented: detected count + actual scan duration.
  const [receipt, setReceipt] = useState<{
    detected: number;
    durationMs: number;
  } | null>(null);

  // Derived UI state. Order matters: error > ready > slow > scanning.
  // The "ready" guard ALWAYS beats slow, so a card that's already
  // showing "slow account" disappears the moment any data arrives.
  const isReady = isComplete || rows.length > 0;
  const uiState: "scanning" | "slow" | "ready" | "error" = error
    ? "error"
    : isReady
    ? "ready"
    : isSlow
    ? "slow"
    : "scanning";

  // ---------- SSE subscription ----------

  useEffect(() => {
    const es = new EventSource(
      `/api/plaid/scan/stream?scan_id=${encodeURIComponent(scanId)}`
    );

    const handle = (raw: MessageEvent) => {
      try {
        const ev = JSON.parse(raw.data) as ScanEvent;
        if (ev.type === "row") {
          setRows((prev) => {
            if (prev.some((r) => r.stream_id === ev.row.stream_id)) return prev;
            const next = [...prev, ev.row];
            next.sort((a, b) => b.regret_score - a.regret_score);
            return next;
          });
        } else if (ev.type === "total") {
          setTotalCents(ev.monthly_cents);
        } else if (ev.type === "progress") {
          setPhase(ev.phase);
        } else if (ev.type === "complete") {
          setIsComplete(true);
          setReceipt({ detected: ev.detected, durationMs: ev.duration_ms });
          es.close();
        } else if (ev.type === "error") {
          if (!ev.recoverable) {
            setError({ code: ev.code, recoverable: ev.recoverable });
          }
        }
      } catch {
        // ignore malformed
      }
    };

    for (const type of [
      "row",
      "total",
      "progress",
      "complete",
      "error",
      "heartbeat",
    ]) {
      es.addEventListener(type, handle as EventListener);
    }
    es.onmessage = handle;

    return () => es.close();
  }, [scanId]);

  // ---------- polling fallback ----------

  // If SSE drops or Redis loses an event, the DB still knows. Poll the
  // scan_runs row every 3 seconds while we're not yet ready, and flip
  // isComplete on our own when the DB confirms a TERMINAL state.
  //
  // 'finalizing' is explicitly non-terminal — rows are persisted but
  // cache invalidation may not have propagated, so we keep polling
  // until status becomes done/error/timeout (or `is_terminal` is true).
  // This is the contract documented in app/api/scan/status/route.ts.
  useEffect(() => {
    if (isReady) return; // stop polling once we have data
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/status?id=${encodeURIComponent(scanId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: "running" | "finalizing" | "done" | "error" | "timeout";
          is_terminal: boolean;
          detected: number;
        };
        if (cancelled) return;
        if (data.is_terminal) {
          setIsComplete(true);
        }
      } catch {
        // network blip — next interval retries
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scanId, isReady]);

  // ---------- slow threshold ----------

  useEffect(() => {
    if (isReady) return;
    const t = setTimeout(() => setIsSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, [isReady]);

  // ---------- forward navigation ----------

  // Single navigation source of truth: only when we're "ready." A short
  // beat after complete fires so the user sees the final total tick up
  // before the route swap.
  //
  // CRITICAL: router.refresh() is called BEFORE router.push("/app").
  // Without refresh(), Next.js's client-side Router Cache serves the
  // pre-scan RSC payload to the push and the dashboard renders stale
  // data until the user hard-reloads. The server-side revalidatePath
  // inside finalizeScan covers cross-tab and cron-initiated scans;
  // refresh() is the in-tab guarantee that this navigation sees fresh
  // data.
  useEffect(() => {
    if (!isComplete) return;
    const t = setTimeout(() => {
      router.refresh();
      router.push("/app");
    }, POST_COMPLETE_REDIRECT_MS);
    return () => clearTimeout(t);
  }, [isComplete, router]);

  // Memoized navigation handler for the "I'll wait" recovery flow.
  // Same refresh-before-push contract so the dashboard never shows
  // stale data after a fallback navigation.
  const goToDashboard = useCallback(() => {
    router.refresh();
    router.push("/app");
  }, [router]);

  // ---------- render ----------

  if (uiState === "error" && error) {
    return (
      <ScanError
        code={error.code}
        onContinue={goToDashboard}
      />
    );
  }

  if (uiState === "slow") {
    // Interruptible — the moment isReady flips, this card unmounts.
    return <FallbackCard onContinue={goToDashboard} />;
  }

  // scanning OR ready — same shell, different content.
  if (rows.length === 0 && !isComplete) {
    return (
      <div className="flex flex-col items-center gap-12">
        <ProgressArc phase={phase} />
        <TrustBar />
      </div>
    );
  }

  // ready with rows (or zero-row complete — we still show the empty
  // skeleton briefly before the redirect fires).
  //
  // Per the trust-rebuild brief: removed the "over 5 years" loss-
  // aversion chip. Speculative extrapolations contaminate trust
  // ("$26,169 over 5 years!" reads as inflated even when the math
  // is technically correct). Yearly is the natural anchor users can
  // verify mentally; we stop there.
  return (
    <div>
      <div className="rounded-3xl bg-brand-light p-6">
        <div className="text-[12px] uppercase tracking-[0.14em] text-emerald-900/70 font-semibold">
          Found so far
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[40px] md:text-[48px] leading-none font-display font-bold tracking-[-0.03em] text-brand tnum">
            {formatCurrency(totalCents / 100)}
          </span>
          <span className="text-[14px] font-medium text-emerald-900/70">
            /mo
          </span>
        </div>
        <div className="mt-1 text-[13px] text-emerald-900/70 tnum">
          {rows.length} recurring{" "}
          {rows.length === 1 ? "charge" : "charges"} detected
        </div>
      </div>

      <ul className="mt-8 grid gap-3">
        {rows.map((row, i) => (
          <StreamRow key={row.stream_id} row={row} index={i} />
        ))}
      </ul>

      {isComplete && (
        <div className="mt-8 text-center space-y-3">
          <p className="text-[13px] text-ink-muted">
            {rows.length === 0
              ? "Scan complete — no recurring charges yet. Taking you to your dashboard…"
              : "Scan complete — sorting your subscriptions…"}
          </p>
          {receipt && rows.length > 0 && (
            <TrustReceipt
              detected={receipt.detected}
              durationMs={receipt.durationMs}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Trust receipt: a small, factual line shown after the scan completes.
// Every value is real — `detected` and `durationMs` come from the
// engine's `complete` event, no invented numbers.
function TrustReceipt({
  detected,
  durationMs,
}: {
  detected: number;
  durationMs: number;
}) {
  const seconds = (durationMs / 1000).toFixed(1);
  return (
    <p className="inline-flex flex-wrap items-center justify-center gap-1.5 text-[11.5px] text-ink-muted leading-relaxed max-w-[440px] mx-auto">
      <ShieldCheck size={11} className="text-brand" />
      Found {detected} recurring {detected === 1 ? "charge" : "charges"} in{" "}
      <span className="tnum">{seconds}s</span>
      <span className="text-ink/30">·</span>
      Read-only access
      <span className="text-ink/30">·</span>
      No card numbers stored
    </p>
  );
}

// ---------- subcomponents ----------

function StreamRow({ row, index }: { row: ScanRow; index: number }) {
  const delay = Math.min(index, 9) * 120;
  return (
    <li
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "rounded-2xl bg-white border border-hairline/60 p-4 flex items-center gap-4",
        "opacity-100 translate-y-0 transition-all duration-500 ease-out",
        "animate-[fadeUp_320ms_ease-out]"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/[0.06] text-[14px] font-semibold text-ink uppercase">
        {row.merchant_name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-medium text-ink truncate">
          {row.merchant_name}
        </div>
        <div className="text-[12px] text-ink-muted tnum">
          {row.frequency.replace("_", " ")}
          {row.last_charged_at &&
            ` · last charged ${new Date(
              row.last_charged_at
            ).toLocaleDateString()}`}
        </div>
      </div>
      <div className="text-right tnum">
        <div className="text-[16px] font-display font-semibold text-ink">
          {formatCurrency(row.amount_cents / 100)}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </li>
  );
}

function TrustBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-white border border-hairline/60 px-4 py-2 text-[12.5px] text-ink-muted">
      <ShieldCheck size={14} className="text-brand" />
      Read-only access · We can&apos;t move money
      <span className="text-ink/30">·</span>
      <span className="font-medium text-ink/70">via Plaid</span>
    </div>
  );
}

function ScanError({
  code,
  onContinue,
}: {
  code: string;
  onContinue: () => void;
}) {
  const message =
    code === "item_login_required"
      ? "Your bank needs you to re-authorize the connection. You can do that from Settings."
      : code === "rate_limited"
      ? "Plaid asked us to slow down. We'll retry automatically — give it a minute."
      : "Something went wrong on our end. You can still visit your dashboard while we look into it.";
  return (
    <div className="rounded-3xl bg-white border border-hairline/60 p-8 max-w-[520px] mx-auto text-center">
      <div className="text-[12px] uppercase tracking-[0.14em] font-semibold text-danger">
        Scan error
      </div>
      <p className="mt-3 text-[15px] text-ink-body">{message}</p>
      <button
        onClick={onContinue}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
      >
        Go to dashboard
      </button>
    </div>
  );
}
