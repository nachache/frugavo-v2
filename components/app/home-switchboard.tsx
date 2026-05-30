// HomeSwitchboard — the new dashboard home.
//
// Calm "switchboard" of heterogeneous cards. The home surface stays
// simple; all richness (confidence scores, reasoning, predictions,
// full calendar) lives one or two taps deeper.
//
// Composition (locked spec — do not redesign):
//   1. Hero band (#0F6E56) — curved bottom, full-bleed
//   2. LIVE status strip — sticky, overlaps up into the hero
//   3. "Frugavo noticed" section header (radar badge + count)
//   4. Featured noticed card (amber tint, filled CTA, ONE per page)
//   5. "Your money" section header (coins badge)
//   6. 2-up row: Renewals (white) + Spending (blue tint)
//   7. "Discover more" section header (sparkles badge)
//   8. 3-up row: Insights (white) + Your card (green tint) + Share (white)
//
// Tint budget per spec: ≤ 3 tinted cards, exactly 1 filled-button card.
//   Amber: Featured noticed (1)
//   Blue:  Spending (2)
//   Green: Your card (3)
//   Filled CTA: Featured noticed only
//   White (with chevron only): Renewals, Insights, Share

import Link from "next/link";
import {
  Radar,
  Coins,
  Sparkles,
  Calendar,
  Wallet,
  ChevronRight,
  ArrowRight,
  Eye,
  ListChecks,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Personality } from "@/lib/personality";
import { RescanButton } from "@/components/app/rescan-button";

// ─── shared helpers ──────────────────────────────────────────────

