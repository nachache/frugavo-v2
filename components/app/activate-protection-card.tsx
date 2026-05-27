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

// v12 IA shift — the activate card has been demoted from "Layer 3
// content in Layer 1 position" to "Layer 3 monitoring section at the
// bottom of the page." Copy reframed from insurance-style alarm
// ("You're not protected yet") to operator-style invitation ("Turn
// on background monitoring"). The detection IS the product; this
// card adds continuous watching on top.
const COPY: Record<Variant, Copy> = {
  none: {
    label: "Background monitoring",
    headline: "Turn on background monitoring.",
    body: "Frugavo will watch your connected accounts for new charges, price increases, trial conversions, and unusual recurring activity — plus unlock cancel-assist and daily re-scans.",
    cta: "Turn on monitoring",
    subline: "7 days free. Cancel anytime.",
  },
  expired: {
    label: "Monitoring paused",
    headline: "Resume background monitoring.",
    body: "Your watching is currently inactive. Restart in one click and Frugavo picks up where it left off.",
    cta: "Resume monitoring",
    subline: "Resumes the moment you turn it back on.",
  },
  past_due: {
    label: "Payment needs attention",
    headline: "Your monitoring is paused.",
    body: "We couldn't process the last payment. Restart with an updated card and monitoring resumes immediately.",
    cta: "Update payment",
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
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-6 animate-fadeUp">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1 max-w-[640px]">
          <span className="text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
            {copy.label}
          </span>
          <h2 className="mt-2 font-display text-[18px] md:text-[22px] font-semibold tracking-[-0.015em] leading-[1.2] text-ink">
            {copy.headline}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-body">
            {copy.body}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={activate}
            disabled={loading}
            className="inline-flex h-10 md:h-11 items-center gap-2 rounded-full bg-ink px-4 md:px-5 text-[13.5px] md:text-[14px] font-medium text-canvas hover:bg-ink/85 transition disabled:opacity-60 disabled:cursor-wait"
          >
            {loading ? "Opening…" : copy.cta}
          </button>
          <span className="text-[11.5px] text-ink-muted">
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
