import type { Metadata } from "next";
import { ConnectFlow } from "@/components/plaid/connect-flow";
import { ShieldCheck, Lock, Power } from "lucide-react";

export const metadata: Metadata = {
  title: "Find your subscriptions · Frugavo",
};

// /app/connect — outcome-driven two-column conversion surface.
//
// LEFT  (emotional conversion):
//   Hero → trust strip → CTA → Plaid trust line.
// RIGHT (anticipation):
//   A faded sample of the dashboard the user is about to see.
//   Realistic merchants, monthly total, annual projection, last-charged
//   dates. Crucially this is NOT a generic illustration — it's a preview
//   of THEIR own deliverable in 30 seconds. Triggers "I want to see
//   MINE" rather than "huh, nice graphic".
//
// Aesthetic: Mercury / Ramp / Copilot / Linear. Monochrome canvas,
// single dark CTA as the loudest pixel, soft shadow on the preview
// card, subtle right-side fade so the preview reads as "yours will
// look like this, faded because it's empty until you scan."
//
// Above-the-fold guarantee: max-w-[1100px], py-8/py-10 on desktop,
// single screen on a 13" laptop. Mobile stacks single-column and the
// preview moves below the CTA.

export default function ConnectPage() {
  return (
    <section className="container-page py-6 md:py-10 max-w-[1140px]">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
        {/* ─────────── LEFT COLUMN — conversion ─────────── */}
        <div className="max-w-[560px]">
          <h1 className="font-display text-[32px] sm:text-[40px] lg:text-[48px] font-bold tracking-[-0.035em] leading-[1.02] text-ink">
            Find hidden subscriptions in{" "}
            <span className="text-brand">under 30 seconds.</span>
          </h1>
          <p className="mt-4 lg:mt-5 text-[15.5px] lg:text-[16.5px] leading-relaxed text-ink-body max-w-[480px]">
            See recurring charges, forgotten trials, AI tools, and duplicate
            subscriptions across all your accounts.
          </p>

          {/* Trust strip — inline, no boxes */}
          <div className="mt-6 lg:mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] lg:text-[13px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} strokeWidth={2} />
              Read-only access
            </span>
            <span className="text-ink-muted/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock size={14} strokeWidth={2} />
              Bank login handled by Plaid
            </span>
            <span className="text-ink-muted/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Power size={14} strokeWidth={2} />
              Disconnect anytime
            </span>
          </div>

          {/* CTA */}
          <div className="mt-7 lg:mt-8">
            <ConnectFlow />
          </div>

          {/* Plaid trust line — compact, supporting */}
          <p className="mt-6 lg:mt-7 text-[12px] lg:text-[12.5px] text-ink-muted leading-relaxed max-w-[460px]">
            <span className="inline-flex items-center gap-1.5">
              <PlaidGlyph />
              <span className="font-medium text-ink/80">Plaid</span>
            </span>
            {" — "}secure banking infrastructure trusted by Venmo, Robinhood,
            Coinbase, and 11,000+ financial apps.
          </p>
        </div>

        {/* ─────────── RIGHT COLUMN — preview ─────────── */}
        {/* Hidden on small screens — wouldn't fit above-the-fold and
            the left column already converts on its own. Re-introduces
            at lg: where there's horizontal real estate. */}
        <div className="hidden lg:block">
          <DashboardPreview />
        </div>

        {/* Mobile-only condensed preview — single hero row, tucked
            below the CTA so it still creates anticipation without
            pushing the conversion below the fold. */}
        <div className="lg:hidden -mt-2">
          <DashboardPreviewCompact />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard preview — desktop
// ─────────────────────────────────────────────────────────────

const SAMPLE_ROWS: Array<{
  name: string;
  category: string;
  amount: string;
  glyph: string;
  glyphBg: string;
}> = [
  { name: "Netflix",   category: "Streaming",      amount: "$15.49", glyph: "N", glyphBg: "#E50914" },
  { name: "Spotify",   category: "Music",          amount: "$11.99", glyph: "S", glyphBg: "#1DB954" },
  { name: "ChatGPT",   category: "AI tools",       amount: "$20.00", glyph: "G", glyphBg: "#10A37F" },
  { name: "Adobe",     category: "Creative",       amount: "$54.99", glyph: "A", glyphBg: "#FA0F00" },
  { name: "Notion",    category: "Productivity",   amount: "$10.00", glyph: "N", glyphBg: "#0A0A0A" },
  { name: "iCloud+",   category: "Storage",        amount: "$2.99",  glyph: "i", glyphBg: "#3B82F6" },
];

function DashboardPreview() {
  return (
    <div className="relative">
      {/* Subtle background halo — makes the card feel "lit" without
          adding a literal gradient panel like the screenshot the user
          showed. Stays brand-aligned. */}
      <div
        className="absolute -inset-6 -z-10 opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, rgba(4,120,87,0.10), transparent 70%)",
        }}
      />

      <div className="rounded-3xl bg-surface border border-hairline shadow-[0_24px_60px_-30px_rgba(10,10,10,0.25)] overflow-hidden">
        {/* Faux browser chrome — three dots top-left. Subtle product
            cue without being a literal screenshot. */}
        <div className="px-5 py-3 border-b border-hairline/70 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-ink-muted/25" />
          <span className="w-2 h-2 rounded-full bg-ink-muted/25" />
          <span className="w-2 h-2 rounded-full bg-ink-muted/25" />
          <span className="ml-3 text-[11px] text-ink-muted/70 tracking-tight">
            frugavo.com/app
          </span>
        </div>

        {/* Headline number block */}
        <div className="px-6 pt-6 pb-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Monthly upkeep
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-[44px] font-bold tracking-[-0.03em] text-ink leading-none">
              $174
            </span>
            <span className="text-[15px] text-ink-muted font-medium">/mo</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-ink-muted">
            $2,088 a year{" "}
            <span className="text-ink-muted/40">·</span>{" "}
            12 subscriptions detected
          </div>

          {/* Mini insights row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="AI tools" value="$45" trend="up" />
            <MiniStat label="Trials converting" value="2" trend="warn" />
            <MiniStat label="Duplicates" value="1" trend="alert" />
          </div>
        </div>

        {/* Sample subscription rows */}
        <div className="px-6 pb-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted mb-2">
            Worth a look
          </div>
          <ul className="divide-y divide-hairline/70">
            {SAMPLE_ROWS.map((row) => (
              <li
                key={row.name}
                className="flex items-center gap-3 py-2.5"
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold text-white shrink-0"
                  style={{ background: row.glyphBg }}
                  aria-hidden="true"
                >
                  {row.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-ink truncate">
                    {row.name}
                  </div>
                  <div className="text-[11.5px] text-ink-muted truncate">
                    {row.category}
                  </div>
                </div>
                <div className="text-[13px] font-medium tabular-nums text-ink shrink-0">
                  {row.amount}
                  <span className="text-ink-muted">/mo</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom gradient fade — communicates "and more below" */}
        <div className="relative h-12">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(250,248,244,0.95) 70%, var(--surface,#fff) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="text-[11px] text-ink-muted/70 tracking-tight">
              + 6 more
            </span>
          </div>
        </div>
      </div>

      {/* Whisper caption — disambiguates "this is a preview, not your
          actual data" without breaking the spell. */}
      <p className="mt-3 text-[11.5px] text-ink-muted/70 text-center tracking-tight">
        Sample preview · your numbers in ~30 seconds
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: "up" | "warn" | "alert";
}) {
  const dotColor =
    trend === "up"
      ? "#10b981"
      : trend === "warn"
        ? "#f59e0b"
        : "#ef4444";
  return (
    <div className="rounded-xl bg-canvas/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: dotColor }}
          aria-hidden="true"
        />
        <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-muted">
          {label}
        </span>
      </div>
      <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink leading-tight">
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile compact preview — three rows max
// ─────────────────────────────────────────────────────────────

function DashboardPreviewCompact() {
  return (
    <div className="mt-2 rounded-2xl bg-surface border border-hairline shadow-[0_12px_30px_-18px_rgba(10,10,10,0.25)] overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-hairline/70">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Sample preview
        </span>
        <span className="text-[12px] text-ink-muted tabular-nums">
          $174/mo
        </span>
      </div>
      <ul className="px-4 py-2 divide-y divide-hairline/70">
        {SAMPLE_ROWS.slice(0, 3).map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-2.5 py-2"
          >
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10.5px] font-bold text-white shrink-0"
              style={{ background: row.glyphBg }}
              aria-hidden="true"
            >
              {row.glyph}
            </span>
            <span className="text-[12.5px] font-medium text-ink flex-1 truncate">
              {row.name}
            </span>
            <span className="text-[12px] tabular-nums text-ink-muted">
              {row.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline Plaid glyph
// ─────────────────────────────────────────────────────────────

function PlaidGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-ink/80"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
    </svg>
  );
}
