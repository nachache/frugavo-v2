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
  BarChart3,
  BadgeCheck,
  Share2,
  ChevronRight,
  ArrowRight,
  Eye,
  ListChecks,
  RefreshCw,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Personality } from "@/lib/personality";

// ─── shared helpers ──────────────────────────────────────────────

function fmtRound(c: number): string {
  return `$${Math.round(c / 100).toLocaleString("en-US")}`;
}

// ─── Hero band ───────────────────────────────────────────────────

// Curved-bottom green band that bleeds to the very top of the viewport
// behind the sticky layout header. Page starts in green and resolves
// into white as the user scrolls.
export function HomeHeroBand({
  monitoringCharges,
}: {
  monitoringCharges: number;
}) {
  return (
    <div
      className="relative"
      style={{
        background: "#0F6E56",
        // Pull up under the layout's sticky 64px header so the page
        // starts in green. The container header has a translucent
        // canvas backdrop, so a slight tint shows through.
        marginTop: "-64px",
        paddingTop: "calc(64px + env(safe-area-inset-top))",
        // Convex curve at the bottom — generous (44px / ~50% feel)
        // so it reads as a soft wave not a hard shape.
        borderBottomLeftRadius: "44px",
        borderBottomRightRadius: "44px",
      }}
    >
      <div className="container-page max-w-[1200px] pt-12 md:pt-16 pb-16 md:pb-20 text-center">
        {/* Rotating emoji — picks a new one per render so the hero
            feels alive without ever feeling gamified. The set is
            calm, ~7 picks; we pseudo-random per minute so the same
            visit doesn't flicker. */}
        <HeroEmoji />

        <h1 className="mt-3 font-display text-[28px] md:text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-white max-w-[680px] mx-auto">
          Watching your subscriptions
        </h1>
        <p className="mt-3 text-[15px] md:text-[16px] text-white/80 leading-relaxed max-w-[560px] mx-auto">
          Everything&apos;s here — tap any card to go deeper.
        </p>
      </div>
      {/* Decorative monitoring count tucked into bottom-right; mirrors
          the LIVE strip's content so the band has its own weight. */}
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
    // Outer container: stickies just below the layout header. We
    // add a translucent canvas wash + backdrop blur so when the
    // page scrolls under it, content doesn't ghost through the
    // pill's negative space.
    <div
      className="sticky z-30"
      style={{
        top: "64px",
        // Pull up so the strip overlaps the hero's curved bottom.
        marginTop: "-32px",
        marginBottom: "8px",
      }}
    >
      <div className="bg-canvas/80 backdrop-blur-md py-2">
        <div className="container-page max-w-[1200px]">
          <div className="inline-flex max-w-full items-center gap-2 sm:gap-2.5 rounded-full bg-white border border-hairline shadow-soft px-3 sm:px-3.5 h-9 text-[11.5px] sm:text-[12.5px] text-ink whitespace-nowrap overflow-hidden">
            <span className="relative inline-flex items-center justify-center shrink-0">
              <span
                className="absolute inline-flex h-2.5 w-2.5 rounded-full opacity-60 animate-ping"
                style={{ background: "#10B981" }}
                aria-hidden="true"
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "#10B981" }}
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
      className="block rounded-2xl border border-amber-200 bg-amber-50 shadow-soft p-5 md:p-6 transition-colors hover:bg-amber-100/60"
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

// ─── Insights card (white) ─────────────────────────────────────

export function InsightsCard() {
  return (
    <Link
      href="/app/insights"
      className="group block rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6 transition-all hover:bg-canvas/40 hover:shadow-float"
    >
      <div className="flex items-start justify-between gap-3">
        <CardBadge icon={BarChart3} label="Insights" />
        <ChevronRight
          size={16}
          strokeWidth={2}
          className="text-ink-muted group-hover:text-ink transition-colors"
        />
      </div>
      <div className="mt-4">
        <div className="text-[18px] md:text-[20px] font-bold text-ink leading-snug">
          Patterns, health & trend
        </div>
        <div className="mt-1.5 text-[13.5px] text-ink-muted">
          Score, 12-month chart, category breakdown
        </div>
      </div>
    </Link>
  );
}

// ─── Your card (green tint) ───────────────────────────────────

export function YourCardCard({ personality }: { personality: Personality }) {
  return (
    <Link
      href="/app/card"
      className="group block rounded-2xl border border-emerald-200 bg-emerald-50 shadow-soft p-5 md:p-6 transition-colors hover:bg-emerald-100/60"
    >
      <div className="flex items-start justify-between gap-3">
        <CardBadge icon={BadgeCheck} label="Your card" tone="green" />
        <ChevronRight
          size={16}
          strokeWidth={2}
          className="text-ink-muted group-hover:text-ink transition-colors"
        />
      </div>
      <div className="mt-4">
        <div className="text-[18px] md:text-[20px] font-bold text-ink leading-snug">
          {personality.label}
        </div>
        <div className="mt-1.5 text-[13.5px] text-ink-muted leading-relaxed">
          {personality.sub}
        </div>
      </div>
    </Link>
  );
}

// ─── Share card (white) ──────────────────────────────────────

export function ShareCard() {
  return (
    <div className="block rounded-2xl border border-hairline bg-white shadow-soft p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <CardBadge icon={Share2} label="Share" />
      </div>
      <div className="mt-4">
        <div className="text-[18px] md:text-[20px] font-bold text-ink leading-snug">
          Show off your stack
        </div>
        <div className="mt-1.5 text-[13.5px] text-ink-muted leading-relaxed">
          Frugavo turns your subscription pattern into a card you can post.
        </div>
        <Link
          href="/app/share"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-hairline px-4 text-[12.5px] font-medium text-ink hover:bg-ink/[0.04] transition"
        >
          Share stats
        </Link>
      </div>
    </div>
  );
}

// ─── Hero emoji ─────────────────────────────────────────────────

// Rotates through a small calm set, picking based on the current
// minute so the visit doesn't flicker but a return reload changes
// it. Renders inline above the hero h1.
const HERO_EMOJIS = ["👋", "✨", "🌿", "🧭", "☕️", "📬", "🕊️"];
function HeroEmoji() {
  // Server-rendered with a per-minute bucket; deterministic during
  // a single render and naturally varies across visits.
  const idx = Math.floor(Date.now() / 60_000) % HERO_EMOJIS.length;
  return (
    <span
      className="inline-block text-[28px] md:text-[32px] leading-none"
      aria-hidden="true"
    >
      {HERO_EMOJIS[idx]}
    </span>
  );
}

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
      <QuickAction
        href="/app/scanning"
        icon={RefreshCw}
        label="Re-scan now"
        hint="Pull the latest from your banks"
      />
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
