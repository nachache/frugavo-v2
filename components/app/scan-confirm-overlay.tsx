"use client";

// ScanConfirmOverlay — post-scan single-question confirmation.
//
// Replaces the previous QuickChecks carousel. After every scan that
// surfaces detections needing verification, this overlay auto-opens
// once and asks one question:
//
//     "Which of these are NOT subscriptions?"
//
// All items are pre-checked (= the engine assumes they ARE subs).
// The user unticks anything that isn't a sub. On confirm we:
//
//   • For unchecked items: POST /api/doubt/:id/resolve { resolution: "not_sub" }
//     — writes user_overrides override_type='not_subscription'.
//   • For checked items: POST /api/doubt/:id/resolve { resolution: "confirmed" }
//     — writes user_overrides override_type='confirmed'.
//
// Both paths flow through the same user_overrides table that any
// legacy decision was written to, so previously marked "not a sub"
// items remain excluded after the migration (we don't surface them
// here because their doubt rows were resolved long ago).
//
// After all batched writes settle, we call router.refresh() so every
// server-rendered surface (totals, charts, calendar, insights, share
// card, personality, health score, forecast, monitoring) reflects
// the new classifications.
//
// One-shot gating: sessionStorage[`frugavo:scan-confirm:{scan_id}`]
// is set on dismiss. The overlay only appears once per scan.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Check, X, ShieldCheck } from "lucide-react";
import { MerchantLogo } from "@/components/app/merchant-logo";

export type ConfirmCandidate = {
  doubt_id: string;
  subscription_id: string;
  merchant_name: string;
  amount_cents: number;
  frequency: string;
  category: string | null;
  // engine confidence 0..1
  confidence: number;
};

type Props = {
  // The candidates needing verification. Empty → overlay never shows.
  candidates: ConfirmCandidate[];
  // A stable per-scan token; the overlay shows once per token.
  scanId: string | null;
};

function fmtMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return Math.round((amount * 52) / 12);
    case "biweekly":
    case "bi_weekly":
      return Math.round((amount * 26) / 12);
    case "semi_monthly":
      return amount * 2;
    case "monthly":
      return amount;
    case "quarterly":
      return Math.round(amount / 3);
    case "semiannually":
    case "semi_annually":
      return Math.round(amount / 6);
    case "annually":
    case "yearly":
      return Math.round(amount / 12);
    default:
      return amount;
  }
}

function fmtCents(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

export function ScanConfirmOverlay({ candidates, scanId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Map of doubt_id → keep_as_sub (default true = pre-checked).
  const [decisions, setDecisions] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const c of candidates) out[c.doubt_id] = true;
    return out;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Hydration gate for createPortal.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-open once per scan, when we have candidates.
  useEffect(() => {
    if (candidates.length === 0) return;
    if (typeof window === "undefined") return;
    const key = `frugavo:scan-confirm:${scanId ?? "no-scan"}`;
    const already = window.sessionStorage.getItem(key);
    if (already) return;
    setOpen(true);
  }, [candidates.length, scanId]);

  // Refresh local decisions if the candidate list changes (e.g. a new
  // scan landed while the user was on the page).
  useEffect(() => {
    setDecisions((prev) => {
      const next: Record<string, boolean> = {};
      for (const c of candidates) {
        next[c.doubt_id] = prev[c.doubt_id] ?? true;
      }
      return next;
    });
  }, [candidates]);

  // Esc + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWithoutSaving();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const keptCount = useMemo(
    () => Object.values(decisions).filter(Boolean).length,
    [decisions]
  );
  const removedCount = candidates.length - keptCount;

  function markSeen() {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      `frugavo:scan-confirm:${scanId ?? "no-scan"}`,
      "1"
    );
  }

  function closeWithoutSaving() {
    markSeen();
    setOpen(false);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Fire all writes in parallel — each doubt has its own row, so
      // ordering doesn't matter. Both branches use the same endpoint
      // so the user_overrides table is the single source of truth.
      const writes = candidates.map((c) => {
        const keep = decisions[c.doubt_id];
        return fetch(`/api/doubt/${c.doubt_id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: keep ? "confirmed" : "not_sub",
            surface: "scan_confirm",
          }),
        }).catch(() => null);
      });
      await Promise.all(writes);
      markSeen();
      setOpen(false);
      // Force every server-rendered surface to re-render against the
      // newly written overrides. Totals, charts, calendar, insights,
      // protection, share card, personality, health — all derive
      // from buildDashboardData which will see the fresh user_overrides
      // table on this refresh tick.
      router.refresh();
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !open || candidates.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-6 fr-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-confirm-title"
    >
      <button
        type="button"
        onClick={closeWithoutSaving}
        aria-label="Close"
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full md:max-w-[560px] max-h-[92vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-white shadow-float border border-hairline outline-none overflow-hidden fr-modal-pop"
      >
        <div className="px-5 md:px-7 pt-5 md:pt-7 pb-4 border-b border-hairline flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-100 text-emerald-900"
                aria-hidden="true"
              >
                <ShieldCheck size={14} strokeWidth={2} />
              </span>
              <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                Quick check
              </span>
            </div>
            <h2
              id="scan-confirm-title"
              className="font-display text-[20px] md:text-[24px] font-bold tracking-[-0.01em] text-ink leading-tight"
            >
              Which of these are NOT subscriptions?
            </h2>
            <p className="mt-1.5 text-[12.5px] text-ink-body leading-relaxed">
              We pre-checked everything we think is a real sub. Untick
              anything that isn&apos;t.
            </p>
          </div>
          <button
            type="button"
            onClick={closeWithoutSaving}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-ink/[0.05] text-ink-muted hover:text-ink transition shrink-0"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Candidate rows */}
        <ul className="flex-1 overflow-y-auto divide-y divide-hairline/60">
          {candidates.map((c) => {
            const keep = decisions[c.doubt_id] ?? true;
            const monthly = fmtMonthly(c.amount_cents, c.frequency);
            return (
              <li key={c.doubt_id}>
                <button
                  type="button"
                  onClick={() =>
                    setDecisions((prev) => ({
                      ...prev,
                      [c.doubt_id]: !prev[c.doubt_id],
                    }))
                  }
                  className={[
                    "w-full text-left flex items-center gap-3 px-5 md:px-7 py-3.5 transition",
                    keep ? "bg-white" : "bg-ink/[0.02]",
                  ].join(" ")}
                  aria-pressed={keep}
                >
                  <span
                    className={[
                      "inline-flex items-center justify-center w-5 h-5 rounded-md border shrink-0 transition-colors",
                      keep
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-hairline bg-white",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {keep ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <MerchantLogo
                    name={c.merchant_name}
                    domain={null}
                    size={30}
                    rounded="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={[
                        "text-[13.5px] font-bold truncate",
                        keep ? "text-ink" : "text-ink-muted line-through",
                      ].join(" ")}
                    >
                      {c.merchant_name}
                    </div>
                    <div className="text-[11.5px] text-ink-muted truncate">
                      {fmtCents(monthly)}/mo · {c.frequency}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="border-t border-hairline px-5 md:px-7 py-4 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11.5px] text-ink-muted tabular-nums">
              Keeping {keptCount} sub{keptCount === 1 ? "" : "s"}
              {removedCount > 0 ? ` · removing ${removedCount}` : ""}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full text-[13px] font-medium text-white disabled:opacity-70"
              style={{ background: "#0F6E56" }}
            >
              {submitting ? "Saving…" : "Looks right, save"}
            </button>
          </div>
          {error ? (
            <div className="mt-2 text-[11.5px] text-danger">{error}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
