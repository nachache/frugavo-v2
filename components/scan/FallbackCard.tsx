"use client";

import Link from "next/link";
import { Mail } from "lucide-react";

// Rendered when 8s have elapsed without a first row landing. The user is
// detached from the request and routed back to the dashboard with the
// promise of an email when the scan completes (spec section 1, fallback
// detach UX).

export function FallbackCard() {
  return (
    <div className="rounded-3xl bg-white border border-hairline/60 p-8 max-w-[520px] mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
        <Mail size={20} />
      </div>
      <h2 className="mt-5 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
        This one&apos;s a slow account
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-body">
        Some banks take a few minutes to release their transaction history.
        We&apos;ll keep working in the background and email you the moment
        your subscriptions are ready — no need to wait here.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/app"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white hover:bg-ink/85 transition"
        >
          Back to dashboard
        </Link>
        <Link
          href="/learn"
          className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          Read about how it works
        </Link>
      </div>
    </div>
  );
}
