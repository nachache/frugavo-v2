"use client";

import { useState } from "react";
import Link from "next/link";

// Top-of-dashboard banner shown when the user's billing state needs
// attention. Three variants:
//
//   grace_period    — payment failed, dunning in progress. CTA:
//                     update card. Tone: heads-up, not alarming.
//   cancelled_active— user cancelled but their paid period hasn't
//                     ended yet. CTA: resume (we can reverse the
//                     cancel). Tone: "you can change your mind".
//   past_due        — grace exhausted. CTA: restart protection.
//                     Tone: action needed, monitoring paused.
//
// Closed-state is per-session only (localStorage would mute the
// banner across sessions — for billing problems we want them to
// re-surface).

type Variant = "grace_period" | "cancelled_active" | "past_due";

type Copy = {
  label: string;
  message: string;
  cta: string;
  href: string;
  tone: "warning" | "danger" | "notice";
};

const COPY: Record<Variant, Copy> = {
  grace_period: {
    label: "Payment issue",
    message:
      "Your last payment didn't go through. Monitoring is still on while Stripe retries — update your card to keep it that way.",
    cta: "Update payment method",
    href: "/api/billing/portal",
    tone: "warning",
  },
  cancelled_active: {
    label: "Protection ending",
    message:
      "You cancelled — monitoring will end at the end of your current billing period. Change your mind any time before then.",
    cta: "Resume protection",
    href: "/api/billing/portal",
    tone: "notice",
  },
  past_due: {
    label: "Protection paused",
    message:
      "We've paused monitoring after three weeks of declined retries. Restart in one click and we'll resume immediately.",
    cta: "Restart protection",
    href: "/app/billing/restart",
    tone: "danger",
  },
};

const TONE_CLASSES: Record<Copy["tone"], string> = {
  warning:
    "bg-accent/10 border-accent/30 text-ink",
  danger: "bg-danger/10 border-danger/30 text-ink",
  notice: "bg-brand/10 border-brand/30 text-ink",
};

const BUTTON_TONE: Record<Copy["tone"], string> = {
  warning: "bg-accent hover:bg-accent/90 text-white",
  danger: "bg-danger hover:bg-danger/90 text-white",
  notice: "bg-brand hover:bg-brand-hover text-white",
};

export function BillingStatusBanner({ variant }: { variant: Variant }) {
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(false);
  const copy = COPY[variant];

  if (closed) return null;

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // For the portal link, hit the API and follow the redirect.
    // For /app/billing/restart, let the link navigate normally.
    if (!copy.href.startsWith("/api/")) return;
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(copy.href, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      // Portal might not be configured yet — fall back to settings
      // page so the user has somewhere to land.
      window.location.href = "/app/settings";
    } catch {
      window.location.href = "/app/settings";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="status"
      className={`rounded-2xl border px-4 py-3 md:px-5 md:py-4 flex items-start gap-3 ${TONE_CLASSES[copy.tone]} animate-fadeUp`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.12em] opacity-70">
          {copy.label}
        </div>
        <p className="mt-1 text-[13.5px] md:text-[14.5px] leading-relaxed">
          {copy.message}
        </p>
        <div className="mt-2 md:mt-3">
          <a
            href={copy.href}
            onClick={handleClick}
            className={`inline-flex h-9 md:h-10 items-center gap-2 rounded-full px-4 md:px-5 text-[13px] md:text-[14px] font-medium transition disabled:opacity-60 ${BUTTON_TONE[copy.tone]}`}
            aria-disabled={loading}
          >
            {loading ? "Opening…" : copy.cta}
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setClosed(true)}
        className="shrink-0 text-ink-muted hover:text-ink transition"
        aria-label="Dismiss"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
