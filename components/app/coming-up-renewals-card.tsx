"use client";

// ComingUpRenewalsCard — small "next up" tile that sits to the right
// of the Featured noticed card on the dashboard.
//
// Shows 2–3 of the soonest upcoming renewals (logo + name + dollar +
// date). Tap → opens an overlay listing the full upcoming set (no
// calendar grid — just a clean list). Each row in the overlay also
// links to the subscription detail.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Calendar, ChevronRight, X } from "lucide-react";
import { MerchantLogo } from "@/components/app/merchant-logo";
import {
  SubscriptionDetailModal,
  type DetailSub,
} from "@/components/app/subscription-detail-modal";
import { CancelModal } from "@/components/app/cancel-modal";
import type { SubLike } from "@/lib/subscription-math";

// Full payload — carries every field the shared detail modal needs so
// clicking a row in the Coming-up overlay opens the same overlay as
// the Your-subs browser without a second fetch.
export type UpcomingRenewal = {
  subscription_id: string;
  merchant_name: string;
  domain: string | null;
  next_iso: string;
  monthly_cents: number;
  amount_cents: number;
  currency: string;
  category: string;
  frequency: string;
  last_charged_at: string | null;
  status: string;
  confidence: number | null;
};

function fmtCents(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((d - now) / (24 * 60 * 60 * 1000)));
}

export function ComingUpRenewalsCard({
  upcoming,
  maxPreview = 3,
}: {
  upcoming: UpcomingRenewal[];
  maxPreview?: number;
}) {
  const [open, setOpen] = useState(false);
  const preview = upcoming.slice(0, maxPreview);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full h-full flex-col text-left rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6 transition-all hover:bg-canvas/40 hover:shadow-float min-h-[176px]"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-ink/[0.05] text-ink"
            aria-hidden="true"
          >
            <Calendar size={12} strokeWidth={2.2} />
          </span>
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            Coming up
          </span>
        </div>
        {preview.length === 0 ? (
          <div className="mt-4 text-[13px] text-ink-muted leading-relaxed">
            Nothing in the next 14 days.
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {preview.map((r) => (
              <li
                key={r.subscription_id}
                className="flex items-center gap-2.5"
              >
                <MerchantLogo
                  name={r.merchant_name}
                  domain={r.domain}
                  size={24}
                  rounded="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-ink truncate leading-tight">
                    {r.merchant_name}
                  </div>
                  <div className="text-[11px] text-ink-muted tabular-nums">
                    {fmtDate(r.next_iso)} · in {daysUntil(r.next_iso)}d
                  </div>
                </div>
                <div className="text-[12.5px] font-bold text-ink tabular-nums shrink-0">
                  {fmtCents(r.monthly_cents)}
                </div>
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > maxPreview ? (
          <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-900">
            See all {upcoming.length}
            <ChevronRight
              size={12}
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </div>
        ) : null}
      </button>
      {open ? (
        <UpcomingOverlay
          upcoming={upcoming}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function UpcomingOverlay({
  upcoming,
  onClose,
}: {
  upcoming: UpcomingRenewal[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Stacked overlays: a row click opens the shared SubscriptionDetailModal
  // ABOVE this list. Cancel assist opens CancelModal on top of that.
  const [openSub, setOpenSub] = useState<UpcomingRenewal | null>(null);
  const [cancelTarget, setCancelTarget] = useState<UpcomingRenewal | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If a sub detail is open, let its own listener close it first.
        if (openSub || cancelTarget) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, openSub, cancelTarget]);

  const markNotSub = async (r: UpcomingRenewal) => {
    setOpenSub(null);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: r.subscription_id,
          override_type: "not_subscription",
        }),
      });
    } catch {
      // optimistic — reconciles on refresh
    }
    router.refresh();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-6 fr-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upcoming-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full md:max-w-[520px] max-h-[90vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-white shadow-float border border-hairline outline-none overflow-hidden fr-modal-pop"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-hairline px-5 md:px-7 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900">
              <Calendar size={15} strokeWidth={2} />
            </span>
            <h2
              id="upcoming-modal-title"
              className="font-display text-[17px] md:text-[19px] font-bold tracking-[-0.01em] text-ink leading-tight"
            >
              Coming up
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-ink/[0.05] text-ink-muted hover:text-ink transition"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-5 md:px-7 py-10 text-center text-[13px] text-ink-muted">
            Nothing scheduled in the next two weeks.
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto divide-y divide-hairline/60">
            {upcoming.map((r) => (
              <li key={r.subscription_id}>
                <button
                  type="button"
                  onClick={() => setOpenSub(r)}
                  className="w-full text-left flex items-center gap-3 px-5 md:px-7 py-3.5 hover:bg-canvas/40 transition"
                >
                  <MerchantLogo
                    name={r.merchant_name}
                    domain={r.domain}
                    size={32}
                    rounded="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-ink truncate">
                      {r.merchant_name}
                    </div>
                    <div className="text-[11.5px] text-ink-muted tabular-nums">
                      {fmtDate(r.next_iso)} · in {daysUntil(r.next_iso)}d
                    </div>
                  </div>
                  <div className="text-[13.5px] font-bold text-ink tabular-nums shrink-0">
                    {fmtCents(r.monthly_cents)}
                  </div>
                  <ChevronRight
                    size={14}
                    strokeWidth={2}
                    className="text-ink-muted shrink-0"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stacked drill-down: sub detail slides over the upcoming list
          with a back arrow that returns to the list. onBack triggers
          stacked-mode (slide animation + higher z-index + back arrow);
          onClose dismisses BOTH overlays so the user lands back on
          the dashboard. */}
      {openSub ? (
        <SubscriptionDetailModal
          sub={toDetailSub(openSub)}
          onBack={() => setOpenSub(null)}
          onClose={() => {
            setOpenSub(null);
            onClose();
          }}
          onMarkNotSub={() => markNotSub(openSub)}
          onCancelAssist={() => {
            const target = openSub;
            setOpenSub(null);
            setCancelTarget(target);
          }}
        />
      ) : null}

      {/* CancelModal stacks on top when the user picks cancel assist. */}
      {cancelTarget ? (
        <CancelModal
          sub={toCancelSubLike(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onConfirmed={() => {
            setCancelTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>,
    document.body
  );
}

// Adapt our UpcomingRenewal into the shared modal contract.
function toDetailSub(r: UpcomingRenewal): DetailSub {
  return {
    subscription_id: r.subscription_id,
    merchant_name: r.merchant_name,
    domain: r.domain,
    category: r.category,
    monthly_cents: r.monthly_cents,
    amount_cents: r.amount_cents,
    currency: r.currency,
    frequency: r.frequency,
    next_expected_charge_at: r.next_iso,
    last_charged_at: r.last_charged_at,
    status: r.status,
    confidence: r.confidence,
  };
}

// Adapt our UpcomingRenewal into the SubLike contract CancelModal wants.
function toCancelSubLike(r: UpcomingRenewal): SubLike {
  return {
    id: r.subscription_id,
    merchant_name: r.merchant_name,
    amount_cents: r.amount_cents,
    currency: r.currency,
    frequency: r.frequency,
    last_charged_at: r.last_charged_at,
    next_expected_charge_at: r.next_iso,
    status: r.status,
  };
}