function fmtRound(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

// ─── Hero band ───────────────────────────────────────────────────

// Hero is a calm, warm canvas surface — not a green block. It shares
// the page background so it flows into the dashboard. Atmosphere
// comes from four small living details:
//
//   1. A gentle wave animation on the hand (long cycle, calm)
//   2. An editorial serif italic accent on the user's first name
//   3. A live status line with a pulsing dot under the subhead
//   4. A barely-perceptible film grain across the band for organic
//      warmth
//
// Everything else is charcoal type on warm ivory. No green flood.
export function HomeHeroBand({
  monitoringCharges,
  findingsCount,
  firstName,
  lastScanIso,
}: {
  monitoringCharges: number;
  findingsCount: number;
  firstName: string | null;
  lastScanIso: string | null;
}) {
  void findingsCount;

  // Compute the "last scan" label server-side so the hero status line
  // is accurate on first paint. The LIVE pill below independently
  // refreshes it; here we keep it as quiet ambient signal.
  const lastScanLabel = (() => {
    if (!lastScanIso) return "moments ago";
    const ms = Date.now() - new Date(lastScanIso).getTime();
    const minutes = Math.max(0, Math.floor(ms / 60_000));
    if (minutes < 1) return "moments ago";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  })();

  return (
    <div className="relative">
      {/* Warm glow at the top — barely there, just enough to give the
          band depth without breaking the unified canvas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 0%, rgba(4,120,87,0.06) 0%, rgba(4,120,87,0.02) 45%, transparent 80%)",
        }}
      />
      {/* Film grain texture — organic warmth, premium-paper feel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 fr-hero-grain opacity-[0.35] mix-blend-multiply"
      />
      <div className="relative container-page max-w-[860px] pt-12 md:pt-20 pb-14 md:pb-20 text-center">
        {/* Hand — gently waves on a 4.2s loop. */}
        <div className="text-[56px] md:text-[72px] leading-none mb-4 md:mb-6 select-none">
          <span className="fr-hand-wave" aria-hidden="true">
            👋
          </span>
        </div>
        {/* Headline — name in editorial serif italic for warmth +
            character. Falls back to "Welcome back" when name unknown. */}
        <h1 className="font-display text-[34px] md:text-[52px] font-bold leading-[1.05] tracking-[-0.02em] text-ink max-w-[760px] mx-auto">
          Welcome back
          {firstName ? (
            <>
              ,{" "}
              <span className="font-editorial italic font-normal text-ink">
                {firstName}
              </span>
            </>
          ) : null}
        </h1>
        <p className="mt-5 md:mt-6 text-[16px] md:text-[18px] text-ink-body leading-relaxed max-w-[560px] mx-auto">
          We&apos;ve been watching your subscriptions.
        </p>
        {/* Calm status line — pulsing dot + soft copy. Anchors the
            hero in time and signals "the system is alive" without
            shouting. */}
        <div className="mt-5 inline-flex items-center gap-2 text-[12px] md:text-[12.5px] text-ink-muted tabular-nums">
          <span
            className="inline-flex h-1.5 w-1.5 rounded-full fr-sync-pulse"
            style={{ background: "#10B981" }}
            aria-hidden="true"
          />
          <span>
            <span className="text-ink-body">{monitoringCharges}</span>{" "}
            monitored · last scan {lastScanLabel}
          </span>
        </div>
      </div>
      <span className="sr-only">
        Monitoring {monitoringCharges} recurring charges
      </span>
    </div>
  );
}

// ─── LIVE status strip ──────────────────────────────────────────

// Sticky strip that overlaps up into the hero band. Stays visible at
// all scroll positions. Shows last scan timestamp + monitoring counts.
export function HomeLiveStatusStrip({
  lastScanIso,
  monitoringCharges,
  watchingRenewals,
}: {
  lastScanIso: string | null;
  monitoringCharges: number;
  watchingRenewals: number;
}) {
  // Compute "{N} min ago" string. We render server-side so it's
  // accurate at first paint; a real-time refresh isn't necessary
  // for this surface.
  const lastScanLabel = (() => {
    if (!lastScanIso) return "just now";
    const ms = Date.now() - new Date(lastScanIso).getTime();
    const minutes = Math.max(0, Math.floor(ms / 60_000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  })();

  return (
    // Calm system-status pill sitting on the warm canvas. No more
    // overlap into the hero (there's no green block to overlap
    // anymore). Sticky just below the layout header so it follows
    // the user on scroll. A subtle canvas wash + backdrop blur keeps
    // page content from ghosting through.
    <div
      className="sticky z-30 mb-3 md:mb-4"
      style={{ top: "64px" }}
    >
      <div
        className="py-2"
        style={{
          background:
            "linear-gradient(180deg, rgba(250,248,244,0.92) 0%, rgba(250,248,244,0.65) 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div className="container-page max-w-[1200px]">
          <div className="inline-flex max-w-full items-center gap-2 sm:gap-2.5 rounded-full bg-surface/85 border border-hairline shadow-soft px-3 sm:px-3.5 h-9 text-[11.5px] sm:text-[12.5px] text-ink whitespace-nowrap overflow-hidden">
            <span className="relative inline-flex items-center justify-center shrink-0">
              <span
                className="inline-flex h-2 w-2 rounded-full fr-sync-pulse"
                style={{ background: "#10B981" }}
                aria-hidden="true"
              />
            </span>
            <span className="font-medium shrink-0">Live</span>
            {/* On mobile we collapse to "monitoring N · watching M".
                Last-scan label hides because it's the lowest-signal
                of the four when space is tight. */}
            <span className="text-ink-muted hidden sm:inline">·</span>
            <span className="text-ink-muted hidden sm:inline shrink-0">
              Last scan {lastScanLabel}
            </span>
            <span className="text-ink-muted shrink-0">·</span>
            <span className="text-ink-muted shrink-0">
              <span className="text-ink font-medium">
                {monitoringCharges}
              </span>{" "}
              monitoring
            </span>
            <span className="text-ink-muted shrink-0">·</span>
            <span className="text-ink-muted shrink-0">
              <span className="text-ink font-medium">{watchingRenewals}</span>{" "}
              renewals
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section header (badge + title + count) ─────────────────────

// Spec: "Badge-next-to-title sits on TOP of every card and every
// section group." This is the SECTION-level version. The card-level
// version is rendered inline in each card below.
function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3 px-1">
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-ink/[0.05] text-ink"
        aria-hidden="true"
      >
        <Icon size={14} strokeWidth={2} />
      </span>
      <span className="text-[15px] font-medium text-ink leading-none">
        {label}
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[12.5px] text-ink-muted leading-none">
          · {count}
        </span>
      )}
    </div>
  );
}

// ─── Card-level header (badge + title) ──────────────────────────

// Sits inside-top of every card. Small rounded icon chip beside the
// label. Tone-tinted when the card is tinted.
function CardBadge({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "amber" | "blue" | "green";
}) {
  const cls = (() => {
    switch (tone) {
      case "amber":
        return "bg-amber-100 text-amber-900";
      case "blue":
        return "bg-sky-100 text-sky-900";
      case "green":
        return "bg-emerald-100 text-emerald-900";
      default:
        return "bg-ink/[0.05] text-ink";
    }
  })();
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${cls}`}
        aria-hidden="true"
      >
        <Icon size={12} strokeWidth={2.2} />
      </span>
      <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
    </div>
  );
}

// ─── Featured noticed card ──────────────────────────────────────

// AMBER tint. The single most important finding. Filled green CTA +
// quiet text link to the full feed. This is the only filled-button
// card on the home page (tint budget rule).
export function FeaturedNoticedCard({
  totalFindings,
  topHeadline,
  topConclusion,
}: {
  totalFindings: number;
  topHeadline: string;
  topConclusion: string;
}) {
  return (
    <Link
      href="/app/noticed"
      className="block h-full rounded-2xl border border-amber-200 bg-amber-50 shadow-soft p-5 md:p-6 transition-colors hover:bg-amber-100/60"
    >
      <CardBadge icon={Eye} label="Needs a look" tone="amber" />
      <h3 className="mt-3 font-display text-[20px] md:text-[22px] font-bold tracking-[-0.01em] text-ink leading-snug">
        {topHeadline}
      </h3>
      <p className="mt-2 text-[14px] md:text-[15px] text-ink-body leading-relaxed">
        {topConclusion}
      </p>
      <div className="mt-5 flex items-center gap-4 flex-wrap">
        <span
          className="inline-flex h-10 items-center justify-center rounded-full px-5 text-[13.5px] font-medium text-white"
          style={{ background: "#0F6E56" }}
        >
          Take a look
        </span>
        <span className="text-[12.5px] text-ink-muted">
          View all {totalFindings} finding{totalFindings === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}

// ─── Renewals card (white) ─────────────────────────────────────

export function RenewalsCard({
  upcomingCount,
  estimatedTotalCents,
  // Bar positions: array of 0..1 floats representing day-of-month
  // positions to render a thin segmented hint. Optional; if absent
  // the bar renders empty.
  barTicks,
}: {
  upcomingCount: number;
  estimatedTotalCents: number;
  barTicks?: number[];
}) {
  return (
    <Link
      href="/app/renewals"
      className="group block rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6 transition-all hover:bg-canvas/40 hover:shadow-float"
    >
      <div className="flex items-start justify-between gap-3">
        <CardBadge icon={Calendar} label="Renewals" />
        <ChevronRight
          size={16}
          strokeWidth={2}
          className="text-ink-muted group-hover:text-ink transition-colors"
        />
      </div>
      <div className="mt-4">
        <div className="text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-none tabular-nums">
          {upcomingCount} coming up
        </div>
        <div className="mt-2 text-[14px] text-ink-body tabular-nums">
          ~{fmtRound(estimatedTotalCents)} · next 14 days
        </div>
      </div>
      {/* Thin segmented bar hinting at charge days. Empty unless ticks
          are passed. The track is hairline, the marks are brand. */}
      <div className="mt-5 relative h-1 rounded-full bg-ink/[0.06]">
        {(barTicks ?? []).map((t, i) => (
          <span
            key={i}
            className="absolute top-0 h-1 w-1 rounded-full"
            style={{
              left: `${Math.max(0, Math.min(100, t * 100))}%`,
              background: "#0F6E56",
              transform: "translateX(-50%)",
            }}
          />
        ))}
      </div>
    </Link>
  );
}

// ─── Spending card (blue tint) ─────────────────────────────────

export function SpendingCard({
  monthlyCents,
  subCount,
  conclusion,
}: {
  monthlyCents: number;
  subCount: number;
  // One-line conclusion, e.g. "Software is 58%". Optional.
  conclusion?: string | null;
}) {
  return (
    <Link
      href="/app/spending"
      className="group block rounded-2xl border border-sky-200 bg-sky-50 shadow-soft p-5 md:p-6 transition-colors hover:bg-sky-100/60"
    >
      <div className="flex items-start justify-between gap-3">
        <CardBadge icon={Wallet} label="Your subs" tone="blue" />
        <ChevronRight
          size={16}
          strokeWidth={2}
          className="text-ink-muted group-hover:text-ink transition-colors"
        />
      </div>
      <div className="mt-4">
        <div className="text-[24px] md:text-[28px] font-bold tracking-[-0.01em] text-ink leading-none tabular-nums">
          {fmtRound(monthlyCents)}/mo
        </div>
        <div className="mt-2 text-[14px] text-ink-body">
          {subCount} subscription{subCount === 1 ? "" : "s"}
        </div>
      </div>
      {conclusion ? (
        <div className="mt-5 flex items-center gap-1.5 text-[14px] text-ink leading-snug">
          <span>{conclusion}</span>
          <ArrowRight size={12} strokeWidth={2.2} className="text-ink-muted" />
        </div>
      ) : null}
    </Link>
  );
}

// ─── Discover-row cards (Insights / Your card / Share) ────────
//
// Slack-style: title + sub + small outlined CTA top-left, big
// isometric block logo decorating the bottom-right. All three share
// the SAME visual template — white bg, hairline border, identical
// button styling — so the row reads as a set. The CardBadge chip
// was removed because the logo now carries the visual identity.

function DiscoverCard({
  href,
  title,
  sub,
  cta,
  logoSrc,
  logoAlt,
}: {
  href: string;
  title: string;
  sub: string;
  cta: string;
  logoSrc: string;
  logoAlt: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6 pr-[120px] md:pr-[140px] min-h-[176px] md:min-h-[200px] overflow-hidden fr-soft-lift fr-tactile hover:bg-canvas/40 hover:shadow-float"
    >
      <div>
        <div className="text-[18px] md:text-[20px] font-bold text-ink leading-snug">
          {title}
        </div>
        <div className="mt-1.5 text-[13.5px] text-ink-muted leading-relaxed max-w-[180px] md:max-w-[200px]">
          {sub}
        </div>
        <span className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-hairline bg-white px-4 text-[12.5px] font-medium text-ink group-hover:bg-ink/[0.04] transition">
          {cta}
        </span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt={logoAlt}
        aria-hidden="true"
        className="pointer-events-none absolute right-1 bottom-0 w-[120px] md:w-[150px] h-auto select-none drop-shadow-sm"
      />
    </Link>
  );
}

export function InsightsCard() {
  return (
    <DiscoverCard
      href="/app/insights"
      title="Patterns, health & trend"
      sub="Score, 12-month chart, category breakdown."
      cta="See insights"
      logoSrc="/cards/insights.png"
      logoAlt="Insights"
    />
  );
}

export function YourCardCard({ personality }: { personality: Personality }) {
  return (
    <DiscoverCard
      href="/app/card"
      title={personality.label}
      sub={personality.sub}
      cta="See your card"
      logoSrc="/cards/your-card.png"
      logoAlt="Your card"
    />
  );
}

export function ShareCard() {
  return (
    <DiscoverCard
      href="/app/share"
      title="Show off your stack"
      sub="Frugavo turns your subs into a card you can post."
      cta="Share stats"
      logoSrc="/cards/share.png"
      logoAlt="Share"
    />
  );
}

// ─── Hero emoji ─────────────────────────────────────────────────

// Hero emoji is owned by HeroLoginEmojiClient (client component) so
// the pick can be pinned to sessionStorage across renders.

// ─── Quick actions row ──────────────────────────────────────────

// Three primary affordances grouped above the install + feedback
// footer. Visible, keyboard-reachable, low-chrome. Re-scan routes
// through /app/scanning so the user gets the progress arc + reveal
// instead of a silent background fetch. Connect another bank links
// to /app/settings where AddBankButton opens Plaid Link inline.
//
// Layout: 1-col on mobile, 3-col from md. Each tile is a plain Link
// with the same border + soft shadow language as the white cards.
export function QuickActionsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <QuickAction
        href="/app/transactions"
        icon={ListChecks}
        label="All transactions"
        hint="See every charge we read"
      />
      <RescanButton variant="row" />
      <QuickAction
        href="/app/settings"
        icon={Plus}
        label="Connect another bank"
        hint="Adds coverage + sub recall"
      />
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-hairline bg-white shadow-soft px-4 py-3.5 transition-all hover:bg-canvas/40 hover:shadow-float"
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-ink/[0.05] text-ink shrink-0"
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink leading-tight">
          {label}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-muted leading-snug truncate">
          {hint}
        </span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={2}
        className="text-ink-muted group-hover:text-ink transition-colors shrink-0"
      />
    </Link>
  );
}

// ─── Section headers (named exports for the page composer) ──────

export function NoticedSectionHeader({ count }: { count: number }) {
  return <SectionHeader icon={Radar} label="Frugavo noticed" count={count} />;
}
export function MoneySectionHeader() {
  return <SectionHeader icon={Coins} label="Your money" />;
}
export function DiscoverSectionHeader() {
  return <SectionHeader icon={Sparkles} label="Discover more" />;
}
