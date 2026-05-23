"use client";

import { useState } from "react";

// Locked-feature wrapper for free users on the dashboard.
//
// Renders sample content behind a soft frosted-glass blur (2.5px)
// with a centered "Available with Protection" pill and a CTA to
// activate. Aspirational, never punitive — the content is faintly
// visible so the user sees there IS depth here, just out of reach
// until activation.
//
// One unit tested first per your request. If the look lands, I'll
// generalize this into a wrapper that takes children + label and
// roll it across MonitoringAlertsCard, WhatChangedCard, and
// UncertainPromptCards.

type Props = {
  title: string;
  body: string;
  // Sample inner content shown blurred. Shape mirrors the real
  // MonitoringAlertsCard so the silhouette matches what they'd see
  // once activated.
  sampleRows: { dot: string; title: string; sub: string }[];
};

export function ProtectionLockedCard({ title, body, sampleRows }: Props) {
  const [loading, setLoading] = useState(false);

  async function activate() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      window.location.href = "/app/protection";
    } catch {
      window.location.href = "/app/protection";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 md:p-7 animate-fadeUp">
      {/* Header row stays sharp so the user can read the label */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] md:text-[16px] font-medium text-ink">
              {title}
            </h3>
            <span className="inline-flex items-center rounded-full border border-brand/25 bg-brand/[0.08] px-1.5 h-[18px] text-[9.5px] font-medium uppercase tracking-[0.1em] text-brand leading-none">
              Protection
            </span>
          </div>
          <p className="mt-1 text-[12.5px] md:text-[13px] text-ink-body leading-snug max-w-[480px]">
            {body}
          </p>
        </div>
      </div>

      {/* Blurred sample silhouette + pill */}
      <div className="relative">
        <div
          className="divide-y divide-hairline"
          style={{ filter: "blur(2.5px)", opacity: 0.55 }}
          aria-hidden="true"
        >
          {sampleRows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: r.dot }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] md:text-[14px] font-medium text-ink truncate">
                  {r.title}
                </div>
                <div className="text-[11.5px] text-ink-muted">{r.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Centered "Available with Protection" CTA — small, elegant */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={activate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/95 backdrop-blur-sm px-4 h-10 text-[13px] font-medium text-ink shadow-sm hover:bg-surface transition disabled:opacity-70 disabled:cursor-wait"
          >
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
            <span>{loading ? "Opening…" : "Activate Protection to unlock"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
