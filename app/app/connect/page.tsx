import type { Metadata } from "next";
import { ConnectFlow } from "@/components/plaid/connect-flow";
import {
  ShieldCheck,
  Lock,
  Power,
  Sparkles,
  Activity,
  Eye,
  Check,
} from "lucide-react";

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
            Uncover the recurring spending{" "}
            <span className="text-brand">you can&apos;t see.</span>
          </h1>
          <p className="mt-4 lg:mt-5 text-[15.5px] lg:text-[16.5px] leading-relaxed text-ink-body max-w-[480px]">
            Frugavo analyzes the last 12 months of your accounts and builds a
            calm intelligence layer over every recurring charge — what
            you&apos;re paying for, what changes, and what to protect against.
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

          {/* Protection section — strategically placed under the CTA
              so the user reads "what this defends me against" right
              after agreeing to start. Reinforces protection positioning
              before the Plaid handoff. Six items in a tight 2-column
              grid; deliberately calm tone, no urgency. */}
          <div className="mt-7 lg:mt-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
              What Frugavo protects against
            </div>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-5 max-w-[480px]">
              {PROTECTION_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] lg:text-[13px] text-ink-body leading-snug"
                >
                  <ShieldCheck
                    size={13}
                    strokeWidth={2.2}
                    className="mt-0.5 shrink-0 text-brand"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plaid trust line — compact, supporting. Pushed below
              the protection list so security framing comes last
              rather than competing with discovery framing. */}
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
// Discovery preview — desktop
// ─────────────────────────────────────────────────────────────
//
// Replaces the sample-subscription preview with three intelligence-led
// sections that communicate the OUTCOME the user is about to receive,
// not the mechanism. The card still uses the faux-browser chrome so
// it reads as "your forthcoming dashboard," but instead of showing
// Netflix / Spotify rows, it lists what Frugavo will detect, calculate,
// and monitor on behalf of the user.
//
// Strategic rationale (from product brief):
//   The connect screen is the last moment before the user crosses
//   into Plaid Link. Their question at this moment is "what am I
//   actually about to get?" — not "what brands will I see in a list?"
//   Discovery framing answers the real question.

// React.ComponentType is intentionally untyped here — Lucide icons
// have a strict ForwardRef signature that fights a generic prop
// shape. Since we only use this for icon components, allowing any
// props is the right pragma.
type DiscoveryGroup = {
  eyebrow: string;
  heading: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  items: string[];
};

// What Frugavo protects against — rendered below the CTA. Order
// matters: most relatable / most-discussed pain points first.
const PROTECTION_ITEMS: string[] = [
  "Forgotten subscriptions",
  "Trial conversions",
  "Silent price increases",
  "Duplicate services",
  "Subscription creep",
  "Hidden recurring spending",
];

const DISCOVERY_GROUPS: DiscoveryGroup[] = [
  {
    eyebrow: "Detect",
    heading: "What Frugavo will find",
    icon: Eye,
    items: [
      "Overlapping services",
      "Subscription traps",
      "Silent price increases",
      "Duplicate subscriptions",
      "Upcoming renewals",
      "Hidden recurring charges",
    ],
  },
  {
    eyebrow: "Calculate",
    heading: "What Frugavo will measure",
    icon: Sparkles,
    items: [
      "Subscription Health Score",
      "Subscription personality",
      "Yearly recurring impact",
      "Spending concentration",
      "Recurring spend trends",
    ],
  },
  {
    eyebrow: "Monitor",
    heading: "What Frugavo will watch for",
    icon: Activity,
    items: [
      "New recurring charges",
      "Price increases over time",
      "Trial conversions",
      "Subscription creep",
      "Unusual recurring activity",
    ],
  },
];

function DashboardPreview() {
  return (
    <div className="relative">
      {/* Subtle background halo — keeps the card feeling "lit." */}
      <div
        className="absolute -inset-6 -z-10 opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, rgba(4,120,87,0.10), transparent 70%)",
        }}
      />

      <div className="rounded-3xl bg-surface border border-hairline shadow-[0_24px_60px_-30px_rgba(10,10,10,0.25)] overflow-hidden">
        {/* Faux browser chrome — kept identical to the prior version so
            users who saw the old preview still recognize the shape. */}
        <div className="px-5 py-3 border-b border-hairline/70 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-ink-muted/25" />
          <span className="w-2 h-2 rounded-full bg-ink-muted/25" />
          <span className="w-2 h-2 rounded-full bg-ink-muted/25" />
          <span className="ml-3 text-[11px] text-ink-muted/70 tracking-tight">
            frugavo.com/app
          </span>
        </div>

        {/* Headline block */}
        <div className="px-6 pt-6 pb-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-brand">
            Your subscription analysis
          </div>
          <div className="mt-1.5 font-display text-[22px] md:text-[24px] font-bold tracking-[-0.02em] text-ink leading-tight">
            Discoveries in the next ~30 seconds
          </div>
          <p className="mt-1 text-[12.5px] text-ink-muted leading-relaxed">
            Calm intelligence over your recurring charges — not a list to
            audit, a layer that notices.
          </p>
        </div>

        {/* Three discovery groups */}
        <div className="px-6 pb-6 space-y-5">
          {DISCOVERY_GROUPS.map((group) => (
            <DiscoveryBlock key={group.eyebrow} group={group} />
          ))}
        </div>
      </div>

      {/* Whisper caption — preview, not yet-your-data. */}
      <p className="mt-3 text-[11.5px] text-ink-muted/70 text-center tracking-tight">
        Preview · your real analysis appears in ~30 seconds
      </p>
    </div>
  );
}

function DiscoveryBlock({ group }: { group: DiscoveryGroup }) {
  const Icon = group.icon;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand/12 text-brand">
          <Icon size={11} strokeWidth={2.2} />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand">
          {group.eyebrow}
        </span>
        <span className="text-[13px] font-medium text-ink">
          {group.heading}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 pl-7">
        {group.items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[12.5px] text-ink-body leading-snug"
          >
            <Check
              size={12}
              strokeWidth={2.6}
              className="mt-0.5 shrink-0 text-brand"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile compact preview — single discovery group, condensed
// ─────────────────────────────────────────────────────────────
//
// On phone we don't have vertical room for the full triptych — we'd
// be pushing the CTA below the fold. The compact version shows just
// the "Detect" group, with a small tail line implying there's more
// where that came from. The desktop card carries the full story.

function DashboardPreviewCompact() {
  const detect = DISCOVERY_GROUPS[0];
  return (
    <div className="mt-2 rounded-2xl bg-surface border border-hairline shadow-[0_12px_30px_-18px_rgba(10,10,10,0.25)] overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-hairline/70">
        <Eye size={13} strokeWidth={2.2} className="text-brand" />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand">
          Detect
        </span>
        <span className="text-[12.5px] font-medium text-ink">
          What Frugavo will find
        </span>
      </div>
      <ul className="px-4 py-3 space-y-1.5">
        {detect.items.slice(0, 4).map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[12.5px] text-ink-body leading-snug"
          >
            <Check
              size={11}
              strokeWidth={2.6}
              className="mt-0.5 shrink-0 text-brand"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="px-4 py-2 border-t border-hairline/70 text-[11px] text-ink-muted">
        + measurements, monitoring, and renewals
      </div>
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
