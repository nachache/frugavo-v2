"use client";

// SubscriptionDetailModal — shared overlay used wherever the user can
// "open a sub" without leaving the page. Originally lived inside
// subscriptions-browser.tsx; extracted so the Coming-up renewals
// overlay (and any future surface) can render the exact same detail
// view.
//
// Same visual + interaction contract everywhere:
//   • Header: merchant logo + name + category, X to close
//   • Live monthly equivalent + billed amount + cadence
//   • Facts grid: next charge, last charged, status, confidence
//   • Cancel assist CTA (opens parent's CancelModal flow)
//   • Full history link → /app/subscriptions/[id]
//   • Not-a-subscription action (parent handles the API write +
//     optimistic state update)

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  ChevronLeft,
  Scissors,
  Eye,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { MerchantLogo } from "@/components/app/merchant-logo";
import { track } from "@/lib/learning/track";

export type DetailSub = {
  subscription_id: string;
  merchant_name: string;
  domain: string | null;
  category: string;
  monthly_cents: number;
  amount_cents: number;
  currency: string;
  frequency: string;
  next_expected_charge_at: string | null;
  last_charged_at: string | null;
  status: string;
  confidence: number | null;
};

function fmtCategory(c: string): string {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmtCents(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SubscriptionDetailModal({
  sub,
  onClose,
  onMarkNotSub,
  onCancelAssist,
  // Optional: when provided, the modal renders in "stacked-over"
  // mode — a back arrow replaces the close X, the entrance animation
  // slides in from the right (desktop) / up (mobile) like a card
  // drilling on top of the parent overlay, and the z-index sits
  // above any other open overlay. Use from any parent overlay (e.g.
  // the Coming-up renewals list) that wants drill-down behaviour.
  onBack,
}: {
  sub: DetailSub;
  onClose: () => void;
  onMarkNotSub: (sub: DetailSub) => void;
  onCancelAssist: (sub: DetailSub) => void;
  onBack?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [confirmNotSub, setConfirmNotSub] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Stacked-over mode: Esc pops back to the parent overlay rather
      // than dismissing the whole stack. Standalone mode: Esc closes.
      if (typeof onBack === "function") onBack();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onBack]);

  if (!mounted) return null;

  const monthly = sub.monthly_cents;
  const nextDate = fmtDate(sub.next_expected_charge_at);
  const lastDate = fmtDate(sub.last_charged_at);
  const freq = sub.frequency === "unknown" ? "—" : sub.frequency;

  const stacked = typeof onBack === "function";

  return createPortal(
    <div
      // Higher z-index when stacked over another overlay so the new
      // card sits on TOP rather than ghosting behind. fr-modal-fade-in
      // is dropped for stacked mode because the parent already has
      // its own scrim — we only animate the card itself.
      className={[
        "fixed inset-0 flex items-end md:items-center justify-center p-0 md:p-6",
        stacked ? "z-[130]" : "z-[105] fr-modal-fade-in",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-detail-modal-title"
    >
      <button
        type="button"
        onClick={stacked ? onBack : onClose}
        aria-label={stacked ? "Back" : "Close"}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={[
          "relative w-full md:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white shadow-float border border-hairline outline-none",
          stacked ? "fr-modal-slide-in" : "fr-modal-pop",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-hairline px-5 md:px-7 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {stacked ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-ink/[0.05] text-ink-muted hover:text-ink transition shrink-0 -ml-1 fr-tactile"
              >
                <ChevronLeft size={18} strokeWidth={2.2} />
              </button>
            ) : null}
            <MerchantLogo
              name={sub.merchant_name}
              domain={sub.domain}
              size={36}
              rounded="lg"
            />
            <div className="min-w-0">
              <h2
                id="sub-detail-modal-title"
                className="font-display text-[17px] md:text-[18px] font-bold text-ink leading-tight truncate"
              >
                {sub.merchant_name}
              </h2>
              <div className="text-[11.5px] text-ink-muted truncate">
                {fmtCategory(sub.category)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-ink/[0.05] text-ink-muted hover:text-ink transition shrink-0 fr-tactile"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 md:px-7 py-5 md:py-6 space-y-5">
          {/* Monthly + cadence summary */}
          <div className="rounded-2xl border border-hairline bg-canvas/40 p-4">
            <div className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
              Monthly equivalent
            </div>
            <div className="mt-1 text-[28px] md:text-[32px] font-bold text-ink tabular-nums leading-none">
              {fmtCents(monthly)}
              <span className="ml-1.5 text-[13px] font-medium text-ink-muted">
                /mo
              </span>
            </div>
            <div className="mt-2 text-[12.5px] text-ink-body tabular-nums">
              Billed {fmtCents(sub.amount_cents)} · {freq}
            </div>
          </div>

          {/* Facts */}
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Next expected" value={nextDate} />
            <Fact label="Last charged" value={lastDate} />
            <Fact
              label="Status"
              value={sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
            />
            <Fact
              label="Confidence"
              value={
                sub.confidence !== null && sub.confidence !== undefined
                  ? `${Math.round(sub.confidence * 100)}%`
                  : "—"
              }
            />
          </dl>

          {/* Cancel assist */}
          <div className="rounded-2xl border border-hairline bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900">
                <Scissors size={13} strokeWidth={2} />
              </span>
              <div className="text-[13px] font-bold text-ink">Cancel assist</div>
            </div>
            <p className="mt-2 text-[12.5px] text-ink-body leading-relaxed">
              We&apos;ll walk you through the cancel flow with a direct
              link + step-by-step for the trickier merchants.
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  // High-signal behavioural event — feeds the
                  // cancel-providers directory prioritization. Tells
                  // us which subs people actually want to kill, so
                  // the next directory expansion targets the right
                  // merchants first. Sent before opening the cancel
                  // flow so the event captures intent regardless of
                  // whether the user completes the cancellation.
                  track("cancel_intent", {
                    subscription_id: sub.subscription_id,
                    category: sub.category,
                    monthly_cents: sub.monthly_cents,
                    frequency: sub.frequency,
                  });
                  onCancelAssist(sub);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-medium text-white fr-tactile"
                style={{ background: "#0F6E56" }}
              >
                <Scissors size={12} strokeWidth={2} />
                Start cancel assist
              </button>
              <Link
                href={`/app/subscriptions/${sub.subscription_id}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-hairline text-[12px] font-medium text-ink hover:bg-ink/[0.04] transition fr-tactile"
                onClick={onClose}
              >
                <Eye size={12} strokeWidth={2} />
                Full history
                <ExternalLink
                  size={11}
                  strokeWidth={2}
                  className="text-ink-muted"
                />
              </Link>
            </div>
          </div>

          {/* Not a subscription */}
          {confirmNotSub ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={14}
                  strokeWidth={2}
                  className="text-amber-900 mt-0.5 shrink-0"
                />
                <div className="text-[12.5px] text-ink-body leading-relaxed">
                  Mark {sub.merchant_name} as not a subscription? We&apos;ll
                  hide it from totals and remember your call for next scan.
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMarkNotSub(sub)}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-ink text-canvas text-[12.5px] font-medium fr-tactile"
                >
                  <CheckCircle2 size={12} strokeWidth={2} />
                  Yes, not a sub
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmNotSub(false)}
                  className="inline-flex items-center h-9 px-3 rounded-full text-[12px] font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition"
                >
                  Never mind
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmNotSub(true)}
              className="w-full inline-flex items-center justify-center h-10 px-4 rounded-full border border-hairline text-[12.5px] font-medium text-ink-body hover:text-ink hover:bg-ink/[0.04] transition fr-tactile"
            >
              Not a subscription
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas/30 px-3 py-2">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-bold text-ink tabular-nums">
        {value}
      </div>
    </div>
  );
}
