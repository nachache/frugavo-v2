"use client";

// ProtectionAlertCard — peace-of-mind tile on the dashboard.
//
// Spec: communicate WHAT Frugavo watches for the user without leaving
// the dashboard. Card opens a modal with the four protection
// promises:
//
//   1. Heads-up before any bill hits — surfaces upcoming charges
//      with enough lead time to cancel if you want to.
//   2. Guided cancel — direct cancel link + step-by-step, so you
//      don't fight with hidden flows.
//   3. Price-creep flag — flag when a sub quietly raises its price.
//   4. Biller unmask — see the real merchant behind Apple / Google
//      Play / Paddle wrappers, with badges.
//
// Visual language matches the other tinted home cards (green tone)
// so it sits alongside Insights / Your card / Share without
// breaking the tint budget — replaces one of the white tiles if
// added to the 3-up row.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Shield,
  BellRing,
  Scissors,
  TrendingUp,
  BadgeCheck,
  X,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ProtectionAlertCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50 shadow-soft p-5 md:p-6 transition-all hover:bg-emerald-100/60 hover:shadow-float"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-900"
            aria-hidden="true"
          >
            <Shield size={12} strokeWidth={2.2} />
          </span>
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-emerald-900/80">
            Protection
          </span>
        </div>
        <div className="mt-4">
          <div className="text-[18px] md:text-[20px] font-bold text-ink leading-snug">
            What Frugavo watches for you
          </div>
          <div className="mt-1.5 text-[13.5px] text-ink-body leading-relaxed">
            Heads-up alerts, guided cancels, price-creep checks, and the
            real biller behind every charge.
          </div>
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-emerald-900">
          See what we watch
          <ArrowRight
            size={13}
            strokeWidth={2}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </button>
      {open && <ProtectionModal onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Modal ──────────────────────────────────────────────────────

function ProtectionModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Trap focus to the modal so background tabbing doesn't leak.
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    // Lock page scroll while the modal is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 fr-modal-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protection-modal-title"
    >
      {/* Scrim */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      {/* Sheet / dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full md:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white shadow-float border border-hairline outline-none fr-modal-pop"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-hairline px-5 md:px-7 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900"
              aria-hidden="true"
            >
              <Shield size={15} strokeWidth={2} />
            </span>
            <h2
              id="protection-modal-title"
              className="font-display text-[18px] md:text-[20px] font-bold tracking-[-0.01em] text-ink leading-tight"
            >
              What Frugavo watches for you
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
        <div className="px-5 md:px-7 py-5 md:py-6 space-y-4">
          <p className="text-[13.5px] text-ink-body leading-relaxed">
            Four quiet promises. We watch in the background and ping you
            only when something matters.
          </p>
          <FeatureRow
            icon={BellRing}
            title="Heads-up before any bill hits"
            body="Upcoming charges land in your inbox or notifications with enough lead time to keep, downgrade, or cancel."
          />
          <FeatureRow
            icon={Scissors}
            title="Guided cancel"
            body="Direct cancel link + step-by-step for the trickier ones. No fighting hidden retention flows on your own."
          />
          <FeatureRow
            icon={TrendingUp}
            title="Price-creep flag"
            body="If a sub quietly raises its price, you'll see a before / after the next time you open Frugavo."
          />
          <FeatureRow
            icon={BadgeCheck}
            title="Biller unmask"
            body="When charges arrive through Apple, Google Play, or Paddle, we surface the real merchant with a clear badge so you know what you're paying for."
          />
        </div>
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-hairline px-5 md:px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-full px-5 text-[13.5px] font-medium text-white"
            style={{ background: "#0F6E56" }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function FeatureRow({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-hairline bg-canvas/40 p-4">
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 shrink-0"
        aria-hidden="true"
      >
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-bold text-ink leading-snug">
          {title}
        </div>
        <p className="mt-1 text-[12.5px] text-ink-body leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}
