"use client";

import { useState } from "react";

// /app/protection landing for free users — the persistent
// monetization surface anchored by the bottom-nav Protection tab.
//
// What the user sees:
//   - A clean intro: "What Frugavo can catch for you"
//   - 4 sample "caught" cards rendered with their own data when
//     possible, faded + blurred so they read as "available with
//     Protection" rather than "blocked content"
//   - One CTA: "Activate Protection — 7 days free"
//
// Critical: the blur must feel aspirational, not punitive. We use
// 3px blur + 60% opacity overlay so:
//   - typography is faintly visible (you can almost read it)
//   - numbers blur enough to feel "behind frosted glass"
//   - the lock is small and elegant, not loud

type SampleRow = {
  label: string;
  body: string;
};

const SAMPLES: SampleRow[] = [
  {
    label: "New subscription detected",
    body: "Apple One started billing $19.95/mo on Apr 14.",
  },
  {
    label: "Price increase",
    body: "Netflix went from $15.49 → $17.99/mo. +16% jump.",
  },
  {
    label: "Trial converting",
    body: "Notion AI converts to $10/mo in 2 days.",
  },
  {
    label: "Dormant charge resumed",
    body: "Audible billed $14.95 after 8 months of inactivity.",
  },
];

export function ProtectionUpsellPreview({ userId: _userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className="container-page py-6 md:py-12 max-w-[900px] space-y-6 md:space-y-8">
      <div>
        <span className="text-[12px] md:text-[13px] font-medium text-brand">
          Protection
        </span>
        <h1 className="mt-1.5 md:mt-2 font-display text-[30px] sm:text-[36px] md:text-[44px] font-bold tracking-[-0.03em] leading-[1.05] text-ink">
          What Frugavo can catch for you
        </h1>
        <p className="mt-2 md:mt-3 text-[14px] md:text-[15px] leading-relaxed text-ink-body">
          Activate Protection and Frugavo keeps watching every day. The
          first time a trial converts, a price hikes, or a dormant charge
          resumes — you&apos;ll know before it hits your account.
        </p>
      </div>

      {/* Sample caught feed — faded so it reads as "preview" */}
      <div className="relative rounded-2xl border border-hairline bg-surface p-5 md:p-7">
        <div className="text-[15px] md:text-[16px] font-medium text-ink mb-4">
          Sample of what we&apos;d catch
        </div>
        <div className="relative">
          <div
            className="divide-y divide-hairline"
            style={{ filter: "blur(2.5px)", opacity: 0.55 }}
            aria-hidden="true"
          >
            {SAMPLES.map((s) => (
              <div key={s.label} className="flex items-start gap-3 py-3">
                <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-brand shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] md:text-[14.5px] font-medium text-ink">
                    {s.label}
                  </div>
                  <div className="text-[12.5px] text-ink-body mt-0.5">
                    {s.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Subtle lock affordance — small, never aggressive */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/90 backdrop-blur-sm px-3.5 h-9 text-[12.5px] font-medium text-ink shadow-sm">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brand"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Available with Protection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage list */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7">
        <div className="text-[15px] md:text-[16px] font-medium text-ink mb-3">
          What you&apos;ll get
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <Feature title="Daily monitoring" body="We re-check every connected account, every day." />
          <Feature title="Trial conversion alerts" body="Heads-up 24 hours before a free trial becomes a paid charge." />
          <Feature title="Price-hike detection" body="Flagged when a subscription raises its price — even small jumps." />
          <Feature title="Dormant + duplicate alerts" body="Caught when an old service resumes or you're paying for the same thing twice." />
        </div>
      </div>

      {/* Activate CTA */}
      <div className="rounded-2xl border border-brand/30 bg-brand/[0.06] p-5 md:p-8 text-center">
        <h2 className="font-display text-[22px] md:text-[28px] font-bold tracking-[-0.02em] leading-tight text-ink">
          Try Protection for 7 days, free.
        </h2>
        <p className="mt-2 text-[13.5px] md:text-[14.5px] text-ink-body max-w-[520px] mx-auto">
          $14.99/mo after the trial. Cancel from your settings any time.
        </p>
        <button
          type="button"
          onClick={activate}
          disabled={loading}
          className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-brand text-white font-semibold text-[15px] px-7 hover:bg-brand-hover transition disabled:opacity-70 disabled:cursor-wait"
        >
          {loading ? "Opening checkout…" : "Activate Protection"}
        </button>
        {error && (
          <p className="mt-3 text-[13px] text-danger">{error}</p>
        )}
      </div>
    </section>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-hairline px-3.5 py-3">
      <div className="text-[13.5px] md:text-[14px] font-medium text-ink">
        {title}
      </div>
      <div className="mt-0.5 text-[12px] md:text-[12.5px] text-ink-body leading-snug">
        {body}
      </div>
    </div>
  );
}
