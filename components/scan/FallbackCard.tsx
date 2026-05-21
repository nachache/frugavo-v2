"use client";

import { Loader2, Mail } from "lucide-react";

// Slow-account interstitial. Reached only when the SLOW_THRESHOLD_MS
// (25s by default) has elapsed AND no scan data has arrived yet AND
// the scan hasn't reported complete.
//
// Interruptible: this card never owns navigation. The parent
// StreamingList unmounts it the instant data arrives, even partially.
// The "Go to dashboard" button is a recovery path for users who don't
// want to keep waiting — the scan keeps running in the background and
// the dashboard will refresh once it finishes.

type Props = {
  onContinue?: () => void;
};

export function FallbackCard({ onContinue }: Props) {
  return (
    <div className="rounded-3xl bg-white border border-hairline/60 p-8 max-w-[520px] mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
        <Mail size={20} />
      </div>
      <h2 className="mt-5 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
        This one&apos;s a slow account
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        Some banks take longer to release their transaction history. We&apos;re
        still working on it in the background — the dashboard will populate
        the moment it finishes, even if you navigate away.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 text-[12.5px] text-ink-muted">
        <Loader2 size={13} className="animate-spin text-brand" />
        Still scanning…
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onContinue}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
        >
          Go to dashboard
        </button>
        <a
          href="/learn"
          className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          Read about how it works
        </a>
      </div>
    </div>
  );
}
