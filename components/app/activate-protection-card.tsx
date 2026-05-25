"use client";

import { useState } from "react";

// Activate Protection card — appears above the dashboard hero
// whenever the user is NOT on a paid plan (entitlement_state in
// 'none', 'expired', 'past_due'). One CTA: Activate Protection.
//
// Per build doc copy framing: never say "subscribe", "purchase",
// or "plan". Say "protected", "covered", "watching".

type Variant = "none" | "expired" | "past_due";

type Copy = {
  label: string;
  headline: string;
  body: string;
  cta: string;
  subline: string;
};

const COPY: Record<Variant, Copy> = {
  none: {
    label: "Not protected",
    headline: "You're not protected yet.",
    body: "Right now nothing is watching your accounts. Activate protection and Frugavo will catch new charges, price hikes, trial conversions, and unusual recurring activity before they hit — plus unlock cancel-assist and daily re-scans.",
    cta: "Activate Protection",
    subline: "7 days free. Cancel anytime.",
  },
  expired: {
    label: "Protection paused",
    headline: "Re-activate your protection.",
    body: "Your monitoring is currently inactive. Restart in one click and Frugavo will pick up watching your accounts immediately.",
    cta: "Restart Protection",
    subline: "Resumes monitoring as soon as you activate.",
  },
  past_due: {
    label: "Action needed",
    headline: "Your protection has paused.",
    body: "We couldn't process your last payment. Restart with an updated card and Frugavo will resume monitoring your accounts.",
    cta: "Restart Protection",
    subline: "Takes 30 seconds.",
  },
};

export function ActivateProtectionCard({ variant }: { variant: Variant }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[variant];

  async function activate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError("Couldn't open checkout — please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't open checkout — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1 max-w-[640px]">
          <span className="text-[12px] md:text-[13px] font-medium text-brand">
            {copy.label}
          </span>
          <h2 className="mt-1.5 font-display text-[22px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.15] text-ink">
            {copy.headline}
          </h2>
          <p className="mt-2 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
            {copy.body}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={activate}
            disabled={loading}
            className="inline-flex h-11 md:h-12 items-center gap-2 rounded-full bg-brand px-5 md:px-6 text-[14px] md:text-[15px] font-medium text-white hover:bg-brand-hover transition disabled:opacity-60 disabled:cursor-wait"
          >
            {loading ? "Opening…" : copy.cta}
          </button>
          <span className="text-[11.5px] md:text-[12px] text-ink-muted">
            {copy.subline}
          </span>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-[13px] text-danger">{error}</p>
      )}
    </div>
  );
}
