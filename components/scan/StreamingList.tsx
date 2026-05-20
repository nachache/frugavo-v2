"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { ScanEvent, ScanRow } from "@/lib/types/scan";
import { ProgressArc } from "./ProgressArc";
import { FallbackCard } from "./FallbackCard";

// Client component that subscribes to /api/plaid/scan/stream and renders
// rows as they arrive. Stagger is 120ms between rows; running total at
// the top is the loss-aversion anchor described in the spec.
//
// State machine:
//   - waiting   (no rows yet, < 8s)
//   - streaming (at least one row, scan not complete)
//   - fallback  (8s elapsed with zero rows; user can navigate away)
//   - complete  (received `complete` event)

const FALLBACK_AFTER_MS = 8_000;

type Props = {
  scanId: string;
};

type Phase = "connecting" | "reading" | "spotting";

export function StreamingList({ scanId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [complete, setComplete] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const es = new EventSource(
      `/api/plaid/scan/stream?scan_id=${encodeURIComponent(scanId)}`
    );

    // Detach to FallbackCard at 8s if nothing has arrived yet.
    fallbackTimer.current = setTimeout(() => {
      setShowFallback((prev) => (rows.length === 0 ? true : prev));
    }, FALLBACK_AFTER_MS);

    const handle = (raw: MessageEvent) => {
      try {
        const ev = JSON.parse(raw.data) as ScanEvent;
        if (ev.type === "row") {
          // 120ms stagger — we don't apply this with setTimeout because
          // SSE events already arrive serialized; the CSS transition on
          // the row handles the visual stagger.
          setRows((prev) => {
            if (prev.some((r) => r.stream_id === ev.row.stream_id)) return prev;
            // Sort by regret_score desc on insert so the most-likely-forgotten
            // rows climb to the top of the list as they arrive.
            const next = [...prev, ev.row];
            next.sort((a, b) => b.regret_score - a.regret_score);
            return next;
          });
        } else if (ev.type === "total") {
          setTotalCents(ev.monthly_cents);
        } else if (ev.type === "progress") {
          setPhase(ev.phase);
        } else if (ev.type === "complete") {
          setComplete(true);
          es.close();
          if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
        } else if (ev.type === "error") {
          // eslint-disable-next-line no-console
          console.error("[sse] error event", ev);
        }
      } catch {
        // ignore malformed
      }
    };

    // EventSource fires `message` for un-typed events; we use named events
    // so listen on each type to catch all.
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
    es.onerror = () => {
      // EventSource auto-reconnects. We don't tear down on transient errors.
    };

    return () => {
      es.close();
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
    // We deliberately exclude rows.length from deps — the fallback timer
    // is a fire-once one-shot driven by elapsed wall clock, not by state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  // After complete, send the user to the dashboard which renders the
  // full ranked list from Postgres.
  useEffect(() => {
    if (!complete) return;
    const t = setTimeout(() => router.push("/app"), 1_200);
    return () => clearTimeout(t);
  }, [complete, router]);

  if (showFallback && rows.length === 0) {
    return <FallbackCard />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-12">
        <ProgressArc phase={phase} />
        <TrustBar />
      </div>
    );
  }

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

      {complete && (
        <p className="mt-8 text-center text-[13px] text-ink-muted">
          Scan complete — sorting your subscriptions…
        </p>
      )}
    </div>
  );
}

function StreamRow({ row, index }: { row: ScanRow; index: number }) {
  // CSS-driven 120ms stagger using transition-delay. Each row starts at
  // opacity 0 / translateY 6px, then settles. No JS animation loop.
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
