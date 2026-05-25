import type { Metadata } from "next";
import { ConnectFlow } from "@/components/plaid/connect-flow";
import {
  ShieldCheck,
  Lock,
  Power,
  Check,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Find your subscriptions · Frugavo",
};

// /app/connect — single above-the-fold conversion surface.
//
// Design intent (per brief): the user is not "connecting a bank,"
// they're "discovering wasted money." Every section reinforces
// anticipation: a hero that names the outcome, recognizable merchant
// wordmarks so the user mentally pictures their own list, a single
// dark CTA, and a preview of what they're about to see.
//
// Density target: Mercury / Ramp / Linear. Aggressive whitespace
// discipline, very few borders, monochrome supporting elements so the
// CTA is the loudest pixel on the screen.

export default function ConnectPage() {
  return (
    <section className="container-page py-8 md:py-12 max-w-[860px]">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <h1 className="font-display text-[32px] sm:text-[40px] md:text-[52px] font-bold tracking-[-0.035em] leading-[1.02] text-ink">
        Find hidden subscriptions in
        <br className="hidden sm:inline" />{" "}
        <span className="text-brand">under 30 seconds.</span>
      </h1>
      <p className="mt-4 md:mt-5 text-[15.5px] md:text-[17px] leading-relaxed text-ink-body max-w-[640px]">
        See recurring charges, forgotten trials, AI tools, and duplicate
        subscriptions across all your accounts.
      </p>

      {/* ── Merchant wordmark row ─────────────────────────────── */}
      {/* Monochrome text wordmarks set in the brand font. No external
          logos = no Clearbit / CDN dependency, zero layout shift, and
          a uniformly premium look. */}
      <div className="mt-6 md:mt-7 flex flex-wrap items-center gap-x-6 sm:gap-x-7 md:gap-x-8 gap-y-2 text-ink-muted/60">
        {[
          "Netflix",
          "Spotify",
          "ChatGPT",
          "Canva",
          "Adobe",
          "Notion",
          "Apple",
          "Google One",
        ].map((name) => (
          <span
            key={name}
            className="text-[13px] md:text-[14px] font-medium tracking-tight"
          >
            {name}
          </span>
        ))}
      </div>

      {/* ── Trust strip — one row, no boxes ───────────────────── */}
      <div className="mt-6 md:mt-7 flex flex-wrap items-center gap-x-6 sm:gap-x-7 gap-y-2 text-[12.5px] md:text-[13px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-ink-muted/80" strokeWidth={2} />
          Read-only access
        </span>
        <span className="text-ink-muted/30">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Lock size={14} className="text-ink-muted/80" strokeWidth={2} />
          Bank login handled by Plaid
        </span>
        <span className="text-ink-muted/30">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Power size={14} className="text-ink-muted/80" strokeWidth={2} />
          Disconnect anytime
        </span>
      </div>

      {/* ── CTA block ─────────────────────────────────────────── */}
      <div className="mt-8 md:mt-9">
        <ConnectFlow />
      </div>

      {/* ── Expected outcomes — visualize the result before Plaid */}
      <div className="mt-7 md:mt-8">
        <div className="text-[11.5px] md:text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          You&apos;ll see
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Monthly subscription total",
            "Annual spend projection",
            "Forgotten renewals",
            "Duplicate subscriptions",
            "AI tool subscriptions",
          ].map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-canvas/60 px-3 py-1.5 text-[12.5px] md:text-[13px] text-ink"
            >
              <Check
                size={12}
                strokeWidth={2.5}
                className="text-brand shrink-0"
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Plaid trust line — compact, supporting role ───────── */}
      <p className="mt-7 md:mt-8 text-[12px] md:text-[12.5px] text-ink-muted leading-relaxed max-w-[640px]">
        <span className="inline-flex items-center gap-1.5">
          <PlaidGlyph />
          <span className="font-medium text-ink/85">Plaid</span>
        </span>
        {" — "}secure banking infrastructure trusted by Venmo, Robinhood,
        Coinbase, and 11,000+ financial apps across North America.
      </p>
    </section>
  );
}

// Inline 14px Plaid mark — vector so it never breaks if Plaid's
// CDN changes. Same shape as the official square wordmark.
function PlaidGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-ink/85"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
    </svg>
  );
}
